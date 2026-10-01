import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

export async function metadataCompressionCanary(plain,compressed,key,{checkResource=async()=>{}}={}){
 assert(/^validation:[0-9]{1,20}:[0-9]{1,4}:delta$/.test(key),'COMPRESSION_CANARY_KEY');
 const baseline=await plain.get('state',key);assert(baseline,'COMPRESSION_CANARY_MISSING');
 const digest=hash(baseline);assert.equal(hash(await compressed.get('state',key)),digest,'COMPRESSION_CANARY_CHANGED');
 const samples={plain:[],compressed:[]};
 for(let pair=0;pair<10;pair++){
  await checkResource();
  for(const mode of (pair%2?['compressed','plain']:['plain','compressed'])){
   const store=mode==='plain'?plain:compressed,start=performance.now();
   const read=await store.get('state',key);samples[mode].push(performance.now()-start);
   assert.equal(hash(read),digest,'COMPRESSION_CANARY_CHANGED');
  }
 }
 const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
 return {fixtureOnly:true,pairs:10,applicationDocumentBytes:Buffer.byteLength(JSON.stringify(baseline)),
  plainReadMedianMs:median(samples.plain),compressedReadMedianMs:median(samples.compressed),samples,
  fullReadback:true,sourceRequests:0,mongoWrites:0,gamePoolWrites:0,officialRoundWrites:0,
  onWireBytesMeasured:false,gameThroughputVerified:false};
}
