import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { connect } from './rpc.mjs';
import { gameForShard } from './demo-sessions.mjs';
import {captureBatch, runDynamicBatches, fail, params, integer} from './capture-batch.mjs';
import {SQUID_EXTENSION} from './squid-protocol.mjs';
const require = createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const { prepareNextgenRound } = require('../../collector/sg.ingest.ts');
const { XMLParser } = require('../../collector/node_modules/fast-xml-parser');
const parser = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});
const planFile = process.env.SG_TRIAL_PLAN || 'config/trial-300k.json';
assert(['config/trial-300k.json','config/trial-pool.json','config/round-one-active.json'].includes(planFile));
const plan = JSON.parse(fs.readFileSync(planFile,'utf8'));
const isPool = plan.schema === 'sg-work-pool-v1';
const registry = JSON.parse(fs.readFileSync('service/round_types.json','utf8'));
function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
}
const hash = v => createHash('sha256').update(v).digest('hex');
const mappingHash = hash(canonical(registry.profiles[plan.sourceKey]));
const extensionHash=hash(canonical(registry.profiles[SQUID_EXTENSION]));
const role = process.argv[2] || 'capture';
assert(['capture','audit','status'].includes(role));
const requestIntervalMs=Number(process.env.SG_TRIAL_INTERVAL_MS ?? plan.minRequestIntervalMs);
const exchangeOperation=process.env.SG_TRIAL_EXCHANGE || 'exchange_journal';
assert([0,50].includes(requestIntervalMs));
assert(['exchange','exchange_journal'].includes(exchangeOperation));
if(isPool){assert.equal(requestIntervalMs,0);assert.equal(exchangeOperation,'exchange_journal');}
const shard=process.env.SG_TRIAL_SHARD===undefined ? null : Number(process.env.SG_TRIAL_SHARD);
assert(shard===null || Number.isInteger(shard) && shard>=0 && shard<20);
const transport = connect(plan), rpc = (op,data={})=>transport.rpc(op,{...(shard===null?{}:{shardId:shard}),...data});
const evidence = {schema:plan.schema,trialId:plan.trialId,game:plan.name,gameId:plan.gameId,runtimeGameId:plan.runtimeGameId,
  target:plan.target,shardId:shard,role,requestIntervalMs,exchangeOperation,sourceRequests:0,paidRoundRequests:0,completedThisRun:0,productionGamePoolWrites:false};
let lease, leaseOwned, owner, stop = false, lastRequestAt = 0;
const sessionStart = performance.now();
process.on('SIGTERM', () => {stop=true;});
process.on('SIGINT', () => {stop=true;});
function owned() {return leaseOwned || {owner,epoch:lease.epoch};}
const xml = v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
async function main() {
  if (isPool && plan.configured !== true) {
    if (role === 'capture') throw fail('POOL_NOT_CONFIGURED','storage');
    evidence.result={status:'not_configured',globalSourceEnabled:false};return;
  }
  if (role === 'status') { evidence.result=await rpc('status'); return; }
  if (role === 'audit') { evidence.result=await rpc('audit'); return; }
  const status=await rpc('status');
  if (status.status === 'complete') {evidence.alreadyComplete=true; evidence.result=status; return;}
  if (status.status === 'halted') throw fail('TRIAL_HALTED','storage');
  let baseGame=JSON.parse(process.env.SG_TRIAL_DEMO_CONFIG || '{}');
  if(plan.campaignId)baseGame={...baseGame,id:plan.gameId,runtimeSlug:plan.runtimeSlug};
  const game=shard===null?baseGame:gameForShard(baseGame,shard,plan.trialId,plan);
  if(isPool)assert(shard!==null);
  assert.equal(game.id,plan.gameId);assert.equal(game.runtimeSlug,plan.runtimeSlug);assert.equal(game.mode,'demo');
  assert.equal(game.serverAddress,'ogs-gdm-usnj.nyxop.net/nextgen');
  assert(game.sessionId && game.operatorId);
  owner=`${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:${process.env.GITHUB_JOB}:${randomUUID()}`;
  const identity={owner,sessionHash:hash(game.sessionId+'@'+game.operatorId),commitSha:process.env.GITHUB_SHA,planHash:hash(canonical(plan))};
  if(!isPool){
    lease=await rpc('claim',identity);leaseOwned={owner,epoch:lease.epoch};
    evidence.startCheckpoint=lease.checkpoint;evidence.sequenceTarget=lease.sequenceTarget ?? plan.target;
    evidence.sequenceBase=lease.sequenceBase ?? 0;
  }
  const poolLimit=Number(process.env.SG_POOL_RUN_LIMIT || '0');
  assert(Number.isSafeInteger(poolLimit) && poolLimit>=0);
  const limit=isPool?(poolLimit>0?Math.min(plan.target,poolLimit):plan.target):Number(process.env.SG_TRIAL_LIMIT || '1');
  assert(Number.isSafeInteger(limit) && limit>=1 && limit<=plan.target);
  const deadline=performance.now()+Number(process.env.SG_TRIAL_MINUTES || '240')*60000;
  const cookies=new Map();
  async function post(payload, msgId) {
    const delay=requestIntervalMs-(Date.now()-lastRequestAt);
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
    try{
      const p=params(result.responsePayload);
      if(p.MSGID!==msgId) return {...result,sourceRejected:true};
      if(p.AB!==undefined || p.B!==undefined)result.responseBalance=integer(p.AB ?? p.B);
    }catch{return {...result,sourceRejected:true};}
    return result;
  }
  const payload=(msg,next={})=>msg.startsWith('FEATURE_')?
    Object.entries({GN:game.runtimeSlug,PID:`gdmgcm${game.sessionId}`,MSGID:msg,CFG:next.CFG,...(next.FP?{FP:next.FP}:{})}).map(([k,v])=>`${k}=${v}`).join('&'):plan.campaignId?
    Object.entries({...plan.requestParams,PID:`gdmgcm${game.sessionId}`,MSGID:msg}).map(([k,v])=>`${k}=${v}`).join('&'):
    `GN=${game.runtimeSlug}&PID=gdmgcm${game.sessionId}&MSGID=${msg}&AP=false&BPL=5&LB=5`;
  async function bootstrap() {
    const init=await post(`GN=${game.runtimeSlug}&PID=gdmgcm${game.sessionId}&MSGID=INIT`,'INIT');
    if(init.sourceRejected)throw fail('SOURCE_INIT_REJECTED');
    const nextBalance=integer(params(init.responsePayload).AB ?? params(init.responsePayload).B);
    const reelstrip=await post(`GN=${game.runtimeSlug}&PID=gdmgcm${game.sessionId}&MSGID=REELSTRIP`,'REELSTRIP');
    if(reelstrip.sourceRejected)throw fail('SOURCE_REELSTRIP_REJECTED');
    return nextBalance;
  }
  const state={};
  const capture=async (currentLease,currentOwned)=>{
    const result=await captureBatch({plan,lease:currentLease,owned:currentOwned,rpc,post,payload,bootstrap,
      prepareRound:prepareNextgenRound,mappingHash,extensionHash,evidence,state,shouldStop:()=>stop,requestStop:()=>{stop=true;},
      deadline,limit,exchangeOperation,onProgress:()=>{
        const seconds=(performance.now()-sessionStart)/1000;
        console.log(JSON.stringify({trialId:plan.trialId,shardId:shard,batchId:currentLease.batchId,
          completedThisRun:evidence.completedThisRun,batchCheckpoint:evidence.endCheckpoint,target:plan.target,
          roundsPerSecond:Number((evidence.completedThisRun/seconds).toFixed(3)),sourceRequests:evidence.sourceRequests,
          ...(evidence.completedThisRun%1000===0?{rpcMetrics:transport.metrics(),sourceElapsedMs:evidence.sourceElapsedMs}: {})}));
      }});
    evidence.result=result;
    if(isPool && result.status==='complete')evidence.completedBatches=(evidence.completedBatches || 0)+1;
    return result;
  };
  if(isPool){
    await runDynamicBatches({rpc,identity,capture,shouldStop:()=>stop,deadline,
      onLease:(currentLease,currentOwned)=>{lease=currentLease;leaseOwned=currentOwned;}});
    evidence.result=await rpc('status');
  }else{
    for(let i=0;i<10;i++)await rpc('ping');
    await capture(lease,leaseOwned);
  }

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
  if(!isPool || plan.configured===true){try{evidence.result=await rpc('status');}catch{}}
  process.exitCode=2;
} finally {
  evidence.rpcMetrics=transport.metrics();
  evidence.elapsedSeconds=Number(((performance.now()-sessionStart)/1000).toFixed(3));
  if(evidence.completedThisRun)evidence.roundsPerSecond=evidence.completedThisRun/evidence.elapsedSeconds;
  if(process.env.GITHUB_OUTPUT && ['pending','claimed','complete','halted'].includes(evidence.result?.status))
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`trial_status=${evidence.result.status}\n`);
  console.log(JSON.stringify(evidence));
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### ${plan.name}: ${plan.target ?? 'unconfigured'} complete rounds\n\n\`\`\`json\n${JSON.stringify(evidence,null,2)}\n\`\`\`\n`);
  transport.close();
}
