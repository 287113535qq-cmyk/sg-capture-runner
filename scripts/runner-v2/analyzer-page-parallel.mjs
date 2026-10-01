import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// Two independent Python pipes, bounded by the existing 100-record/6 MiB page.
// Wait for both receipts even on failure; no partial or out-of-order completion.
export async function verifyParallelEnvelope(primary,secondary,request){
 const rows=request.records;
 assert(request.op==='verify_batch'&&Array.isArray(rows)&&rows.length>0&&rows.length<=100,'ANALYZER_PAGE_SIZE');
 assert(new Set(rows.map(r=>r._id)).size===rows.length,'ANALYZER_PAGE_DUPLICATE');
 assert(rows.every((r,i)=>Number.isSafeInteger(r.sequence)&&r.sequence>0&&(!i||r.sequence>rows[i-1].sequence)),'ANALYZER_PAGE_SEQUENCE');
 if(rows.length===1)return primary.call(request);
 const middle=Math.ceil(rows.length/2),chunks=[rows.slice(0,middle),rows.slice(middle)];
 const results=await Promise.allSettled([primary,secondary].map((parser,i)=>parser.call({...request,records:chunks[i]})));
 for(const [i,result] of results.entries()){
  if(result.status==='rejected')throw result.reason;
  assert(result.value?.verified===true&&result.value.count===chunks[i].length
   &&result.value.idsHash===hash(chunks[i].map(r=>[r._id,r.contentHash])),'ANALYZER_PAGE_UNVERIFIED');
 }
 return {verified:true,count:rows.length,idsHash:hash(rows.map(r=>[r._id,r.contentHash]))};
}
