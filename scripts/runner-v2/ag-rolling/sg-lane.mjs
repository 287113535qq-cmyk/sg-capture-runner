import assert from 'node:assert/strict';
import {runLane,taskId} from './ag-core.mjs';
import {validateSgPayload} from './sg-contract.mjs';
import {connectTaskStore} from './sg-task-store.mjs';
import {runCaptureTask} from './sg-capture-adapter.mjs';
// Runs the original AG lane loop with SG protocol and staging adapters. This
// library has no workflow dispatch, legacy campaign selection or live entry
// point: its caller must supply a registered, exact-commit queue and guard.
export async function runSgLane({payload,lane,runId,manifest,store,guard,createProtocol,createStorage,
 now=Date.now,pause=()=>new Promise(r=>setTimeout(r,3000)),log=()=>{},deadline,signal}){
 validateSgPayload(payload,manifest);taskId('worker',lane);
 assert(typeof guard==='function'&&typeof createProtocol==='function'&&typeof createStorage==='function'
  &&Number.isFinite(deadline),'SG_AG_LANE_ADAPTERS');
 const results=new Map(),open=new Map();
 const key=(game,kind,index)=>game.campaignId+':'+taskId(kind,index);
 return runLane(payload,lane,runId,{
  now,pause,log,
  async connect(game,queueId){
   await guard({game,queueId,lane,stage:'connect'});
   return connectTaskStore({store,game,queueId,
    guard:()=>guard({game,queueId,lane,stage:'task'}),now,
    verifyTask:async({kind,index,owner})=>{
     const r=results.get(key(game,kind,index));assert(r?.exitCode===0&&r.proof?.owner===owner,'SG_TASK_RESULT_MISSING');return r.proof;
    },
    close:async()=>{
     for(const [k,value] of open){if(value.game.campaignId!==game.campaignId)continue;
      await value.storage.close();open.delete(k);}
    },
   });
  },
  async run(game,kind,index,quota,owner){
   await guard({game,queueId:payload.queueId,lane,kind,index,owner,stage:'capture'});
   const protocol=await createProtocol({game,queueId:payload.queueId,kind,index,owner});
   const storage=await createStorage({game,queueId:payload.queueId,kind,index,quota,owner,protocol});
   const k=key(game,kind,index);assert(!open.has(k),'SG_DUPLICATE_TASK_EXECUTION');open.set(k,{game,storage});
   const result=await runCaptureTask({game,kind,index,quota,owner,protocol,storage,
    guard:()=>guard({game,queueId:payload.queueId,lane,kind,index,owner,stage:'source'}),deadline,log,signal});
   results.set(k,result);return result.exitCode;
  },
 });
}
