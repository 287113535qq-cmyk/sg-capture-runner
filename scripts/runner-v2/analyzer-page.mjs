import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// Batch only the private IPC envelope; Python still independently validates
// every complete record using its existing single-record validator.
export async function verifyAnalyzerPage(parser,plan,records){
 assert(Array.isArray(records)&&records.length>0&&records.length<=100,'ANALYZER_PAGE_SIZE');
 const limit=6*1024*1024,base=Buffer.byteLength(JSON.stringify({op:'verify_batch',plan,records:[]}))+1;
 let chunk=[],bytes=base,count=0;
 async function flush(){
  if(!chunk.length)return;
  const result=await parser.call({op:'verify_batch',plan,records:chunk});
  assert(result?.verified===true&&result.count===chunk.length
   &&result.idsHash===hash(chunk.map(r=>[r._id,r.contentHash])),'ANALYZER_PAGE_UNVERIFIED');
  count+=chunk.length;chunk=[];bytes=base;
 }
 for(const record of records){
  const size=Buffer.byteLength(JSON.stringify(record))+1;
  assert(base+size<=limit,'ANALYZER_PAGE_RECORD_TOO_LARGE');
  if(bytes+size>limit)await flush();
  chunk.push(record);bytes+=size;
 }
 await flush();assert(count===records.length,'ANALYZER_PAGE_INCOMPLETE');
 return {verified:true,count};
}
