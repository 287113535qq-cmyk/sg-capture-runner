import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {importParkedDemo} from './parked-import.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
import {nextDemoGame} from './demo-next-game.mjs';import {receiptKey} from './durable-queue.mjs';
function fixture(){
 const plan={trialId:'import-fixture',gameId:32720,buy:0,phase:1},archive=Buffer.from('synthetic frozen archive'),archiveHash=createHash('sha256').update(archive).digest('hex');
 const campaign={activeGame:32835,games:[{game_id:32720,status:'parked-protocol'}]},record={trialId:plan.trialId,sequence:1,_id:'synthetic'};
 const decoded={archiveHash,records:[record],pending:[{sequence:2}],mongoMatched:1,states:[{key:'pool:'+plan.trialId,value:{enabled:false,planHash:hash(plan),nextBatchId:2,workers:{}}},{key:'batch:'+plan.trialId+':1',value:{id:1}}]};
 const spec={schema:'sg-parked-import-v1',trialId:plan.trialId,planHash:hash(plan),archiveHash,bytes:archive.length,complete:1,mongoCount:1,pending:1,campaignHash:hash(campaign),mongoHash:hash([record]),statesHash:hash(decoded.states),recordsHash:hash(decoded.records)};
 const profile={schema:'sg-demo-next-game-v1',gameId:32720,fromGameId:32835,oldPlanHash:hash(plan),createdAt:0,expiresAt:7200000,completePreserved:1,abandonedAttempts:1,legacyImport:spec};
 const docs=new Map([['state/campaign',{value:campaign}]]);let calls=0,fail=null,late=Infinity,corrupt=false,decodeCalls=0;
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),getMany:async(c,ks)=>ks.map(k=>structuredClone(docs.get(c+'/'+k))),writable:async()=>{},create:async(c,k,v)=>{assert(k!==fail,'WRITE_FAILURE');assert(!docs.has(c+'/'+k),'EXISTS');docs.set(c+'/'+k,{value:structuredClone(v)});}};
 const transport={request:async(op,p)=>{if(op==='frozen_trial_bytes')return {offset:p.offset,size:archive.length,sha256:archiveHash,data:(corrupt?Buffer.from('corrupt'):archive).toString('base64')};assert.equal(op,'rounds_scan');return p.after?[]:[record];}};
 const args={store,transport,decode:async()=>{decodeCalls++;return structuredClone(decoded);},plan,profile,boundary:async()=>{assert(++calls!==late,'LATE_JOB');},commit:'a'.repeat(40),run:'1:1',now:()=>100};
 const key=`import-parked-demo:${plan.trialId}:${archiveHash.slice(0,16)}`;
 return {args,docs,decoded,key,spec,fail:k=>fail=k,late:n=>late=n,corrupt:()=>corrupt=true,get decodeCalls(){return decodeCalls;}};
}
test('parked import publishes verified evidence into disabled pool then final receipt, never Mongo writes',async()=>{
 const f=fixture(),r=await importParkedDemo(f.args);assert.equal(r.newBetAllowance,0);assert.equal(r.sourceRequests,0);
 assert.equal(f.docs.get('state/pool:import-fixture').value.enabled,false);assert(f.docs.has('journal/'+receiptKey('import-fixture',1)));
 assert.equal([...f.docs.keys()].at(-1),'journal/'+f.key+':complete');await assert.rejects(importParkedDemo(f.args),/ALREADY_STARTED/);
});
test('archive or Mongo or decoder mismatch refuses before creating any evidence',async()=>{
 for(const reason of ['archive','mongo','decoder','scope','campaign']){const f=fixture();
  if(reason==='archive')f.corrupt();if(reason==='mongo')f.spec.mongoHash='0'.repeat(64);if(reason==='decoder')f.decoded.records[0].sequence=2;
  if(reason==='scope')f.args.profile.expiresAt=10;if(reason==='campaign')f.docs.get('state/campaign').value.activeGame=1;
  await assert.rejects(importParkedDemo(f.args));assert.equal(f.docs.size,1);
 }
});
test('late job at each write boundary blocks final import, partial writes never auto retry',async()=>{
 for(const at of [1,2,3,4]){const f=fixture();f.late(at);await assert.rejects(importParkedDemo(f.args),/LATE_JOB/);
  assert(!f.docs.has('journal/'+f.key+':complete'));
  if(at>2)await assert.rejects(importParkedDemo(f.args),/ALREADY_STARTED/);
 }
});
test('partial receipt, state, or final write cannot produce a usable complete import',async()=>{
 for(const suffix of [receiptKey('import-fixture',1),'batch:import-fixture:1','pool:import-fixture','complete']){const f=fixture();f.fail(suffix==='complete'?f.key+':complete':suffix);
  await assert.rejects(importParkedDemo(f.args),/WRITE_FAILURE/);assert(!f.docs.has('journal/'+f.key+':complete'));
  await assert.rejects(importParkedDemo(f.args),/ALREADY_STARTED/);
 }
});
test('preexisting state or record is never overwritten by import',async()=>{
 for(const key of ['state/batch:import-fixture:1','journal/'+receiptKey('import-fixture',1)]){const f=fixture();f.docs.set(key,{value:{existing:true}});
  const before=hash([...f.docs]);await assert.rejects(importParkedDemo(f.args),/EXISTS/);assert.equal(hash([...f.docs]),before);
 }
});
