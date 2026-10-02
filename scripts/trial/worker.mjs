import {PYRAMIDS_SOURCE,PYRAMIDS_FREE_EXTENSION,PYRAMIDS_MAJOR_EXTENSION,PYRAMIDS_MIXED_EXTENSION,PYRAMIDS_FIFTEEN_EXTENSION,PYRAMIDS_SUPER_HOLD_EXTENSION} from './pyramids-protocol.mjs';
import {PYRAMIDS_SUPER_COIN_EXTENSION} from './pyramids-super-coin-review.mjs';
import {ACTION_VERSION,pyramidsActionNext} from './pyramids-action-protocol.mjs';
import {PYRAMIDS_COIN_EXTENSION} from './pyramids-coin-review.mjs';
import {INCA_SOURCE,INCA_EXTENSION,INCA_COIN_EXTENSION} from './inca-protocol.mjs';
import {PIGGIES_SOURCE,PIGGIES_SIZE2_EXTENSION} from './piggies-protocol.mjs';
import {HUFF_RETRIGGER_EXTENSION} from './huff-retrigger-review.mjs';
import {HUFF_TOUCHUP_EXTENSION} from './huff-touchup-review.mjs';
import {PEARL_SOURCE} from './pearl-protocol.mjs';
import {PEARL_RETRIGGER_EXTENSION} from './pearl-retrigger-protocol.mjs';
import {PEARL_AWARD_EXTENSION} from './pearl-award-protocol.mjs';
import {runPearlWorker} from './pearl-worker.mjs';
import {RHINO_SOURCE,RHINO_GUARANTEE_EXTENSION} from './rhino-protocol.mjs';
import {runRhinoWorker} from './rhino-worker.mjs';
import {MOREPUFF_MEGAHAT_EXTENSION} from './morepuff-megahat-review.mjs';
import {MOREPUFF_SOURCE,MOREPUFF_EXTENSION} from './morepuff-protocol.mjs';
import {JINZITA_SOURCE,JINZITA_EXTENSION} from './jinzita-protocol.mjs';
import {failureCode} from './failure-code.mjs';
import {createCaptureTelemetry,businessOutcome,completedResponseTiming} from './capture-telemetry.mjs';
import {LUXOR_SOURCE,LUXOR_EXTENSION} from './luxor-protocol.mjs';
import {DEMON_NESTED_EXTENSION} from './demon-nested-protocol.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { connect } from './rpc.mjs';
import { gameForShard } from './demo-sessions.mjs';
import {nextgenCountGame} from './nextgen-count-session.mjs';
import {captureBatch, runDynamicBatches, fail, params, integer} from './capture-batch.mjs';
import {SQUID_EXTENSION} from './squid-protocol.mjs';
import {HUFF_SOURCE,HUFF_EXTENSION} from './huff-protocol.mjs';
import {BEAVER_SOURCE,BEAVER_EXTENSION,BEAVER_CFG1_EXTENSION} from './beaver-protocol.mjs';
import {DEMON_SOURCE,DEMON_EXTENSION} from './demon-protocol.mjs';
import {QUARTERBACK_SOURCE,QUARTERBACK_EXTENSION,QUARTERBACK_PICK_EXTENSION} from './quarterback-protocol.mjs';
import {globalShard} from './runner-group.mjs';
import {canarySourceActivity} from '../runner-v2/session-canary.mjs';
import {captureCollector,captureXmlParser} from './collector-loader.mjs';
const require = createRequire(import.meta.url);
// Linux preflight typechecks this fixed runtime before admission. Avoid building
// a second TypeScript type graph in every independent capture process; protocol,
// collector and independent Python validation still execute for every record.
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json'),transpileOnly:true});
const prepareNextgenRound=(...args)=>captureCollector('nextgen').prepareNextgenRound(...args);
const pearlFields=(...args)=>captureCollector('pearl').pearlFields(...args);
const pearlRetriggerFields=(...args)=>captureCollector('pearlRetrigger').pearlRetriggerFields(...args);
const pearlAwardFields=(...args)=>captureCollector('pearlAward').pearlAwardFields(...args);
const rhinoFields=(...args)=>captureCollector('rhino').rhinoFields(...args);
const parser={parse:text=>captureXmlParser().parse(text)};
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
import {PYRAMIDS_SUPER_FREE_EXTENSION} from './pyramids-super-free-review.mjs';
import {PYRAMIDS_RETRIGGER_EXTENSION} from './pyramids-retrigger-review.mjs';
const extensionHash=plan.sourceKey===RHINO_SOURCE ? hash(canonical(registry.profiles[RHINO_GUARANTEE_EXTENSION])) : plan.sourceKey===PYRAMIDS_SOURCE ? {free:hash(canonical(registry.profiles[PYRAMIDS_FREE_EXTENSION])),major:hash(canonical(registry.profiles[PYRAMIDS_MAJOR_EXTENSION])),mixed:hash(canonical(registry.profiles[PYRAMIDS_MIXED_EXTENSION])),fifteen:hash(canonical(registry.profiles[PYRAMIDS_FIFTEEN_EXTENSION])),superHold:hash(canonical(registry.profiles[PYRAMIDS_SUPER_HOLD_EXTENSION])),superFree:hash(canonical(registry.profiles[PYRAMIDS_SUPER_FREE_EXTENSION])),retrigger:hash(canonical(registry.profiles[PYRAMIDS_RETRIGGER_EXTENSION])),superCoins:hash(canonical(registry.profiles[PYRAMIDS_SUPER_COIN_EXTENSION])),coins:hash(canonical(registry.profiles[PYRAMIDS_COIN_EXTENSION]))} : plan.sourceKey===INCA_SOURCE ? {free:hash(canonical(registry.profiles[INCA_EXTENSION])),coins:hash(canonical(registry.profiles[INCA_COIN_EXTENSION]))} : plan.sourceKey===PIGGIES_SOURCE ? hash(canonical(registry.profiles[PIGGIES_SIZE2_EXTENSION])) : plan.sourceKey===PEARL_SOURCE ? null : plan.sourceKey===HUFF_SOURCE ? {hardHat:hash(canonical(registry.profiles[HUFF_EXTENSION])),touchup:hash(canonical(registry.profiles[HUFF_TOUCHUP_EXTENSION])),retrigger:hash(canonical(registry.profiles[HUFF_RETRIGGER_EXTENSION]))} : plan.sourceKey===MOREPUFF_SOURCE ? {cash:hash(canonical(registry.profiles[MOREPUFF_EXTENSION])),megahat:hash(canonical(registry.profiles[MOREPUFF_MEGAHAT_EXTENSION]))} : plan.sourceKey===JINZITA_SOURCE ? hash(canonical(registry.profiles[JINZITA_EXTENSION])) : plan.sourceKey===LUXOR_SOURCE ? hash(canonical(registry.profiles[LUXOR_EXTENSION])) : plan.sourceKey===BEAVER_SOURCE ? {free:hash(canonical(registry.profiles[BEAVER_EXTENSION])),cfg1:hash(canonical(registry.profiles[BEAVER_CFG1_EXTENSION]))} : plan.sourceKey===DEMON_SOURCE ? {free:hash(canonical(registry.profiles[DEMON_EXTENSION])),nested:hash(canonical(registry.profiles[DEMON_NESTED_EXTENSION]))} : plan.sourceKey===QUARTERBACK_SOURCE ? {foam:hash(canonical(registry.profiles[QUARTERBACK_EXTENSION])),pickBall:hash(canonical(registry.profiles[QUARTERBACK_PICK_EXTENSION]))} : hash(canonical(registry.profiles[plan.sourceKey===BEAVER_SOURCE?BEAVER_EXTENSION:plan.sourceKey===QUARTERBACK_SOURCE?QUARTERBACK_EXTENSION:plan.sourceKey===DEMON_SOURCE?DEMON_EXTENSION:plan.sourceKey===HUFF_SOURCE?HUFF_EXTENSION:SQUID_EXTENSION]));
const role = process.argv[2] || 'capture';
assert(['capture','audit','status'].includes(role));
const requestIntervalMs=Number(process.env.SG_TRIAL_INTERVAL_MS ?? plan.minRequestIntervalMs);
const exchangeOperation=process.env.SG_TRIAL_EXCHANGE || 'exchange_journal';
assert([0,50].includes(requestIntervalMs));
assert(['exchange','exchange_journal'].includes(exchangeOperation));
if(isPool){assert.equal(requestIntervalMs,0);assert.equal(exchangeOperation,'exchange_journal');}
const shard=process.env.SG_TRIAL_SHARD===undefined ? null : globalShard(
  Number(process.env.SG_TRIAL_SHARD), plan, process.env.GITHUB_REPOSITORY,Number(process.env.SG_SESSION_LANE??'0'));
const transport = connect(plan), rpc = (op,data={})=>telemetry.rpc((operation,request)=>transport.rpc(operation,request),op,{...(shard===null?{}:{shardId:shard}),...data});
const evidence = {schema:plan.schema,trialId:plan.trialId,game:plan.name,gameId:plan.gameId,runtimeGameId:plan.runtimeGameId,
  target:plan.target,shardId:shard,role,requestIntervalMs,exchangeOperation,sourceRequests:0,paidRoundRequests:0,completedThisRun:0,productionGamePoolWrites:false};
let lease, leaseOwned, owner, stop = false, lastRequestAt = 0;
const sessionStart = performance.now();
let workerError;
const canaryActivity=process.env.SG_CANARY_SCHEDULE?canarySourceActivity(JSON.parse(process.env.SG_CANARY_SCHEDULE),shard):null;
const telemetry=createCaptureTelemetry({gameId:plan.gameId,shardId:shard,evidence,canaryActivity,metrics:options=>transport.metrics(options),emit:row=>console.log(JSON.stringify(row))});
if(role==='capture')telemetry.start();
process.on('SIGTERM', () => {stop=true;});
process.on('SIGINT', () => {stop=true;});
function owned() {return leaseOwned || {owner,epoch:lease.epoch};}
const xml = v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
async function main() {
  const canary=typeof transport.canaryReady==='function'?await transport.canaryReady(()=>stop):null;
  if(canary&&!canary.capture){evidence.result={status:canary.reason,sourceRequests:0};return;}
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
  if(plan.sourceKey===RHINO_SOURCE){
    assert(isPool&&shard!==null&&process.env.SG_PROCESSING_MODE==='github-v2','RHINO_GITHUB_POOL_REQUIRED');
    const requested=Number(process.env.SG_POOL_RUN_LIMIT||'0');
    assert(plan.countAllocation?requested===0:requested===5,'RHINO_CAPTURE_PERMISSION');
    return runRhinoWorker({plan,baseGame,shard,rpc,mappingHash,extensionHash,prepareRound:telemetry.sync('normalize',rhinoFields),evidence,telemetry,onProgress:()=>telemetry.progress(),
      shouldStop:()=>stop,requestStop:()=>{stop=true;},onLease:(currentLease,currentOwned)=>{lease=currentLease;leaseOwned=currentOwned;},
      commitSha:process.env.GITHUB_SHA,planHash:hash(canonical(plan)),runId:process.env.GITHUB_RUN_ID,
      runAttempt:process.env.GITHUB_RUN_ATTEMPT,job:process.env.GITHUB_JOB,limit:plan.countAllocation?plan.target:requested,
      deadline:performance.now()+(canary?Math.max(0,canary.endMs-Date.now()):Number(process.env.SG_TRIAL_MINUTES||'240')*60000)});
  }
  if(plan.sourceKey===PEARL_SOURCE){
    assert(isPool&&shard!==null&&process.env.SG_PROCESSING_MODE==='github-v2','PEARL_GITHUB_POOL_REQUIRED');
    const requested=Number(process.env.SG_POOL_RUN_LIMIT||'0');
    assert(plan.countAllocation?requested===0:requested===5,'PEARL_CAPTURE_PERMISSION');
    const awards=plan.featureProfile==='additive-free-awards-v2';
    return runPearlWorker({plan,baseGame,shard,rpc,mappingHash,extensionHash:awards?{retrigger:hash(canonical(registry.profiles[PEARL_RETRIGGER_EXTENSION])),awards:hash(canonical(registry.profiles[PEARL_AWARD_EXTENSION]))}:plan.featureProfile==='eight-free-retrigger-v1'?hash(canonical(registry.profiles[PEARL_RETRIGGER_EXTENSION])):null,prepareRound:telemetry.sync('normalize',awards?pearlAwardFields:plan.featureProfile==='eight-free-retrigger-v1'?pearlRetriggerFields:pearlFields),evidence,telemetry,onProgress:()=>telemetry.progress(),
      shouldStop:()=>stop,requestStop:()=>{stop=true;},onLease:(currentLease,currentOwned)=>{lease=currentLease;leaseOwned=currentOwned;},
      commitSha:process.env.GITHUB_SHA,planHash:hash(canonical(plan)),runId:process.env.GITHUB_RUN_ID,
      runAttempt:process.env.GITHUB_RUN_ATTEMPT,job:process.env.GITHUB_JOB,limit:plan.countAllocation?plan.target:requested,
      deadline:performance.now()+Number(process.env.SG_TRIAL_MINUTES||'240')*60000});
  }
  owner=`${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:${process.env.GITHUB_JOB}:${randomUUID()}`;
  const game=plan.countAllocation?nextgenCountGame(baseGame,plan,shard,owner)
    :shard===null?baseGame:gameForShard(baseGame,shard,plan.trialId,plan);
  if(isPool)assert(shard!==null);
  assert.equal(game.id,plan.gameId);assert.equal(game.runtimeSlug,plan.runtimeSlug);assert.equal(game.mode,'demo');
  assert.equal(game.serverAddress,'ogs-gdm-usnj.nyxop.net/nextgen');
  assert(game.sessionId && game.operatorId);
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
  const deadline=performance.now()+(canary?Math.max(0,canary.endMs-Date.now()):Number(process.env.SG_TRIAL_MINUTES || '240')*60000);
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
      response=await telemetry.fetch(fetch,msgId,`https://${game.serverAddress}/`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),
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
      responsePayload:String(root.PAYLOAD || ''),responseXml:text,elapsedMs:Math.round(performance.now()-start),
   ...(completedResponseTiming(response)?{sourceTiming:completedResponseTiming(response)}:{})};
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
    const guarded=process.env.SG_PROCESSING_MODE==='github-v2';
    const send=async(msg)=>{
      const requestPayload=`GN=${game.runtimeSlug}&PID=gdmgcm${game.sessionId}&MSGID=${msg}`;
      if(guarded)await rpc('bootstrap_intent',{...owned(),msgId:msg,requestPayload});
      const step=await post(requestPayload,msg);
      if(guarded)await rpc('bootstrap_frame',{...owned(),step});
      return step;
    };
    const init=await send('INIT');
    if(init.sourceRejected)throw fail('SOURCE_INIT_REJECTED');
    const nextBalance=integer(params(init.responsePayload).AB ?? params(init.responsePayload).B);
    const reelstrip=await send('REELSTRIP');
    if(reelstrip.sourceRejected)throw fail('SOURCE_REELSTRIP_REJECTED');
    return nextBalance;
  }
  const state={};
  const capture=async (currentLease,currentOwned)=>{
    const action=plan.featureProfile===ACTION_VERSION;
    const result=await captureBatch({plan,lease:currentLease,owned:currentOwned,rpc,post,payload,bootstrap,
      prepareRound:telemetry.sync('normalize',action?raw=>captureCollector('pyramidsAction').prepareNextgenActionRound(raw,plan):prepareNextgenRound),
      ...(action?{route:raw=>pyramidsActionNext(plan,raw),mapping:()=>({})}:{}),
      mappingHash,extensionHash,evidence,state,shouldStop:()=>stop,requestStop:()=>{stop=true;},
      deadline,limit:currentLease.shortRunLimit===undefined?limit:Math.min(limit,currentLease.shortRunLimit),exchangeOperation,onProgress:()=>telemetry.progress()});
    evidence.result=result;
    if(isPool && result.status==='complete')evidence.completedBatches=(evidence.completedBatches || 0)+1;
    return result;
  };
  if(isPool){
    await runDynamicBatches({rpc,identity,capture,shouldStop:()=>stop,deadline,
      onLease:(currentLease,currentOwned)=>{lease=currentLease;leaseOwned=currentOwned;}});
    if(plan.countAllocation&&leaseOwned)await rpc('finish_run',owned());
    evidence.result=await rpc('status');
  }else{
    for(let i=0;i<10;i++)await rpc('ping');
    await capture(lease,leaseOwned);
  }

}
try {
  await main();evidence.outcome='success';
} catch(error) {
  workerError=error;evidence.outcome='stopped';evidence.error=failureCode(error);
  if(error.httpStatus)evidence.httpStatus=error.httpStatus;
  if(lease){
    try{evidence.result=await rpc('fail',{...owned(),category:error.category || 'storage',code:evidence.error,cooldownUntil:error.cooldownUntil || 0});}
    catch{}
  }
  // A claim can itself detect an unknown prior source outcome and halt the
  // trial. Report that fresh state even when this Runner never acquired it.
  if(!isPool || plan.configured===true){try{evidence.result=await rpc('status');}catch{}}
  process.exitCode=2;
} finally {
  if(isPool && leaseOwned && owner) {
    // The source call has ended. A protocol hold may retain an unfinished
    // natural round; relinquish only our fenced leases, never its attempt.
    try{await rpc('yield_protocol_stop',owned());}catch{}
  }
  telemetry.stop();evidence.performance=telemetry.snapshot();
  evidence.businessOutcome=businessOutcome(evidence.result,workerError);
  evidence.rpcMetrics=transport.metrics();
  evidence.elapsedSeconds=Number(((performance.now()-sessionStart)/1000).toFixed(3));
  if(evidence.completedThisRun)evidence.roundsPerSecond=evidence.completedThisRun/evidence.elapsedSeconds;
  if(process.env.GITHUB_OUTPUT && ['pending','claimed','complete','halted'].includes(evidence.result?.status))
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`trial_status=${evidence.result.status}\n`);
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`business_outcome=${evidence.businessOutcome}\n`);
  console.log(JSON.stringify(evidence));
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### ${plan.name}: ${plan.target ?? 'unconfigured'} complete rounds\n\n\`\`\`json\n${JSON.stringify(evidence,null,2)}\n\`\`\`\n`);
  transport.close();
}
