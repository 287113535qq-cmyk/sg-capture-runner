import test from 'node:test';import assert from 'node:assert/strict';
import {finalizePreparedEndedSource} from './prepared-ended-source.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const docs=new Map(),activation='a'.repeat(64),commit='b'.repeat(40);
 const plan={gameId:32714,trialId:'sg_r1_20260928_32714',phase:1,buy:0,target:300000,countAllocation:activation};
 const profile={schema:'sg-prepared-count-profile-v1',group:'primary',activation,planHash:hash(plan)};
 const authorization={group:'primary',activation,gameId:plan.gameId,trialId:plan.trialId,profileHash:hash(profile)};
 const set=(c,k,v)=>docs.set(c+'/'+k,{value:structuredClone(v)});
 const spec={schema:'sg-complete-count-v1',activation,commit,planHash:hash(plan),gameId:plan.gameId,trialId:plan.trialId,
  profileHash:hash(profile),target:300000,maxSequence:600000,firstSequence:1,baselineBatchCount:0,baselineHash:hash([])};
 set('journal',`complete-count:${plan.trialId}:${activation}`,spec);
 set('journal',`complete-count:${plan.trialId}:${activation}:complete`,{schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit});
 set('journal',`count-run:${plan.trialId}:55:1`,{schema:'sg-count-run-v1',activation,commit,run:'55:1',profileHash:hash(profile)});
 set('state','capture-run:55:1',{gameId:plan.gameId});
 set('state','pool:'+plan.trialId,{enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',drainingProtocol:true,confirmed:0,
  nextBatchId:2,nextSequence:101,workers:{0:{activeBatch:{id:1},leaseUntil:0}},
  countAllocation:{specHash:hash(spec),reserved:100,batches:{1:{id:1,worker:0,start:1,end:100,closed:false,complete:0,evidenceHash:null,sessionHash:'c'.repeat(64)}}}});
 set('state','campaign',{activeGame:plan.gameId,games:[{game_id:plan.gameId,status:'parking-protocol'}]});
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k))};let calls=0;
 const campaign={finalizeStoppedRun:async(key,opt)=>{
  assert.equal(key,'capture-run:55:1');assert.equal(opt.waitMs,0);calls++;
  set('state','campaign',{activeGame:null,games:[{game_id:plan.gameId,status:'parked-protocol',repairKey:'fixture-repair'}]});
  set('journal',`count-prepared-close:${plan.trialId}:55:1:complete`,{schema:'sg-count-prepared-close-v1',activation,sourceRun:'55:1',sourceCommit:commit,
   repairKey:'fixture-repair',completePreserved:0,unknownAttempts:0,sourceRequests:0,newBetAllowance:0});
 }};
 const ended={id:55,run_attempt:1,head_sha:commit,status:'completed',conclusion:'failure',repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/trial-300k.yml'};
 const jobs={total_count:20,jobs:Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'completed'}))};
 return{docs,set,calls:()=>calls,args:{store,campaign,plan,profile,authorization,ended,jobs,boundary:async()=>{},now:()=>10}};
}
test('ended prepared source closes once and does not wait, replay or grant quota',async()=>{
 const f=fixture(),r=await finalizePreparedEndedSource(f.args);
 assert.deepEqual(r,{closed:true,completePreserved:0,sourceRequests:0,newBetAllowance:0});
 assert.equal((await finalizePreparedEndedSource(f.args)).alreadyClosed,true);assert.equal(f.calls(),1);
});
function auditedFixture(){
 const f=fixture(),a=f.args,plan=a.plan,sessionHash='c'.repeat(64);
 const b={id:1,worker:0,start:1,end:300000,checkpoint:300000,journaled:300000,sessionHash,
  pending:null,pendingOriginal:null,bootstrapAwaiting:null,leaseUntil:0};
 const item={id:1,worker:0,start:1,end:300000,sessionHash,closed:true,complete:300000,evidenceHash:hash(b)};
 const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
 const spec=f.docs.get('journal/'+key).value;Object.assign(spec,{baselineBatchCount:1,baselineHash:hash([item]),firstSequence:300001});
 f.docs.get('journal/'+key+':complete').value.specHash=hash(spec);
 f.set('state','batch:'+plan.trialId+':1',b);
 f.set('state','pool:'+plan.trialId,{enabled:true,failure:null,planHash:hash(plan),confirmed:300000,nextBatchId:2,nextSequence:300001,
  workers:{0:{leaseUntil:0,activeBatch:null}},countAllocation:{specHash:hash(spec),reserved:0,batches:{1:item}}});
 f.set('state','campaign',{enabled:true,activeGame:plan.gameId,formalCount:{activation:plan.countAllocation},
  audit:{owner:'primary:55:1:3',until:100000,gameId:plan.gameId},games:[{game_id:plan.gameId,status:'ready',baseline:100}]});
 f.set('journal','game-audit:'+plan.trialId,{trialId:plan.trialId,planHash:hash(plan),fullReadback:300000,recordsHash:'d'.repeat(64)});
 const store=a.store;store.getMany=async(c,ks)=>Promise.all(ks.map(k=>store.get(c,k)));
 store.create=async(c,k,v)=>{assert(!f.docs.has(c+'/'+k));f.set(c,k,v);};
 store.update=async(c,k,fn)=>{const v=fn(structuredClone(f.docs.get(c+'/'+k).value));f.set(c,k,v);return store.get(c,k);};
 return f;
}
test('ended full audit completes once, retaining historical baseline and the immutable 300000 readback',async()=>{
 const f=auditedFixture(),a=f.args,proofBefore=hash(f.docs.get('journal/game-audit:'+a.plan.trialId));
 const r=await finalizePreparedEndedSource(a),c=f.docs.get('state/campaign').value;
 assert.equal(r.auditedComplete,true);assert.equal(r.fullReadback,300000);
 assert.equal(r.sourceRequests,0);assert.equal(r.newBetAllowance,0);assert.equal(c.games[0].baseline,100);
 assert.equal(c.games[0].confirmed,300000);assert.equal(c.games[0].status,'complete');assert.equal(c.activeGame,null);assert.equal(c.audit,null);
 assert.equal(hash(f.docs.get('journal/game-audit:'+a.plan.trialId)),proofBefore);assert.equal(f.calls(),0);
});
for(const cause of ['proof-missing','proof-count','proof-plan','producer','pending','lease','changed-scene'])
 test('ended audit finalization rejects '+cause+' without releasing ownership',async()=>{
  const f=auditedFixture(),a=f.args,trial=a.plan.trialId;
  if(cause==='proof-missing')f.docs.delete('journal/game-audit:'+trial);
  if(cause==='proof-count')f.docs.get('journal/game-audit:'+trial).value.fullReadback=299999;
  if(cause==='proof-plan')f.docs.get('journal/game-audit:'+trial).value.planHash='f'.repeat(64);
  if(cause==='producer')f.docs.get('state/campaign').value.audit.owner='primary:99:1:3';
  if(cause==='pending')f.docs.get('state/batch:'+trial+':1').value.pendingOriginal={awaiting:'unknown'};
  if(cause==='lease')f.docs.get('state/pool:'+trial).value.workers[0].leaseUntil=11;
  if(cause==='changed-scene'){let n=0;a.boundary=async()=>{if(++n===2)f.docs.get('state/campaign').value.audit.owner='changed';};}
  await assert.rejects(finalizePreparedEndedSource(a));
  assert.equal(f.docs.get('state/campaign').value.games[0].status,'ready');
  assert(!f.docs.has(`journal/prepared-audit-complete:${trial}:55:1:before`));
 });
for(const bad of ['running','wrong-owner','wrong-profile','wrong-permit','missing-job','late-lease','scene-changed','unknown-close'])
test('ended prepared source refuses '+bad,async()=>{
 const f=fixture(),a=f.args;
 if(bad==='running')a.ended.status='in_progress';
 if(bad==='wrong-owner')a.ended.repository.full_name='287113535qq-cmyk/sg-capture-runner';
 if(bad==='wrong-profile')a.authorization.profileHash='d'.repeat(64);
 if(bad==='wrong-permit')f.docs.get(`journal/count-run:${a.plan.trialId}:55:1`).value.commit='d'.repeat(40);
 if(bad==='missing-job')a.jobs.jobs.pop();
 if(bad==='late-lease')f.docs.get('state/pool:'+a.plan.trialId).value.workers[0].leaseUntil=11;
 if(bad==='scene-changed'){let n=0;a.boundary=async()=>{if(++n===2)f.docs.get('state/campaign').value.activeGame=null;};}
 if(bad==='unknown-close')f.set('journal',`count-prepared-close:${a.plan.trialId}:55:1:complete`,{schema:'unreviewed'});
 await assert.rejects(finalizePreparedEndedSource(a));assert.equal(f.calls(),0);
});
