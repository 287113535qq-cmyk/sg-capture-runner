import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {coalesceWriter} from './sg-batch-writer.mjs';
import {taskId} from './ag-core.mjs';
const digest=v=>createHash('sha256').update(stable(v)).digest('hex');
export function sourceJournalKey({queueId,game,kind,index,owner,sessionHash,requestNo,type}){
 const prefix='rolling-source:'+digest([queueId,game.gameId,game.campaignId,taskId(kind,index),owner,sessionHash])+':';
 return prefix+String(requestNo).padStart(10,'0')+':'+type;
}
export const sourceSessionPrefix=({queueId,game,kind,index,owner})=>'rolling-session:'+
 digest([queueId,game.gameId,game.campaignId,taskId(kind,index),owner])+':';
// Immutable per-session evidence, batched across the original AG workers.
// No shared campaign counter is touched by an intent or response.
export function createSourceJournal({store,transport,game,queueId,kind,index,owner,guard}){
 const id=taskId(kind,index),identity={queueId,gameId:game.gameId,kind,index,owner},sessions=new Map();
 const prefix=s=>'rolling-source:'+digest([queueId,game.gameId,game.campaignId,id,owner,s])+':';
 const key=(s,n,type)=>prefix(s)+String(n).padStart(10,'0')+':'+type;
 let capability=false;
 const writer=coalesceWriter({guard,writeAndReadback:async rows=>{
  if(!capability){const hello=await transport.request('hello');
   assert(hello?.database==='sg_capture_staging_v1'&&hello.rollingJournalBatchEnabled===true,'SG_SOURCE_NATIVE_CAPABILITY');capability=true;}
  await transport.request('rolling_journal_insert',{records:rows.map(r=>({key:r._id,value:r.value}))});
  const saved=await store.getMany('journal',rows.map(r=>r._id));
  assert(saved.length===rows.length&&saved.every(Boolean),'SG_SOURCE_FULL_READBACK');
  return saved.map((r,i)=>{assert(r._id?.endsWith('/'+rows[i]._id),'SG_SOURCE_NATIVE_KEY');return {_id:rows[i]._id,value:r.value};});
 }});
 const write=async(k,value)=>{const ack=await writer.insert({_id:k,value:structuredClone(value)});
  assert(ack.fullReadback,'SG_SOURCE_DURABILITY');return {durable:true};};
 const session=request=>{
  assert(Object.keys(identity).every(k=>request[k]===identity[k]),'SG_SOURCE_SCOPE');
  const s=sessions.get(request.sessionHash);assert(s&&!s.closed,'SG_SOURCE_SESSION');return s;
 };
 const api={
  async open(request){
   assert(Object.keys(identity).every(k=>request[k]===identity[k])&&/^[a-f0-9]{64}$/.test(request.sessionHash)
    &&Number.isSafeInteger(request.ordinal)&&request.ordinal>0&&!sessions.has(request.sessionHash),'SG_SOURCE_OPEN');
   const value={...request};
   const sessionKey=sourceSessionPrefix({queueId,game,kind,index,owner})+String(request.ordinal).padStart(10,'0');
   await Promise.all([write(key(request.sessionHash,0,'open'),value),write(sessionKey,value)]);
   sessions.set(request.sessionHash,{open:value,last:0,awaiting:null,responses:new Map(),closed:null});
  },
  async intent(request){
   const s=session(request);assert(s.awaiting===null&&request.requestNo===s.last+1
    &&request.requestNo<10**10&&typeof request.msgId==='string'&&typeof request.requestPayload==='string','SG_SOURCE_INTENT_ORDER');
   s.awaiting=request.requestNo;await write(key(request.sessionHash,request.requestNo,'intent'),request);
   s.last=request.requestNo;return {durable:true};
  },
  async response(request){
   const s=session(request);assert(s.awaiting===request.requestNo&&s.last===request.requestNo
    &&request.step?.requestPayload===request.requestPayload&&request.step.msgId===request.msgId
    &&request.step.rollingSource?.sessionHash===request.sessionHash
    &&request.step.rollingSource.requestNo===request.requestNo,'SG_SOURCE_RESPONSE_ORDER');
   await write(key(request.sessionHash,request.requestNo,'response'),request);
   s.responses.set(request.requestNo,digest(request.step));s.awaiting=null;return {durable:true};
  },
  async close(request){
   if(request===undefined)return writer.close();
   const s=session(request);assert(request.closed===true&&request.requestNo===s.last
    &&request.ordinal===s.open.ordinal,'SG_SOURCE_CLOSE');
   await write(key(request.sessionHash,0,'closed'),request);s.closed=structuredClone(request);
  },
  async assertDurable(records){
   for(const record of records){const s=sessions.get(record.sourceSessionHash);
    assert(s&&record.raw?.steps?.length>0,'SG_SOURCE_RECORD_SESSION');
    for(const step of record.raw.steps){const ref=step.rollingSource;
     assert(ref?.sessionHash===record.sourceSessionHash&&s.responses.get(ref.requestNo)===digest(step),'SG_SOURCE_RECORD_UNACKNOWLEDGED');}
   }
  },
  async auditSources(request){
   assert(Object.keys(identity).every(k=>request[k]===identity[k])&&Array.isArray(request.sessions)
    &&request.sessions.length===sessions.size,'SG_SOURCE_AUDIT_SCOPE');await writer.drain();
   let pending=0,unknownRequests=0,protocolFaults=0,sourcesClosed=true;
   for(const state of request.sessions){
    const s=sessions.get(state.sessionHash);assert(s&&state.ordinal===s.open.ordinal,'SG_SOURCE_AUDIT_SESSION');
    const pair=await store.getMany('journal',[key(state.sessionHash,0,'open'),key(state.sessionHash,0,'closed')]);
    assert(pair[0]&&stable(pair[0].value)===stable(s.open),'SG_SOURCE_OPEN_READBACK');
    if(!pair[1]){sourcesClosed=false;pending++;continue;}
    assert(s.closed&&stable(pair[1].value)===stable(s.closed)&&state.closed===true,'SG_SOURCE_CLOSED_READBACK');
    const closed=pair[1].value;unknownRequests+=closed.unknownRequests;protocolFaults+=closed.protocolFaults;
    if(closed.awaiting!==null||closed.activeRound)pending++;
    for(let n=1;n<=closed.requestNo;n+=50){
     const keys=Array.from({length:Math.min(50,closed.requestNo-n+1)},(_,i)=>[
      key(state.sessionHash,n+i,'intent'),key(state.sessionHash,n+i,'response')]).flat();
     const docs=await store.getMany('journal',keys);assert(docs.length===keys.length,'SG_SOURCE_AUDIT_PAGE');
     for(let i=0;i<docs.length;i+=2){
      assert(docs[i]?._id.endsWith('/'+keys[i]),'SG_SOURCE_INTENT_READBACK');
      if(!docs[i+1]){pending++;continue;}
      assert(docs[i+1]._id.endsWith('/'+keys[i+1]),'SG_SOURCE_RESPONSE_READBACK');
      const {step,...intent}=docs[i+1].value;
      assert(stable(intent)===stable(docs[i].value)&&s.responses.get(intent.requestNo)===digest(step),'SG_SOURCE_AUDIT_CONTENT');
     }
    }
    assert(!await store.get('journal',key(state.sessionHash,closed.requestNo+1,'intent')),'SG_SOURCE_UNEXPECTED_SUFFIX');
   }
   return {queueId,gameId:game.gameId,taskId:id,owner,pending,unknownRequests,protocolFaults,
    activeLeases:0,sourcesClosed};
  },
  status:()=>writer.status(),
 };
 return api;
}
