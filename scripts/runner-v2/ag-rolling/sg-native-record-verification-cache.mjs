// Bounded in-memory independent record verification for one game operation.
// Database reads, identity checks and merge decisions remain the caller's work.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
export function createRecordVerificationCache({verify,maxRecords=300140}){
 assert(typeof verify==='function'&&Number.isSafeInteger(maxRecords)&&maxRecords>0&&maxRecords<=300140,'SG_RECORD_CACHE_OPTIONS');
 const cache=new Map();let checks=0,hits=0,verifiedRecords=0;
 function batch(records){
  // Reproduce every cross-record constraint from record_fields.verify_batch.
  // That parser receives records sorted by sequence in verifyOrdinaryNativePage.
  assert(Array.isArray(records)&&records.length>=1&&records.length<=100,'SG_RECORD_CACHE_BATCH');
  assert(records.every(r=>r&&typeof r._id==='string'&&r.fixtureOnly===false&&Number.isSafeInteger(r.sequence)&&r.sequence>0),'SG_RECORD_CACHE_BATCH');
  assert(new Set(records.map(r=>r._id)).size===records.length&&new Set(records.map(r=>r.sequence)).size===records.length,'SG_RECORD_CACHE_BATCH');
 }
 return {
  async verify(plan,records){
   batch(records);const before=hash({plan,records}),ph=hash(plan),keys=records.map(r=>hash({planHash:ph,record:r}));
   const missing=records.filter((r,i)=>!cache.has(keys[i]));
   if(missing.length){
    checks++;const receipt=await verify(plan,missing);
    assert(receipt?.verified===true&&receipt.count===missing.length,'SG_RECORD_CACHE_INCOMPLETE');
   }
   // No partial inserts, including when a cached member changed during await.
   assert(hash({plan,records})===before,'SG_RECORD_CACHE_INPUT_CHANGED');
   hits+=records.length-missing.length;verifiedRecords+=missing.length;
   for(const key of keys){cache.delete(key);cache.set(key,true);if(cache.size>maxRecords)cache.delete(cache.keys().next().value);}
   return {verified:true,count:records.length};
  },
  clear(){cache.clear();},
  status:()=>({records:cache.size,maxRecords,checks,hits,verifiedRecords}),
 };
}
export function createGameRecordVerificationCache({verify,maxRecords=300140}){
 assert(typeof verify==='function','SG_RECORD_CACHE_OPTIONS');
 let gameKey=null,current=null;
 return {
  verify(key,plan,records){
   assert(typeof key==='string'&&key.length>0,'SG_RECORD_CACHE_GAME');
   if(gameKey!==key){current?.clear();gameKey=key;current=createRecordVerificationCache({verify,maxRecords});}
   return current.verify(plan,records);
  },
  release(key){if(key===undefined||key===gameKey){current?.clear();current=null;gameKey=null;}},
  status:()=>({gameKey,...(current?.status()??{records:0,maxRecords,checks:0,hits:0,verifiedRecords:0})}),
 };
}
