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
