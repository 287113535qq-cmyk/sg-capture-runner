import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {captureBatch,runDynamicBatches,fail} from './capture-batch.mjs';
import {completedResponseTiming} from './capture-telemetry.mjs';
import {veryFruitySession,veryFruityPayload,veryFruityResponse,veryFruityInit,VERYFRUITY_ENDPOINT} from './veryfruity-session.mjs';
import {veryFruityActionNext,veryFruityActionMapping} from './veryfruity-action-protocol.mjs';

// Transport and durable queue are shared; identity, wager, route and settlement
// use the independent Very Fruity contract. This entry grants no pool quota.
export async function runVeryFruityWorker({plan,baseGame,shard,rpc,prepareRound,evidence,shouldStop,requestStop,onLease,
 commitSha,planHash,fetchImpl=fetch,deadline=performance.now()+240*60000,limit=5,runId,runAttempt,job,telemetry,onProgress=()=>{}}){
 assert(plan.schema==='sg-work-pool-v1'&&Number.isSafeInteger(limit)&&limit>0&&limit<=5,'VERYFRUITY_PILOT_ONLY');
 const initial=veryFruitySession(baseGame,plan,shard,`${runId}:${runAttempt}`);
 let session=initial,owned,currentLease,paidIntent=false;const cookies=new Map();
 const identity={owner:`${runId}:${runAttempt}:${job}:${randomUUID()}`,sessionHash:createHash('sha256').update(initial+'@'+baseGame.operatorId).digest('hex'),commitSha,planHash};
 async function post(requestPayload,msgId){
  assert(currentLease,'VERYFRUITY_LEASE_REQUIRED');const start=performance.now();evidence.sourceRequests++;
  if(msgId==='Logic'&&paidIntent){evidence.paidRoundRequests++;paidIntent=false;}
  const sourceFetch=telemetry?(...args)=>telemetry.fetch(fetchImpl,msgId,...args):fetchImpl;
  let response;try{response=await sourceFetch(VERYFRUITY_ENDPOINT,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'text/xml; charset=utf-8',
   ...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},body:requestPayload});}
  catch{throw fail('SOURCE_NETWORK_OUTCOME_UNKNOWN','source_network');}
  for(const c of response.headers.getSetCookie?.()??[]){const p=c.split(';')[0],at=p.indexOf('=');if(at>0)cookies.set(p.slice(0,at),p.slice(at+1));}
  if(!response.ok){const retry=response.headers.get('retry-after'),seconds=/^\d+$/.test(retry??'')?Number(retry):Math.max(0,(Date.parse(retry??'')-Date.now())/1000);
   throw fail('SOURCE_HTTP_REJECTED','source_http',{httpStatus:response.status,cooldownUntil:response.status===429?Date.now()/1000+Math.max(600,Number.isFinite(seconds)?seconds:0):0});}
  let text;try{text=await response.text();}catch{throw fail('SOURCE_NETWORK_OUTCOME_UNKNOWN','source_network');}
  const step={ts:new Date().toISOString(),methodName:'wms',msgId,requestPayload,responsePayload:text,responseXml:text,elapsedMs:Math.round(performance.now()-start),
   ...(completedResponseTiming(response)?{sourceTiming:completedResponseTiming(response)}:{})};
  // Failed parsing does not discard the response: the controller journals it.
  try{const parsed=veryFruityResponse(plan,text,msgId);step.responseBalance=parsed.balance;session=parsed.session;}catch{step.sourceRejected=true;}
  return step;
 }
 const payload=msg=>veryFruityPayload(plan,msg,session),state={};
 async function bootstrap(){
  assert.equal(session,initial,'VERYFRUITY_NO_IMPLICIT_RECONNECT');
  const requestPayload=payload('Init');await rpc('bootstrap_intent',{...owned,msgId:'Init',requestPayload});
  const step=await post(requestPayload,'Init');await rpc('bootstrap_frame',{...owned,step});
  if(step.sourceRejected)throw fail('SOURCE_INIT_REJECTED');return veryFruityInit(plan,step.responseXml).balance;
 }
 const trackedRpc=async(op,data)=>{const result=await rpc(op,data);if(op==='begin')paidIntent=true;return result;};
 await runDynamicBatches({rpc,identity,shouldStop,deadline,onLease:(lease,owner)=>{currentLease=lease;owned=owner;onLease(lease,owner);},capture:async(lease,owner)=>{
  assert.equal(lease.pendingRound??null,null,'VERYFRUITY_INTERRUPTED_NO_RESUME');
  assert(Number.isSafeInteger(lease.shortRunLimit)&&lease.shortRunLimit>0&&lease.shortRunLimit<=5,'VERYFRUITY_PILOT_ONLY');
  const result=await captureBatch({plan,lease,owned:owner,rpc:trackedRpc,post,payload,bootstrap,prepareRound,mappingHash:null,extensionHash:null,evidence,state,
   onProgress,shouldStop,requestStop,deadline,limit:Math.min(limit,lease.shortRunLimit),protocol:'wms',startMessage:'Logic',
   route:raw=>veryFruityActionNext(plan,raw),mapping:raw=>veryFruityActionMapping(plan,raw)});
  evidence.result=result;return result;
 }});
 evidence.result=await rpc('status');
}
