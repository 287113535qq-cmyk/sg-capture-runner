import test from 'node:test';import assert from 'node:assert/strict';
import {fenceJoblessCount,joblessFencedRead,joblessCount as fixed,joblessKey} from './count-jobless-fence.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const pool={enabled:true,failure:null,confirmed:52897,countAllocation:{reserved:0,batches:{1:{closed:true}}},workers:{0:{activeBatch:null,leaseUntil:0}}},campaign={activeGame:32799},activation='a'.repeat(64),runtimeKey=`count-runtime:${fixed.trialId}:${activation}:${fixed.commit}`;
 const docs=new Map([['state/pool:'+fixed.trialId,{value:pool}],['state/campaign',{value:campaign}],['journal/'+runtimeKey,{value:{schema:'sg-count-runtime-v2',commit:fixed.commit,revisionHash:fixed.revisionHash,completePreserved:52897,newBetAllowance:0}}]]);
 const run={id:fixed.id,run_attempt:1,head_sha:fixed.commit,repository:{full_name:fixed.repository},event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',status:'queued',conclusion:null},jobs={total_count:0,jobs:[]};
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)??null),create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));docs.set(c+'/'+k,{value:structuredClone(v)});}};
 const read=async p=>p.includes('/jobs?')?jobs:p.includes('/actions/runs?')?{total_count:1,workflow_runs:[run]}:run;
 const profile={schema:'sg-count-jobless-fence-profile-v1',sourceRun:fixed.id+':1',sourceCommit:fixed.commit,sourceRevisionHash:fixed.revisionHash,trialId:fixed.trialId,activation,runtimeKey,completePreserved:52897,newBetAllowance:0,poolHash:hash(pool),campaignHash:hash(campaign),createdAt:1,expiresAt:10000};
 return {docs,store,read,run,jobs,profile,args:{store,read,profile,commit:'b'.repeat(40),run:'999:1',boundary:async()=>{},now:()=>100}};
}
test('exact jobless tombstone denies old immutable admission, preserves pool quota and permits only completed revocation filtering',async()=>{
 const f=fixture(),oldPool=hash(f.docs.get('state/pool:'+fixed.trialId)),oldCampaign=hash(f.docs.get('state/campaign'));
 await assert.rejects(joblessFencedRead(f)('repos/'+fixed.repository+'/actions/runs?status=queued'),/REVOCATION_REQUIRED/);
 const result=await fenceJoblessCount(f.args);assert.equal(result.newBetAllowance,0);assert.equal(result.sourceRequests,0);
 assert.equal(f.docs.get('journal/'+joblessKey).value.schema,'sg-count-run-revoked-v1');
 // Old formal admission checks absence of this exact key before writing any source permit.
 await assert.rejects(async()=>assert(!(await f.store.get('journal',joblessKey)),'FORMAL_COUNT_RUN_ALREADY_ADMITTED'),/RUN_ALREADY_ADMITTED/);
 assert.equal(hash(f.docs.get('state/pool:'+fixed.trialId)),oldPool);assert.equal(hash(f.docs.get('state/campaign')),oldCampaign);
 assert.equal((await joblessFencedRead(f)('repos/'+fixed.repository+'/actions/runs?status=queued')).total_count,0);
 await assert.rejects(fenceJoblessCount(f.args),/ALREADY_USED/);
});
for(const mode of ['job-created','head-changed','run-started','already-admitted','live-lease','reserved','pool-changed','runtime-changed'])test('jobless revocation refuses '+mode,async()=>{
 const f=fixture();if(mode==='job-created')f.jobs.total_count=1;if(mode==='head-changed')f.run.head_sha='c'.repeat(40);if(mode==='run-started')f.run.status='in_progress';if(mode==='already-admitted')f.docs.set('journal/'+joblessKey,{value:{schema:'sg-count-run-v1'}});
 if(mode==='live-lease')f.docs.get('state/pool:'+fixed.trialId).value.workers[0].leaseUntil=999;if(mode==='reserved')f.docs.get('state/pool:'+fixed.trialId).value.countAllocation.reserved=1;if(mode==='pool-changed')f.profile.poolHash='f'.repeat(64);if(mode==='runtime-changed')f.docs.get('journal/'+f.profile.runtimeKey).value.revisionHash='f'.repeat(64);
 await assert.rejects(fenceJoblessCount(f.args));assert(!f.docs.has('journal/'+`count-jobless-revocation:${fixed.trialId}:${fixed.id}:1:complete`));
});
test('unknown jobless identities and pagination are never silently excluded',async()=>{
 const f=fixture();f.run.id=fixed.id+1;assert.equal((await joblessFencedRead(f)('repos/'+fixed.repository+'/actions/runs?status=queued')).total_count,1);
 await assert.rejects(joblessFencedRead({...f,read:async()=>({total_count:100,workflow_runs:[]})})('repos/'+fixed.repository+'/actions/runs?status=queued'),/LIST/);
});
