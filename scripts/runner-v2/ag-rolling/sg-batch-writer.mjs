import assert from 'node:assert/strict';
import {stable} from '../mongo-writer.mjs';
// The original AG class awaits insertRound before counting success. Gather
// concurrent inserts from its eight loops into one native write/readback,
// without changing that behavior or acknowledging an unverified record.
export function coalesceWriter({writeAndReadback,guard,maxBatch=100,flushDelayMs=5,maxBytes=7*1024*1024}){
 assert(typeof writeAndReadback==='function'&&typeof guard==='function'&&Number.isSafeInteger(maxBatch)
  &&maxBatch>=1&&maxBatch<=100&&Number.isSafeInteger(flushDelayMs)&&flushDelayMs>=0
  &&Number.isSafeInteger(maxBytes)&&maxBytes>0&&maxBytes<=7*1024*1024,'SG_BATCH_WRITER');
 let queue=[],timer=null,active=false,poison=null,closing=false,finishers=[];
 const fault=code=>Object.assign(new Error(code),{code});
 function settle(){if(!active&&!queue.length)for(const r of finishers.splice(0))r();}
 async function flush(){
  if(active)return;clearTimeout(timer);timer=null;
  if(!queue.length){settle();return;}
  active=true;let bytes=0,length=0;
  while(length<queue.length&&length<maxBatch&&bytes+queue[length].bytes<=maxBytes){bytes+=queue[length].bytes;length++;}
  const part=queue.splice(0,length);
  try{
   await guard();const records=part.map(p=>p.record);const rows=await writeAndReadback(records);
   assert(Array.isArray(rows)&&rows.length===records.length,'SG_BATCH_READBACK_COUNT');
   const found=new Map(rows.map(r=>[r._id,r]));assert(found.size===records.length,'SG_BATCH_READBACK_DUPLICATE');
   assert(records.every(r=>found.has(r._id)&&stable(found.get(r._id))===stable(r)),'SG_BATCH_READBACK_CONTENT');
   for(const p of part)p.resolve({fullReadback:true,independentlyVerified:true});
  }catch(error){
   poison=error;for(const p of [...part,...queue.splice(0)])p.reject(error);
  }finally{active=false;if(queue.length)void flush();else settle();}
 }
 return {
  insert(record){
   if(poison||closing)return Promise.reject(poison??fault('SG_BATCH_WRITER_CLOSED'));
   assert(record&&typeof record._id==='string','SG_BATCH_RECORD_ID');
   const snapshot=structuredClone(record);
   const bytes=Buffer.byteLength(JSON.stringify(snapshot))+128;assert(bytes<=maxBytes,'SG_BATCH_RECORD_TOO_LARGE');
   const promise=new Promise((resolve,reject)=>queue.push({record:snapshot,bytes,resolve,reject}));
   if(queue.length>=maxBatch)void flush();else if(!timer&&!active)timer=setTimeout(()=>{void flush();},flushDelayMs);
   return promise;
  },
  async drain(){if(queue.length)void flush();if(active||queue.length)await new Promise(r=>finishers.push(r));if(poison)throw poison;},
  async close(){closing=true;await this.drain();},
  status:()=>({pending:queue.length,active,poisoned:!!poison}),
 };
}
