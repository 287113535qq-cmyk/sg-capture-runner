import assert from 'node:assert/strict';

// Ten fixed pairs on one diagnostic document. No game pool or round access.
export async function metadataIoCanary(store,key){
 assert(/^validation:[0-9]{1,20}:[0-9]{1,4}:delta$/.test(key),'IO_CANARY_KEY');
 const history=Array.from({length:1024},(_,i)=>({id:i,proof:'a'.repeat(700)}));
 let before=await store.get('state',key);assert(before,'IO_CANARY_MISSING');
 store.deltaCas=false;
 before=await store.cas('state',key,before,{...before.value,history,lease:0});assert(before,'IO_CANARY_SETUP_CONFLICT');
 const samples={full:[],delta:[]};let changes=0;
 for(let pair=0;pair<10;pair++)for(const mode of (pair%2?['delta','full']:['full','delta'])){
  before=await store.get('state',key);
  assert(before?.value.lease===changes,'IO_CANARY_CHANGED');
  store.deltaCas=mode==='delta';
  const next={...before.value,lease:changes+1},start=performance.now();
  const after=await store.cas('state',key,before,next);assert(after,'IO_CANARY_CONFLICT');
  samples[mode].push(performance.now()-start);changes++;
 }
 const final=await store.get('state',key);assert.equal(final.value.lease,20);assert.deepEqual(final.value.history,history);
 const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
 return {fixtureOnly:true,pairs:10,fullCasMedianMs:median(samples.full),deltaCasMedianMs:median(samples.delta),
  samples,fullReadback:true,sourceRequests:0,gamePoolWrites:0,officialRoundWrites:0,gameThroughputVerified:false};
}
