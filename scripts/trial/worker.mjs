import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { connect } from './rpc.mjs';
const require = createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const { prepareNextgenRound } = require('../../collector/sg.ingest.ts');
const { XMLParser } = require('../../collector/node_modules/fast-xml-parser');
const parser = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});
const plan = JSON.parse(fs.readFileSync('config/trial-300k.json','utf8'));
const registry = JSON.parse(fs.readFileSync('service/round_types.json','utf8'));
function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
}
const hash = v => createHash('sha256').update(v).digest('hex');
const mappingHash = hash(canonical(registry.profiles[plan.sourceKey]));
const role = process.argv[2] || 'capture';
assert(['capture','audit','status'].includes(role));
const transport = connect(plan), rpc = transport.rpc;
const evidence = {schema:plan.schema,trialId:plan.trialId,game:plan.name,gameId:plan.gameId,runtimeGameId:plan.runtimeGameId,
  target:plan.target,role,sourceRequests:0,paidRoundRequests:0,completedThisRun:0,productionGamePoolWrites:false};
let lease, owner, stop = false, lastRequestAt = 0;
const sessionStart = performance.now();
process.on('SIGTERM', () => {stop=true;});
process.on('SIGINT', () => {stop=true;});
function owned() {return {owner,epoch:lease.epoch};}
function fail(code, category='source_protocol', extra={}) {return Object.assign(new Error(code),{code,category,...extra});}
function params(value) {
  const p = {};
  for (const part of String(value).split('&')) {
    if (!part) continue;
    const at=part.indexOf('=');
    if (at<0 || Object.hasOwn(p,part.slice(0,at))) throw fail('AMBIGUOUS_SOURCE_RESPONSE');
    p[part.slice(0,at)]=part.slice(at+1);
  }
  return p;
}
function integer(value) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw fail('INVALID_SOURCE_MONEY');
  return Number(value);
}
const xml = v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
async function main() {
  if (role === 'status') { evidence.result=await rpc('status'); return; }
  if (role === 'audit') { evidence.result=await rpc('audit'); return; }
  const status=await rpc('status');
  if (status.status === 'complete') {evidence.alreadyComplete=true; evidence.result=status; return;}
  if (status.status === 'halted') throw fail('TRIAL_HALTED','storage');
  const game=JSON.parse(process.env.SG_TRIAL_DEMO_CONFIG || '{}');
  assert.equal(game.id,plan.gameId);assert.equal(game.runtimeSlug,plan.runtimeSlug);assert.equal(game.mode,'demo');
  assert.equal(game.serverAddress,'ogs-gdm-usnj.nyxop.net/nextgen');
  assert(game.sessionId && game.operatorId);
  owner=`${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:${process.env.GITHUB_JOB}`;
  lease=await rpc('claim',{owner,sessionHash:hash(game.sessionId+'@'+game.operatorId),commitSha:process.env.GITHUB_SHA});
  evidence.startCheckpoint=lease.checkpoint;
  const limit=Number(process.env.SG_TRIAL_LIMIT || '1');
  assert(Number.isSafeInteger(limit) && limit>=1 && limit<=plan.target);
  const deadline=performance.now()+Number(process.env.SG_TRIAL_MINUTES || '240')*60000;
  const cookies=new Map();
  async function post(payload, msgId) {
    const delay=plan.minRequestIntervalMs-(Date.now()-lastRequestAt);
    if (delay>0) await new Promise(r=>setTimeout(r,delay));
    lastRequestAt=Date.now();evidence.sourceRequests++;if(msgId==='BET')evidence.paidRoundRequests++;
    const body='<gdmRequest><clienttype>flash</clienttype><lang>en_us</lang>'+
      `<currency>${xml(game.currency)}</currency><mode>demo</mode><token>${xml(game.sessionId+'@'+game.operatorId)}</token>`+
      `<methodName>processGameMessage</methodName><payload>${xml(payload)}</payload></gdmRequest>`;
    let response;
    const start=performance.now();
    try {
      response=await fetch(`https://${game.serverAddress}/`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),
        headers:{'Content-Type':'text/xml; charset=utf-8',...(cookies.size?{Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')}:{})},body});
    }catch{throw fail('SOURCE_NETWORK_OUTCOME_UNKNOWN','source_network');}
    for(const c of response.headers.getSetCookie()) {const part=c.split(';')[0],at=part.indexOf('=');if(at>0)cookies.set(part.slice(0,at),part.slice(at+1));}
    if(!response.ok){
      const retry=response.headers.get('retry-after');
      let seconds=/^\d+$/.test(retry || '')?Number(retry):Math.max(0,(Date.parse(retry || '')-Date.now())/1000);
      if(!Number.isFinite(seconds))seconds=0;
      throw fail('SOURCE_HTTP_REJECTED','source_http',{httpStatus:response.status,cooldownUntil:response.status===429?Date.now()/1000+Math.max(600,seconds):0});
    }
    let text;
    try{text=await response.text();}catch{throw fail('SOURCE_NETWORK_OUTCOME_UNKNOWN','source_network');}
    if(text.length>262144 || /<!DOCTYPE|<!ENTITY/i.test(text))throw fail('SOURCE_XML_REJECTED');
    let root;
    try{const d=parser.parse(text);root=d.GDMRESPONSE || d.gdmresponse || {};}catch{throw fail('SOURCE_XML_REJECTED');}
    const result={ts:new Date().toISOString(),methodName:'processGameMessage',msgId,requestPayload:payload,
      responsePayload:String(root.PAYLOAD || ''),responseXml:text,elapsedMs:Math.round(performance.now()-start)};
    if(String(root.SUCCESS).toLowerCase()!=='true') {
      // Preserve rejection as a frame when a paid/continuation intent exists.
      return {...result,sourceRejected:true};
    }
    const p=params(result.responsePayload);
    if(p.MSGID!==msgId) return {...result,sourceRejected:true};
    if(p.AB!==undefined || p.B!==undefined)result.responseBalance=integer(p.AB ?? p.B);
    return result;
  }
  const payload=msg=>`GN=${game.runtimeSlug}&PID=gdmgcm${game.sessionId}&MSGID=${msg}&AP=false&BPL=5&LB=5`;
  async function bootstrap() {
    const init=await post(`GN=${game.runtimeSlug}&PID=gdmgcm${game.sessionId}&MSGID=INIT`,'INIT');
    if(init.sourceRejected)throw fail('SOURCE_INIT_REJECTED');
    const nextBalance=integer(params(init.responsePayload).AB ?? params(init.responsePayload).B);
    const reelstrip=await post(`GN=${game.runtimeSlug}&PID=gdmgcm${game.sessionId}&MSGID=REELSTRIP`,'REELSTRIP');
    if(reelstrip.sourceRejected)throw fail('SOURCE_REELSTRIP_REJECTED');
    return nextBalance;
  }
  let pending=lease.pendingRound, balance;
  if(pending){
    assert.equal(pending.awaiting,null);balance=pending.raw.startBalanceRaw;
  }else{
    balance=await bootstrap();
    evidence.initialBalanceRaw=balance;
  }
  let sequence=lease.durable+1, prepared=null;
  for(let i=0;i<10;i++)await rpc('ping');
  while(sequence<=plan.target && evidence.completedThisRun<limit && (!stop && performance.now()<deadline || pending || prepared)){
    let raw, attempt;
    let intentReady=false;
    if(pending){raw=pending.raw;attempt=pending.attempt;sequence=pending.sequence;pending=null;}
    else{
      // Demo credit reset is allowed only between fully settled big rounds.
      // Its new balance becomes the next round's start; it is never a payout.
      if(balance<2500){
        const previous=balance;
        balance=await bootstrap();
        if(balance<=previous)throw fail('DEMO_BALANCE_REFRESH_FAILED');
        evidence.demoBalanceRefreshes=(evidence.demoBalanceRefreshes || 0)+1;
      }
      raw={fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:balance,steps:[]};
      if(prepared){
        assert.equal(prepared.sequence,sequence);assert.equal(prepared.startBalanceRaw,balance);
        attempt=prepared.attempt;prepared=null;
      }else{
        attempt=randomUUID();
        await rpc('begin',{...owned(),sequence,attempt,startBalanceRaw:balance,requestPayload:payload('BET')});
      }
      intentReady=true;
    }
    while(true){
      const msg=raw.steps.length?'FREE_GAME':'BET';
      if(raw.steps.length>=plan.maxSteps)throw fail('ROUND_STEP_LIMIT');
      if(!intentReady)await rpc('intent',{...owned(),sequence,requestPayload:payload(msg)});
      const step=await post(payload(msg),msg);
      evidence.sourceElapsedMs=(evidence.sourceElapsedMs || 0)+step.elapsedMs;
      raw.steps.push(step);
      let normalized, following;
      const remaining=step.sourceRejected?null:integer(params(step.responsePayload).NFG ?? '0');
      if(remaining===0){
        try{normalized=prepareNextgenRound(raw,{buy:0,bonus:raw.steps.some(s=>s.msgId==='FREE_GAME')?1:0,typeMappingHash:mappingHash});}
        catch { /* Send original response first; server preserves it and rejects invalid settlement. */ }
      }
      if(remaining>0 && raw.steps.length<plan.maxSteps){
        following={sequence,requestPayload:payload('FREE_GAME')};
      }else if(normalized && sequence<plan.target && evidence.completedThisRun+1<limit && !stop
        && performance.now()+2000<deadline && normalized.money.endBalanceRaw>=2500){
        following={sequence:sequence+1,attempt:randomUUID(),startBalanceRaw:normalized.money.endBalanceRaw,requestPayload:payload('BET')};
      }
      const result=await rpc('exchange',{...owned(),sequence,step,...(normalized?{normalized}:{}),...(following?{following}:{})});
      intentReady=result.followingIntentDurable===true;
      if(result.complete){
        balance=result.endBalanceRaw;evidence.endCheckpoint=result.checkpoint;
        if(intentReady)prepared=following;
        break;
      }
    }
    evidence.completedThisRun++;sequence++;
    if(evidence.completedThisRun%100===0){
      const seconds=(performance.now()-sessionStart)/1000;
      console.log(JSON.stringify({trialId:plan.trialId,confirmed:evidence.endCheckpoint,target:plan.target,
        completedThisRun:evidence.completedThisRun,roundsPerSecond:Number((evidence.completedThisRun/seconds).toFixed(3)),sourceRequests:evidence.sourceRequests}));
    }
  }
  evidence.result=await rpc('release',owned());
  evidence.endCheckpoint=evidence.result.checkpoint;
}
try {
  await main();evidence.outcome='success';
} catch(error) {
  evidence.outcome='stopped';evidence.error=/^[A-Z_]{1,80}$/.test(error.code || '')?error.code:'TRIAL_RUN_FAILED';
  if(error.httpStatus)evidence.httpStatus=error.httpStatus;
  if(lease){
    try{evidence.result=await rpc('fail',{...owned(),category:error.category || 'storage',cooldownUntil:error.cooldownUntil || 0});}
    catch{}
  }
  // A claim can itself detect an unknown prior source outcome and halt the
  // trial. Report that fresh state even when this Runner never acquired it.
  try{evidence.result=await rpc('status');}catch{}
  process.exitCode=2;
} finally {
  evidence.rpcMetrics=transport.metrics();
  evidence.elapsedSeconds=Number(((performance.now()-sessionStart)/1000).toFixed(3));
  if(evidence.completedThisRun)evidence.roundsPerSecond=evidence.completedThisRun/evidence.elapsedSeconds;
  if(process.env.GITHUB_OUTPUT && ['pending','claimed','complete','halted'].includes(evidence.result?.status))
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`trial_status=${evidence.result.status}\n`);
  console.log(JSON.stringify(evidence));
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### ${plan.name}: 300,000 complete rounds\n\n\`\`\`json\n${JSON.stringify(evidence,null,2)}\n\`\`\`\n`);
  transport.close();
}
