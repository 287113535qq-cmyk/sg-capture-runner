import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';

// Reuse only successful independent verification of the complete plan and page
// content during one game operation. Every caller still reads its full DB page.
// Keep only SHA-256 fingerprints and receipts, never raw records or a durable
// cache. Changed XML, amounts, metadata, ordering or plan all require a recheck.
export function createNativePageVerificationCache({verify,maxPages=4096}){
 assert(typeof verify==='function'&&Number.isSafeInteger(maxPages)&&maxPages>=1&&maxPages<=4096,'SG_NATIVE_VERIFICATION_CACHE');
 const pages=new Map();let hits=0,checks=0;
 const fingerprint=(plan,records)=>createHash('sha256').update(stable({plan,records})).digest('hex');
 return {
  async verify(plan,records){
   assert(Array.isArray(records)&&records.length>0&&records.length<=100,'SG_NATIVE_VERIFICATION_PAGE');
   const key=fingerprint(plan,records),saved=pages.get(key);
   if(saved){pages.delete(key);pages.set(key,saved);hits++;return structuredClone(saved);}
   checks++;
   const receipt=await verify(plan,records);
   assert(receipt?.verified===true&&receipt.count===records.length,'SG_NATIVE_VERIFICATION_INCOMPLETE');
   assert(fingerprint(plan,records)===key,'SG_NATIVE_VERIFICATION_INPUT_CHANGED');
   const complete={verified:true,count:records.length};
   pages.set(key,complete);
   if(pages.size>maxPages)pages.delete(pages.keys().next().value);
   return structuredClone(complete);
  },
  status:()=>({pages:pages.size,hits,checks,maxPages}),
 };
}

// A controller owns at most one game's bounded cache. Switching games,
// completing, blocking or closing drops the previous fingerprints entirely.
export function createGameNativePageVerificationCache({verify,maxPages=4096}){
 assert(typeof verify==='function','SG_NATIVE_VERIFICATION_CACHE');
 let gameKey=null,current=null;
 return {
  verify(key,plan,records){
   assert(typeof key==='string'&&key.length>0,'SG_NATIVE_VERIFICATION_GAME');
   if(gameKey!==key){gameKey=key;current=createNativePageVerificationCache({verify,maxPages});}
   return current.verify(plan,records);
  },
  release(key){if(key===undefined||key===gameKey){gameKey=null;current=null;}},
  status:()=>({gameKey,...(current?.status()??{pages:0,hits:0,checks:0,maxPages})}),
 };
}
