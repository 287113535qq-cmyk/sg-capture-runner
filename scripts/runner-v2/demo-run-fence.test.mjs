import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {maintenanceBoundary,revokeQueuedDemo,stalled,revokedMarker} from './demo-run-fence.mjs';
import {original} from './expired-run-review.mjs';import {protocolHash as hash} from './protocol-resume.mjs';import {githubBoundary} from './github-boundary.mjs';
import {fixture} from './demo-rollover.test.mjs';import {rolloverDemo} from './demo-rollover.mjs';
const commit='e'.repeat(40),run='999:1',now=()=>Date.now(),oldProfile=JSON.parse(fs.readFileSync('config/demo-pilot-beaver-20260930.json','utf8'));
function boundaryFixture(mode){
 const old={id:stalled.id,head_sha:stalled.commit,run_attempt:1,repository:{full_name:stalled.repository},event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',status:'queued',conclusion:null};
 const ghost={...old,id:original.id,head_sha:original.commit};
 const self={...old,id:999,head_sha:commit,path:'.github/workflows/demo-maintenance.yml',status:'in_progress'};
 let lists=0;
 const read=async path=>{
  if(path.includes('/actions/runs?')){lists++;const rows=path.includes('zyzuoyang/')?(path.includes('status=queued')?[ghost,old]:path.includes('status=in_progress')?[self]:[]):[];if(mode==='other'&&path.includes('status=waiting'))rows.push({id:123});return {total_count:rows.length,workflow_runs:rows};}
  if(path.endsWith('/999'))return {...self,...(mode==='self'?{status:'queued'}:{})};
  if(path.includes('/jobs?'))return path.includes('/'+stalled.id+'/')&&(mode==='job'||mode==='late'&&lists>0)?{total_count:1,jobs:[{}]}:{total_count:0,jobs:[]};
  if(path.endsWith('/'+stalled.id))return {...old,...(mode==='identity'?{head_sha:'f'.repeat(40)}:{})};
  return ghost;
 };
 const store={getMany:async()=>[mode==='stage'?{}:null,null,null,null]};
 return {read,store,go:maintenanceBoundary({read,store,oldProfile,run,commit,now})};
}
test('active independent maintenance isolates only the exact unstarted run',async()=>{await boundaryFixture().go();});
for(const mode of ['self','job','late','identity','stage','other'])test('fence rejects '+mode,async()=>{await assert.rejects(boundaryFixture(mode).go());});
test('old running boundary rejects the active independent maintenance',async()=>{await assert.rejects(githubBoundary({read:boundaryFixture().read,run:stalled.id+':1',commit:stalled.commit,now})(),/OTHER_RUN_ACTIVE/);});
function fenceFixture(){
 const f=fixture();f.args.store.cas=async(c,k,b,v)=>{assert.deepEqual(f.get(c,k),b);f.docs.set(c+'/'+k,{value:structuredClone(v)});return f.get(c,k);};
 const args={store:f.args.store,boundary:async()=>{},expectedCampaignHash:hash(f.get('state','campaign').value),commit,run,now};return {f,args};
}
test('revocation preserves old data, rejects frozen old snapshot, and allows one new generation',async()=>{
 const {f,args}=fenceFixture(),before=new Map([...f.docs].map(([k,v])=>[k,hash(v)]));await revokeQueuedDemo(args);
 assert.deepEqual(f.get('state','campaign').value.demoRunRevoked,revokedMarker);
 for(const [k,v] of before)if(k!=='state/campaign')assert.equal(hash(f.docs.get(k)),v);
 await assert.rejects(rolloverDemo(f.args),/ROLLOVER_SNAPSHOT_CHANGED/);
 f.args.expected=hash({campaign:f.get('state','campaign').value,pool:f.get('state','pool:'+f.args.plan.trialId).value,fromPool:f.get('state','pool:'+f.args.fromPlan.trialId).value});
 await rolloverDemo(f.args);assert.equal(f.get('state','campaign').value.activeGame,32820);assert.equal((await f.admission()).result.limit,5);
 await assert.rejects(revokeQueuedDemo(args),/FENCE_ALREADY_STARTED/);
});
test('late job and CAS conflict never complete a revocation or authorize capture',async()=>{
 for(const mode of ['late','cas']){const {f,args}=fenceFixture();let n=0;args.boundary=async()=>assert(!(mode==='late'&&++n===2),'LATE_JOB');if(mode==='cas')args.store.cas=async()=>null;
 await assert.rejects(revokeQueuedDemo(args));assert(!f.get('journal','demo-run-revoked:'+stalled.id+':complete'));assert(!f.get('state','campaign').value.demoRunRevoked);
 await assert.rejects(f.admission());await assert.rejects(revokeQueuedDemo({...args,boundary:async()=>{}}),/FENCE_ALREADY_STARTED/);
 }
});
