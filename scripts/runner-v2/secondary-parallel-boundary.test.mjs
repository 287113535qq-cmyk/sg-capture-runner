import test from 'node:test';import assert from 'node:assert/strict';
import {parallelPrimary as p,secondaryRepository,secondaryParallelBoundary,checkPrimaryReadonlyEvidence} from './secondary-parallel-boundary.mjs';
import {original} from './expired-run-review.mjs';import {stalled,revokedMarker} from './demo-run-fence.mjs';
function fixture(){
 const id=123,commit='a'.repeat(40),path='.github/workflows/demo-maintenance.yml',runs=[{repository:secondaryRepository,id,commit,path,status:'in_progress'},
  ...[p,original,stalled].map(x=>({...x,path:'.github/workflows/trial-300k.yml',status:x===p?'in_progress':'queued'}))].map(x=>({...x,head_sha:x.commit,run_attempt:1,event:'workflow_dispatch',conclusion:null,repository:{full_name:x.repository}}));
 const evidence={journal:[],state:[{_id:'primary/campaign',value:{group:'primary',enabled:true,activeGame:32795,validationLimit:0,formalCount:{activation:p.activation,trialId:p.trialId,profileHash:p.profileHash},demoRunRevoked:revokedMarker}},
  {_id:'primary/pool:'+p.trialId,value:{enabled:true,countAllocation:{},workers:{0:{leaseUntil:1000,owner:p.id+':1:formal-capture:fixture'}}}},
  {_id:`primary/capture-run:${p.id}:1`,value:{gameId:32795}}]};
 const jobs=[{name:'formal-admit',status:'completed',conclusion:'success'},...Array.from({length:20},(_,i)=>({name:'formal-capture-'+i,status:'in_progress',conclusion:null}))];
 let other=false,oldJob=false,truncated=false,hold=false,late=false;
 const read=async q=>{const repo=q.split('/actions/')[0].slice(6);if(q.includes('runs?')){const status=new URL('https://test/'+q).searchParams.get('status'),found=runs.filter(r=>r.repository.full_name===repo&&r.status===status);
  if(other&&repo===secondaryRepository&&status==='queued')found.push({...runs[0],id:456,status});return {total_count:truncated?100:found.length,workflow_runs:found};}
  const rid=Number(q.match(/runs\/(\d+)/)[1]);if(q.includes('/jobs?')){const list=rid===p.id?jobs:oldJob?[{name:'old'}]:[];return {total_count:list.length,jobs:list};}return runs.find(r=>r.id===rid);};
 const transport={request:async op=>op==='parallel_primary_boundary'?evidence:[{value:{active:hold}},{value:{active:false}}]};
 return {args:{read,transport,run:id+':1',commit,now:()=>late?40000:100},evidence,jobs,runs,set:k=>{if(k==='other')other=true;if(k==='oldJob')oldJob=true;if(k==='truncated')truncated=true;if(k==='hold')hold=true;}};
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
