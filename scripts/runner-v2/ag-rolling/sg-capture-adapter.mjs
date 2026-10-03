import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAGCaptureRuntime} from './ag-capture-runtime.mjs';
import {taskId,quotas} from './ag-core.mjs';
const unknownCodes=new Set(['SOURCE_NETWORK_OUTCOME_UNKNOWN','SOURCE_ACK_UNKNOWN','MONGO_ACK_UNKNOWN',
 'GATEWAY_ACK_UNKNOWN','GATEWAY_DISCONNECTED','GATEWAY_RESPONSE_INVALID','GATEWAY_RESPONSE_TOO_LARGE',
 'MONGO_OPERATION_OUTCOME_UNKNOWN','JOURNAL_ACK_UNKNOWN','SOURCE_INTENT_UNRESOLVED']);
const safeError=(code,prefix='AG integrity:')=>Object.assign(new Error(`${prefix} ${/^[A-Z_]{1,100}$/.test(code??'')?code:'SG_PROTOCOL_STOPPED'}`),{code});
// Adapter only: all session loops, round-limit arithmetic, choice balancing,
// task success counting, leasing and shutdown are the original AG class.
export async function runCaptureTask({game,kind,index,quota,owner,protocol,storage,guard,deadline,log=()=>{},signal}){
 taskId(kind,index);
 assert(quota===(kind==='canary'?10:quotas(game.baseline)[index-1]),'AG_CAPTURE_TASK_QUOTA');
 assert(typeof guard==='function'&&Number.isFinite(deadline)&&typeof protocol.open==='function'
  &&typeof storage.insertRound==='function'&&typeof storage.verify==='function','SG_CAPTURE_ADAPTER');
 const stop=new AbortController(),identities=new Set(),closings=[];let unknown=false,sourceFault=false;const faults=new Set();
 const recordFault=error=>{const code=error.code??error.message;faults.add(/^[A-Z_]{1,100}$/.test(code??'')?code:'SG_PROTOCOL_STOPPED');};
 const closeSession=current=>{
  try{const pending=current?.close();if(pending?.then)closings.push(Promise.resolve(pending).catch(()=>{unknown=true;}));}
  catch{unknown=true;}
 };
 const abort=()=>stop.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const timer=setTimeout(abort,Math.max(0,deadline-Date.now()));timer.unref?.();
 class InitialError extends Error{}
 class DiscardedError extends Error{}
 class Session {
  constructor(){this.current=null;}
  async connect(){
   try{
    await guard();this.current=await protocol.open({game,kind,index,owner,signal:stop.signal});
    assert(typeof this.current?.identity==='string'&&!identities.has(this.current.identity),'SG_SHARED_SESSION');
    identities.add(this.current.identity);
   }catch(error){recordFault(error);sourceFault=true;closeSession(this.current);this.current=null;
    if(unknownCodes.has(error.code)||error.outcomeUnknown===true){unknown=true;abort();}
    throw safeError(error.code);
   }
  }
  getHandshakeData(){return null;}
  close(){closeSession(this.current);this.current=null;}
 }
 const runtime=createAGCaptureRuntime({fs,RoxorCometDSession:Session,AGDiscardedRoundError:DiscardedError,
  AGInitialSpinResponseError:InitialError,isInitialSpinRuntimeError:()=>false,
  console:{log:line=>log(line),warn:line=>log(line),error:line=>log(line)},
  captureAGRound:async(session,options)=>{
   try{
    await guard();const round=await session.current.captureRound({chooseOption:options.chooseOption,signal:stop.signal});
    assert(round?.data&&round.data.complete===true&&round.data.independentlyVerified===true
     &&round.data.unknownRequests===0,'SG_FULL_ROUND_REQUIRED');
    return round;
   }catch(error){
    recordFault(error);
    sourceFault=true;
    if(unknownCodes.has(error.code)||error.outcomeUnknown===true){
     // Protocol semantics, not a change to AG retry scheduling: abort before
     // AG's catch can retry. Keep durable intent/evidence for review.
     unknown=true;abort();throw new InitialError('SG source outcome unknown; preserved for review');
    }
    throw safeError(error.code);
   }
  }});
 let exitCode=1,proof=null;
 const store={
  async insertRound(db,round,buckets){
   try{await guard();const result=await storage.insertRound(db,round,buckets);
    assert(result?.fullReadback===true&&result.independentlyVerified===true,'SG_MONGO_FULL_READBACK_REQUIRED');
   }catch(error){recordFault(error);if(unknownCodes.has(error.code)||error.outcomeUnknown===true){unknown=true;abort();}throw safeError(error.code);}
  },
  clearGame:async()=>{throw safeError('SG_HISTORICAL_CLEAR_FORBIDDEN');},
 };
 for(const method of ['tryAcquireGameLease','renewGameLease','releaseGameLease','getCounts','getValidationRequirements']){
  if(typeof storage[method]==='function')store[method]=async(...args)=>{
   try{return await storage[method](...args);}catch(error){
    if(unknownCodes.has(error.code)||error.outcomeUnknown===true){unknown=true;abort();}
    throw safeError(error.code);
   }
  };
 }
 try{
  await guard();
  // Zero-quota AG shards close without opening an SG source session.
  if(quota>0)await runtime.runAGScheduler([{...game,backendId:game.gameId,name:game.gameId}],{
   store,limits:{spinLimit:quota,freeChoicePerOption:0},concurrentGames:1,workersPerGame:kind==='canary'?1:8,
   retryAttempts:5,retryDelayMs:2000,spinDelayMs:200,logInterval:250,sessionReadyDelayMs:0,
   sessionRecycleDelayMs:0,workerStartJitterMs:0,shouldClear:false,maxRoundsPerGame:quota,
   ownerId:owner,gameLeaseMs:600000,gameLeaseRenewMs:10000,shutdownSignal:stop.signal,
  });
  // AG's scheduler logs child failures and resolves; the task's independent
  // readback decides success. Unknown outcomes can never be reported success.
  await Promise.all(closings);
  if(!unknown&&!sourceFault){proof=await storage.verify({game,kind,index,quota,owner});
   assert(proof?.fullReadback===true&&proof.independentlyVerified===true&&proof.unknownRequests===0
    &&proof.pending===0&&proof.activeLeases===0&&Number.isSafeInteger(proof.count)&&proof.count>=quota
    &&proof.count<=quota+(kind==='canary'?0:7),'SG_TASK_FULL_READBACK');exitCode=0;}
 }catch(error){recordFault(error);exitCode=1;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 return {exitCode,proof,unknownOutcome:unknown,sourceRetriedAfterUnknown:false,faults:[...faults]};
}
