import {completedResponseTiming} from './capture-telemetry.mjs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {captureBatch,runDynamicBatches,fail} from './capture-batch.mjs';
import {rhinoNext,rhinoMapping} from './rhino-protocol.mjs';
import {rhinoSession,rhinoPayload,rhinoResponse,rhinoInit,RHINO_ENDPOINT} from './rhino-session.mjs';

export async function runRhinoWorker({plan,baseGame,shard,rpc,mappingHash,extensionHash,prepareRound,evidence,shouldStop,requestStop,onLease,telemetry,onProgress=()=>{},
 commitSha,planHash,fetchImpl=fetch,deadline=performance.now()+240*60000,limit=5,runId,runAttempt,job}){
 const formal=plan.countAllocation!==undefined;
 assert(plan.schema==='sg-work-pool-v1'&&Number.isSafeInteger(limit)&&limit>0
  &&(formal?limit<=plan.target:limit<=5),'RHINO_CAPTURE_LIMIT');
 const initial=rhinoSession(baseGame,plan,shard,formal?`${runId}:${runAttempt}:${randomUUID()}`:undefined);
 let session=initial,owned,currentLease,paidIntent=false,rotate=false;
 const stopped=()=>shouldStop()||rotate;
 const identity={owner:`${runId}:${runAttempt}:${job}:${randomUUID()}`,sessionHash:createHash('sha256').update(initial+'@'+baseGame.operatorId).digest('hex'),commitSha,planHash};
 const cookies=new Map();
 async function post(requestPayload,msgId){
  if(msgId==='Logic'&&!currentLease)throw fail('RHINO_LEASE_REQUIRED','storage');
  const start=performance.now();evidence.sourceRequests++;
  if(msgId==='Logic'&&paidIntent){evidence.paidRoundRequests++;paidIntent=false;}
  const sourceFetch=telemetry?(...args)=>telemetry.fetch(fetchImpl,msgId,...args):fetchImpl;
  let response;
  try{response=await sourceFetch(RHINO_ENDPOINT,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'text/xml; charset=utf-8',
   ...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},body:requestPayload});}
  catch{throw fail('SOURCE_NETWORK_OUTCOME_UNKNOWN','source_network');}
  for(const c of response.headers.getSetCookie?.()??[]){const part=c.split(';')[0],at=part.indexOf('=');if(at>0)cookies.set(part.slice(0,at),part.slice(at+1));}
  if(!response.ok){const retry=response.headers.get('retry-after'),seconds=/^\d+$/.test(retry??'')?Number(retry):Math.max(0,(Date.parse(retry??'')-Date.now())/1000);
   throw fail('SOURCE_HTTP_REJECTED','source_http',{httpStatus:response.status,cooldownUntil:response.status===429?Date.now()/1000+Math.max(600,Number.isFinite(seconds)?seconds:0):0});}
  let text;try{text=await response.text();}catch{throw fail('SOURCE_NETWORK_OUTCOME_UNKNOWN','source_network');}
  const step={ts:new Date().toISOString(),methodName:'wms',msgId,requestPayload,responsePayload:text,responseXml:text,elapsedMs:Math.round(performance.now()-start),
   ...(completedResponseTiming(response)?{sourceTiming:completedResponseTiming(response)}:{})};
  // Preserve even rejected/malformed replies through exchange before stopping.
  try{const parsed=rhinoResponse(text,msgId);step.responseBalance=parsed.balance;session=parsed.session;}
  catch{step.sourceRejected=true;}
  return step;
 }
 const payload=msg=>rhinoPayload(msg,session);
 const state={};
 async function bootstrap(){
  assert.equal(session,initial,'RHINO_NO_IMPLICIT_RECONNECT');
  const requestPayload=payload('Init');await rpc('bootstrap_intent',{...owned,msgId:'Init',requestPayload});
  const step=await post(requestPayload,'Init');await rpc('bootstrap_frame',{...owned,step});
  if(step.sourceRejected)throw fail('SOURCE_INIT_REJECTED');
  return rhinoInit(step.responseXml).balance;
 }
 const trackedRpc=async(op,data)=>{
  const result=await rpc(op,data);
  if(op==='begin')paidIntent=true;
  if(formal&&op==='exchange_journal'&&result.complete&&result.endBalanceRaw<2500){
   rotate=true;evidence.sessionBoundary='settled-low-demo-balance';
  }
  return result;
 };
 await runDynamicBatches({rpc,identity,shouldStop:stopped,deadline,onLease:(lease,owner)=>{currentLease=lease;owned=owner;onLease(lease,owner);},
  capture:async(lease,owner)=>{
   assert.equal(lease.pendingRound??null,null,'RHINO_INTERRUPTED_NO_RESUME');
   if(formal)assert(lease.countAllocation===plan.countAllocation&&lease.shortRunLimit===undefined,'RHINO_FORMAL_LEASE_REQUIRED');
   else assert(Number.isSafeInteger(lease.shortRunLimit)&&lease.shortRunLimit>0&&lease.shortRunLimit<=5,'RHINO_PILOT_ONLY');
   const result=await captureBatch({plan,lease,owned:owner,rpc:trackedRpc,post,payload,bootstrap,prepareRound,mappingHash,extensionHash,
    evidence,state,onProgress,shouldStop:stopped,requestStop,deadline,limit:formal?limit:Math.min(limit,lease.shortRunLimit),protocol:'wms',startMessage:'Logic',route:rhinoNext,mapping:rhinoMapping});
   evidence.result=result;return result;
  }});
 if(formal)await rpc('finish_run');
 evidence.result=await rpc('status');
}
