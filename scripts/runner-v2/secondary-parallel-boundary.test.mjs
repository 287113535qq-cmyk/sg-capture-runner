import test from 'node:test';import assert from 'node:assert/strict';
import {parallelPrimary,observationPrimary,rhinoTwoPrimary,secondaryRepository,secondaryParallelBoundary,checkPrimaryReadonlyEvidence} from './secondary-parallel-boundary.mjs';
import {original} from './expired-run-review.mjs';import {stalled,revokedMarker} from './demo-run-fence.mjs';
function fixture(p=parallelPrimary){
 const id=123,commit='a'.repeat(40),path='.github/workflows/demo-maintenance.yml',runs=[{repository:secondaryRepository,id,commit,path,status:'in_progress'},
  ...[p,original,stalled].map(x=>({...x,path:'.github/workflows/trial-300k.yml',status:x===p?'in_progress':'queued'}))].map(x=>({...x,head_sha:x.commit,run_attempt:1,event:'workflow_dispatch',conclusion:null,repository:{full_name:x.repository}}));
 const evidence={journal:p===rhinoTwoPrimary?[{_id:`primary/count-run:${p.trialId}:${p.id}:1`,value:{schema:'sg-count-run-v1',activation:p.activation,profileHash:p.profileHash,commit:p.commit,run:p.id+':1'}}]:[],state:[{_id:'primary/campaign',value:{group:'primary',enabled:true,activeGame:p.gameId,validationLimit:0,formalCount:{activation:p.activation,trialId:p.trialId,profileHash:p.profileHash},demoRunRevoked:revokedMarker}},
  {_id:'primary/pool:'+p.trialId,value:{enabled:true,countAllocation:{},workers:{0:{leaseUntil:1000,owner:p.id+':1:formal-capture:fixture'}}}},
  {_id:`primary/capture-run:${p.id}:1`,value:{gameId:p.gameId}}]};
 const jobs=[{name:'formal-admit',status:'completed',conclusion:'success'},...Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'in_progress',conclusion:null}))];
 let other=false,oldJob=false,truncated=false,hold=false,late=false;
 const read=async q=>{const repo=q.split('/actions/')[0].slice(6);if(q.includes('runs?')){const status=new URL('https://test/'+q).searchParams.get('status'),found=runs.filter(r=>r.repository.full_name===repo&&r.status===status);
  if(other&&repo===secondaryRepository&&status==='queued')found.push({...runs[0],id:456,status});return {total_count:truncated?100:found.length,workflow_runs:found};}
  const rid=Number(q.match(/runs\/(\d+)/)[1]);if(q.includes('/jobs?')){const list=rid===p.id?jobs:oldJob?[{name:'old'}]:[];return {total_count:list.length,jobs:list};}return runs.find(r=>r.id===rid);};
 const transport={request:async op=>op===(p.operation??'parallel_primary_boundary')?evidence:[{value:{active:hold}},{value:{active:false}}]};
 return {args:{read,transport,run:id+':1',commit,primaryRun:p,now:()=>late?40000:100},evidence,jobs,runs,set:k=>{if(k==='other')other=true;if(k==='oldJob')oldJob=true;if(k==='truncated')truncated=true;if(k==='hold')hold=true;}};
}
test('secondary boundary admits only pinned healthy primary and exact old queued jobs0',async()=>{await secondaryParallelBoundary(fixture().args)();});
test('other activity old jobs truncation main failure or wrong identity all refuse',async()=>{
 for(const reason of ['other','oldJob','truncated','hold','mainFail','identity','worker','oldWrites','marker']){const f=fixture();f.set(reason);
  if(reason==='mainFail')Object.assign(f.jobs[1],{status:'completed',conclusion:'failure'});if(reason==='identity')f.runs[1].head_sha='b'.repeat(40);
  if(reason==='worker')f.evidence.state[1].value.workers[20]={leaseUntil:1000,owner:'other'};
  if(reason==='oldWrites')f.evidence.journal.push({});if(reason==='marker')f.evidence.state[0].value.demoRunRevoked={};
  await assert.rejects(secondaryParallelBoundary(f.args)(),undefined,reason);
 }
});
test('cross-group evidence rejects omissions duplicate ids and unrelated pool/run',()=>{
 for(const reason of ['missing','duplicate','scope','bound']){const f=fixture();if(reason==='missing')f.evidence.state.pop();if(reason==='duplicate')f.evidence.state[2]=f.evidence.state[1];if(reason==='scope')f.evidence.state[1]._id='secondary/pool:other';if(reason==='bound')f.evidence.state[2].value.gameId=32714;assert.throws(()=>checkPrimaryReadonlyEvidence(f.evidence,100));}
});

test('GitHub display names are capture-N while owners retain the formal-capture job id',async()=>{
 const f=fixture();assert.equal(f.jobs[1].name,'capture-0');assert.match(f.evidence.state[1].value.workers[0].owner,/:formal-capture:/);
 await secondaryParallelBoundary(f.args)();f.jobs[1].name='formal-capture-0';await assert.rejects(secondaryParallelBoundary(f.args)(),/PRIMARY_JOBS_CHANGED/);
});

test('reviewed observation run has a distinct fixed readonly scope',async()=>{
 const f=fixture(observationPrimary);await secondaryParallelBoundary(f.args)();
 assert.throws(()=>secondaryParallelBoundary({...f.args,primaryRun:{...observationPrimary}}),/REVIEWED_RUN_REQUIRED/);
 await assert.rejects(secondaryParallelBoundary({...f.args,primaryRun:parallelPrimary})());
 checkPrimaryReadonlyEvidence(f.evidence,100,observationPrimary);
 assert.throws(()=>checkPrimaryReadonlyEvidence(f.evidence,100),/EVIDENCE_SCOPE/);
});

test('Rhino two lanes requires exact count permission and permits only reviewed worker ranges',async()=>{
 const f=fixture(rhinoTwoPrimary);f.evidence.state[1].value.workers[40]={leaseUntil:1000,owner:rhinoTwoPrimary.id+':1:formal-capture:fixture'};
 await secondaryParallelBoundary(f.args)();
 for(const reason of ['permission','worker','owner']){const bad=fixture(rhinoTwoPrimary);
  if(reason==='permission')bad.evidence.journal[0].value.profileHash='b'.repeat(64);
  if(reason==='worker')bad.evidence.state[1].value.workers[60]={leaseUntil:1000,owner:rhinoTwoPrimary.id+':1:formal-capture:fixture'};
  if(reason==='owner')bad.evidence.state[1].value.workers[0].owner='another-run';
  await assert.rejects(secondaryParallelBoundary(bad.args)(),undefined,reason);
 }
});

test('ended Rhino coexistence requires all capture jobs successful and explicit reviewed scope',async()=>{
 const f=fixture(rhinoTwoPrimary);Object.assign(f.runs[1],{status:'completed',conclusion:'success'});
 f.jobs.forEach(j=>Object.assign(j,{status:'completed',conclusion:'success'}));
 await assert.rejects(secondaryParallelBoundary(f.args)(),/IDENTITY_CHANGED/);
 await secondaryParallelBoundary({...f.args,allowEndedPrimary:true})();
 f.jobs[1].conclusion='failure';await assert.rejects(secondaryParallelBoundary({...f.args,allowEndedPrimary:true})(),/JOBS_CHANGED/);
 assert.throws(()=>secondaryParallelBoundary({...fixture().args,allowEndedPrimary:true}),/ENDED_SCOPE/);
});

test('precisely audited parent tail failure permits settled peer and caches immutable log proof',async()=>{
 const f=fixture(rhinoTwoPrimary);Object.assign(f.runs[1],{status:'completed',conclusion:'failure'});
 f.jobs.filter(j=>j.name.startsWith('capture-')).forEach(j=>Object.assign(j,{status:'completed',conclusion:'failure'}));
 f.jobs.push({name:'verify',status:'completed',conclusion:'success'});
 const pool=f.evidence.state[1].value;pool.confirmed=18694;pool.countAllocation.reserved=0;pool.workers[0].leaseUntil=0;
 f.evidence.journal[0].value.completeBefore=8320;
 const evidence={schema:'sg-known-parent-tail-failure-v1',sourceRun:rhinoTwoPrimary.id+':1',sourceCommit:rhinoTwoPrimary.commit,
  logSha256:'228dbb93491cd97660dd8de5dffb00953bb541ad0093e1ad25c8b61dbe4e4663',distinctWorkers:40,childComplete:10374,sourceErrors:0,parentError:'CONCURRENT_PARENT_GATEWAY_READ'};
 let reads=0;const check=secondaryParallelBoundary({...f.args,allowEndedPrimary:true,readTailProof:()=>{reads++;return evidence;}});
 await check();await check();assert.equal(reads,1);
 pool.countAllocation.reserved=1;await assert.rejects(check(),/PARENT_FAILURE_UNSETTLED/);pool.countAllocation.reserved=0;
 pool.workers[0].activeBatch={id:1};await assert.rejects(check(),/PARENT_FAILURE_UNSETTLED/);
});
