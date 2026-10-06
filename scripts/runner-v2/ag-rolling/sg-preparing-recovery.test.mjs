import test from 'node:test';import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {verifyPreparingRecovery} from './sg-preparing-recovery.mjs';
function setup(){
 const activation='a'.repeat(64),commit='b'.repeat(40),run='123:1',queueId='queue';
 const target={activation,payload:{queueId,games:[{gameId:'32588',dbName:'sg_32588',campaignId:'sg_32588-queue',baseline:0,mongoUri:'sg-native://primary/sg_32588'}]},
  manifest:[{gameId:'32588',planHash:'p',adapterProofHash:'f'}],resume:{previousActivation:'c'.repeat(64),previousRun:'122:1',endedProofHash:'d'.repeat(64)}};
 const source={value:{owner:run,queueId,status:'preparing',activation,commit,expiresAt:9000},version:1};
 const started={value:{schema:'sg-ag-rolling-activation-v1',queueId,activation,profileHash:queueHash(target),commit,run,sourceRequests:0}};
 const workflow={id:123,run_attempt:1,head_sha:commit,status:'completed',conclusion:'failure',event:'workflow_dispatch',
  repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/trial-300k.yml'};
 const jobs={total_count:2,jobs:[{id:1,name:'ag-rolling-admit',status:'completed',conclusion:'failure'},
  {id:2,name:'AG rolling lane 1',status:'completed',conclusion:'skipped'}]};
 const profile={...structuredClone(target),activation:'e'.repeat(64),preparationRecovery:{schema:'sg-ag-preparing-recovery-v1',
  targetActivation:activation,targetRun:run,targetCommit:commit,targetProfileHash:queueHash(target),nativeSourceHash:queueHash(source.value)}};
 const state={source,started,permit:null,live:false,writes:0};
 const store={async get(c,key){if(key==='rolling-source')return state.source;if(key.endsWith(':complete'))return state.permit;return state.started;},
  async getMany(c,keys){return keys.map(()=>state.live?{value:{expiresAt:2000}}:null);},async create(){state.writes++;},async cas(){state.writes++;}};
 const args={profile,target,store,readEnded:async()=>workflow,readEndedJobs:async()=>jobs,now:()=>1000};
 return {args,state,workflow,jobs};
}
test('exact ended zero-source admission is sealed as evidence without changing tasks, leases, rounds or old profiles',async()=>{
 const {args,state}=setup(),old=structuredClone(args.target),result=await verifyPreparingRecovery(args);
 assert.deepEqual(result.source,state.source);assert.deepEqual(args.target,old);assert.equal(state.writes,0);
 assert.equal(result.receipt.sourceRequests,0);assert.equal(result.receipt.roundWrites,0);assert.equal(result.receipt.taskWrites,0);
 assert.equal(result.receipt.retainedTasksAndPrefixes,true);
});
test('a preparing claim cannot be recovered while its actor is active or any source job started',async()=>{
 for(const change of [s=>s.workflow.status='in_progress',s=>s.workflow.head_sha='f'.repeat(40),
  s=>s.jobs.jobs[1].conclusion='cancelled',s=>s.jobs.total_count=1]){
  const s=setup();change(s);await assert.rejects(verifyPreparingRecovery(s.args),/ACTOR_NOT_ENDED|SOURCE_JOB_STARTED/);assert.equal(s.state.writes,0);
 }
});
test('source permit, changed native owner, live lease, altered namespace or normalization hashes prevent recovery',async()=>{
 for(const change of [s=>s.state.permit={value:{}},s=>s.state.source.value.owner='124:1',s=>s.state.live=true,
  s=>s.args.profile.payload.games[0].campaignId='other',s=>s.args.profile.manifest[0].adapterProofHash='other']){
  const s=setup();change(s);await assert.rejects(verifyPreparingRecovery(s.args),/PERMIT_EXISTS|NATIVE_CHANGED|LIVE_LEASE|BINDING/);assert.equal(s.state.writes,0);
 }
});
test('an explicitly cancelled zero-source admission retains the same strict no-permit and no-source boundaries',async()=>{
 const s=setup();s.workflow.conclusion='cancelled';s.jobs.jobs[0].conclusion='cancelled';
 const proof=await verifyPreparingRecovery(s.args);assert.equal(proof.receipt.sourceJobsStarted,0);assert.equal(s.state.writes,0);
 for(const change of [x=>x.state.permit={value:{}},x=>x.state.live=true,x=>x.jobs.jobs[1].conclusion='cancelled',x=>x.workflow.status='in_progress',x=>x.workflow.conclusion='failure']){
  const x=setup();x.workflow.conclusion='cancelled';x.jobs.jobs[0].conclusion='cancelled';change(x);
  await assert.rejects(verifyPreparingRecovery(x.args));assert.equal(x.state.writes,0);
 }
});
test('only exact unstarted cancelled matrix/finalizer placeholders can accompany a cancelled admission',async()=>{
 function cancelled(){const s=setup();s.workflow.conclusion='cancelled';s.jobs.jobs[0].conclusion='cancelled';
  s.jobs.jobs.push(...['AG rolling lane ${{ matrix.lane }}','ag-rolling-finalize'].map((name,i)=>({id:3+i,name,status:'completed',conclusion:'cancelled',run_id:s.workflow.id,head_sha:s.workflow.head_sha,runner_id:null,runner_name:null,runner_group_id:null,steps:[]})));s.jobs.total_count=s.jobs.jobs.length;return s;}
 const s=cancelled();assert.equal((await verifyPreparingRecovery(s.args)).receipt.sourceJobsStarted,0);
 for(const change of [j=>j.runner_id=1,j=>delete j.runner_id,j=>j.runner_name='runner',j=>j.runner_group_id=1,j=>j.steps=[{name:'capture'}],j=>j.name='AG rolling lane 1',j=>j.run_id=124,j=>j.head_sha='f'.repeat(40)]){
  const s=cancelled();change(s.jobs.jobs[2]);await assert.rejects(verifyPreparingRecovery(s.args),/SOURCE_JOB_STARTED/);assert.equal(s.state.writes,0);
 }
});
