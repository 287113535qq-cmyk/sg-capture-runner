import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
export function validateBusinessInventory(rows,b){
 const workers=Array.from({length:20},()=>[]),ids=new Set(),sequences=new Set();
 assert(rows.length===300000,'SG_BUSINESS_INVENTORY_COUNT');
 for(const r of rows){
  const w=r.shardId;
  assert(r.trialId===b.trialId&&r.gameId===Number(b.gameId)&&Number.isInteger(w)&&w>=0&&w<20
   &&/^[a-f0-9]{64}$/.test(r._id)&&/^[a-f0-9]{64}$/.test(r.contentHash)
   &&Number.isSafeInteger(r.sequence)&&((r.sequence>w*15000&&r.sequence<=(w+1)*15000)
    ||(r.sequence>300000+w*7&&r.sequence<=300000+(w+1)*7))
   &&!ids.has(r._id)&&!sequences.has(r.sequence),'SG_BUSINESS_INVENTORY_IDENTITY');
  ids.add(r._id);sequences.add(r.sequence);workers[w].push(r);
 }
 assert(workers.every(rows=>rows.length===15000),'SG_BUSINESS_WORKER_INVENTORY');
 for(const rows of workers)rows.sort((a,b)=>a._id.localeCompare(b._id));
 return workers;
}
export async function businessInventory(source,b){
 const rows=await source.find({gameId:Number(b.gameId),trialId:b.trialId},{projection:{_id:1,trialId:1,gameId:1,shardId:1,sequence:1,contentHash:1},hint:'rolling_game_count',batchSize:1000,maxTimeMS:30000}).toArray();
 return validateBusinessInventory(rows,b);
}
// Use the existing game index once, then bounded primary-key reads in exactly
// the original AG worker/ID selection order. No database index is created.
export async function readBusinessNativePages({source,binding:b,inventory,verify,visit}){
 const hash=createHash('sha256');let count=0;
 for(let worker=0;worker<20;worker++){
  const refs=inventory[worker];assert(refs.length===15000,'SG_BUSINESS_WORKER_INVENTORY');
  for(let offset=0;offset<refs.length;offset+=100){
   const wanted=refs.slice(offset,offset+100);
   const found=await source.find({_id:{$in:wanted.map(r=>r._id)},trialId:b.trialId,gameId:Number(b.gameId)},{hint:'_id_',batchSize:100,maxTimeMS:15000}).toArray();
   const by=new Map(found.map(r=>[r._id,r]));
   assert(found.length===wanted.length&&by.size===found.length,'SG_BUSINESS_NATIVE_PAGE_COUNT');
   const records=wanted.map(ref=>{const r=by.get(ref._id);assert(r&&r.trialId===ref.trialId&&r.gameId===ref.gameId&&r.shardId===worker
    &&r.sequence===ref.sequence&&r.contentHash===ref.contentHash,'SG_BUSINESS_NATIVE_INVENTORY_CHANGED');return r;});
   await verify(records);
   for(const r of records)hash.update(stable(r)+'\n');
   await visit(records,worker,offset+records.length);count+=records.length;
  }
 }
 assert(count===300000,'SG_BUSINESS_NATIVE_FULL_COUNT');return {count,recordsHash:hash.digest('hex')};
}
