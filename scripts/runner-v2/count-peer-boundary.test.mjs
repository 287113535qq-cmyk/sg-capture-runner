import test from 'node:test';import assert from 'node:assert/strict';
import {countPeerBoundary,checkCountPeerDescriptor,checkCountPeerEvidence,checkCountPeerHolds} from './count-peer-boundary.mjs';
import {original} from './expired-run-review.mjs';import {stalled,revokedMarker} from './demo-run-fence.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
const repos={primary:'zyzuoyang/sg-capture-runner',secondary:'287113535qq-cmyk/sg-capture-runner'};
test('display adapter retirement binds only the exact VeryFruity hold, with no source boundary permission',()=>{
 const hold={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'VERYFRUITY_ACTION_UNREVIEWED_EXIT',category:'source_protocol',trialId:'sg_r1_20261003_32812',cooldownUntil:0}};
 const rows=[{_id:'primary/global-hold',value:{active:false}},{_id:'secondary/global-hold',value:hold}];
 checkCountPeerHolds(rows,'secondary',hash(hold),hold.details.code,'source_protocol',false,true);
 assert.throws(()=>checkCountPeerHolds(rows,'secondary',hash(hold),hold.details.code,'source_protocol'));
 for(const cause of ['primary','code','category','trial','cooldown']){
  const r=structuredClone(rows);if(cause==='primary')r[0].value.active=true;
  if(cause==='code')r[1].value.details.code='INVALID_SOURCE_MONEY';
  if(cause==='category')r[1].value.details.category='storage';
  if(cause==='trial')r[1].value.details.trialId='sg_r1_20260928_32721';
  if(cause==='cooldown')r[1].value.details.cooldownUntil=1;
  assert.throws(()=>checkCountPeerHolds(r,'secondary',hash(r[1].value),hold.details.code,'source_protocol',false,true));
 }
});
test('bootstrap maintenance permits only its exact original storage hold, never an unrelated failure',()=>{
 const hold={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'VERYFRUITY_INIT_STAKES',category:'storage',trialId:'sg_r1_20261003_32812',cooldownUntil:0}};
 const rows=[{_id:'primary/global-hold',value:{active:false}},{_id:'secondary/global-hold',value:hold}];
 checkCountPeerHolds(rows,'secondary',hash(hold),'VERYFRUITY_INIT_STAKES','storage',true);
 for(const mutate of [h=>h.details.trialId='sg_r1_20260928_32721',h=>h.details.code='SOURCE_NETWORK_OUTCOME_UNKNOWN',h=>h.details.cooldownUntil=1]){
  const changed=structuredClone(rows);mutate(changed[1].value);
  assert.throws(()=>checkCountPeerHolds(changed,'secondary',hash(changed[1].value),'VERYFRUITY_INIT_STAKES','storage',true));
 }
 assert.throws(()=>checkCountPeerHolds(rows,'secondary',hash(hold),'VERYFRUITY_INIT_STAKES','storage',false));
});
function fixture(group='primary'){
 const selfGroup=group==='primary'?'secondary':'primary',peer={schema:'sg-count-peer-v1',group,repository:repos[group],
  gameId:group==='primary'?32799:32721,trialId:group==='primary'?'sg_r1_20261001_32799':'sg_r1_20260928_32721',
  run:'987654:1',commit:'a'.repeat(40),activation:'b'.repeat(64),profileHash:'c'.repeat(64),lanesPerHost:group==='primary'?2:1};
 const self={id:123,repository:{full_name:repos[selfGroup]},run_attempt:1,event:'workflow_dispatch',head_sha:'d'.repeat(40),
  path:'.github/workflows/demo-maintenance.yml',status:'in_progress',conclusion:null};
 const other={...self,id:987654,repository:{full_name:peer.repository},head_sha:peer.commit,path:'.github/workflows/trial-300k.yml'};
 const runs=[self,other,...[original,stalled].map(x=>({...self,id:x.id,repository:{full_name:x.repository},head_sha:x.commit,status:'queued',path:other.path}))];
 const spec={schema:'sg-complete-count-v1',activation:peer.activation,profileHash:peer.profileHash,gameId:peer.gameId,trialId:peer.trialId,
  target:group==='primary'?300000:299850,planHash:'e'.repeat(64),commit:'f'.repeat(40),...(group==='primary'?{sessionLayout:{lanesPerHost:2}}:{})};
 const permit={schema:'sg-count-run-v1',activation:peer.activation,profileHash:peer.profileHash,run:peer.run,commit:peer.commit,completeBefore:100,remainingComplete:spec.target-100};
 const complete={schema:'sg-complete-count-activation-v1',specHash:hash(spec),planHash:spec.planHash,trialId:peer.trialId,commit:spec.commit};
 const pool={enabled:true,confirmed:100,countAllocation:{specHash:hash(spec),reserved:0},workers:{[group==='primary'?0:20]:{leaseUntil:1000,owner:peer.run+':formal-capture:host'}}};
 const campaign={group,enabled:true,activeGame:peer.gameId,validationLimit:0,formalCount:{activation:peer.activation,profileHash:peer.profileHash,trialId:peer.trialId},...(group==='primary'?{demoRunRevoked:revokedMarker}:{})};
 const evidence={state:[{_id:group+'/campaign',value:campaign},{_id:group+'/pool:'+peer.trialId,value:pool},
  {_id:group+'/capture-run:'+peer.run,value:{gameId:peer.gameId}}],journal:[{_id:group+'/count-run:'+peer.trialId+':'+peer.run,value:permit},
  {_id:group+'/complete-count:'+peer.trialId+':'+peer.activation,value:spec},{_id:group+'/complete-count:'+peer.trialId+':'+peer.activation+':complete',value:complete}]};
 const jobs=[{name:group==='primary'?'formal-admit':'pyramids-formal-admit',status:'completed',conclusion:'success'},
  ...Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'in_progress',conclusion:null})),{name:'verify',status:'completed',conclusion:'success'}];
 const calls=[];const read=async path=>{
  if(path.includes('runs?')){const repository=path.split('/actions/')[0].slice(6),status=new URL('https://api.test/'+path).searchParams.get('status');
   const workflow_runs=runs.filter(r=>r.repository.full_name===repository&&r.status===status);return {total_count:workflow_runs.length,workflow_runs};}
  const id=Number(path.match(/runs\/(\d+)/)[1]);return path.includes('/jobs?')?{total_count:id===other.id?jobs.length:0,jobs:id===other.id?jobs:[]}:runs.find(r=>r.id===id);
 };
 let pending=false;
 const transport={request:async(op,args)=>{assert(!pending);pending=true;calls.push({op,args});await Promise.resolve();pending=false;
  return op==='global_holds'?[{_id:'primary/global-hold',value:{active:false}},{_id:'secondary/global-hold',value:{active:false}}]:evidence;}};
 return {args:{read,transport,peer,selfGroup,run:'123:1',commit:self.head_sha,workflowPath:self.path,now:()=>100},peer,pool,campaign,spec,permit,complete,evidence,jobs,runs,other,calls};
}
test('both directions accept only an immutable peer and serial native reads',async()=>{
 for(const group of ['primary','secondary']){const f=fixture(group);await countPeerBoundary(f.args)();assert.equal(f.calls.length,2);
  assert.deepEqual(f.calls[0].args,{run:f.peer.run,activation:f.peer.activation});assert.equal(f.calls[1].op,'global_holds');}
});

test('independent identity reads run in bounded waves and every boundary rereads them',async()=>{
 const f=fixture(),read=f.args.read;let active=0,peak=0,identities=0;
 f.args.read=async path=>{
  if(path.includes('runs?'))return read(path);
  identities++;active++;peak=Math.max(peak,active);
  try{await new Promise(resolve=>setTimeout(resolve,2));return await read(path);}finally{active--;}
 };
 const boundary=countPeerBoundary(f.args);await boundary();await boundary();
 assert.equal(peak,4);assert.equal(identities,14);assert.equal(active,0);
 assert.equal(f.calls.length,4);
});

test('failed identity read settles its whole wave and prevents native authorization',async()=>{
 const f=fixture(),read=f.args.read;let ended=0,active=0;
 f.args.read=async path=>{
  if(path.includes('runs?'))return read(path);
  active++;
  try{await new Promise(resolve=>setTimeout(resolve,2));
   if(path.includes('/'+original.id+'/jobs?'))throw new Error('read unavailable');
   return await read(path);
  }finally{active--;ended++;}
 };
 await assert.rejects(countPeerBoundary(f.args)(),/COUNT_PEER_IDENTITY_READ/);
 assert.equal(active,0);assert.equal(ended,4);assert.equal(f.calls.length,0);
});
test('peer scope rejects foreign game account attempt profile and lanes',()=>{
 const f=fixture();for(const delta of [{gameId:32795},{repository:repos.secondary},{run:'987654:2'},{commit:'bad'},{activation:'bad'},{profileHash:'bad'},{lanesPerHost:3}])
  assert.throws(()=>checkCountPeerDescriptor({...f.peer,...delta},'secondary'));
 assert.throws(()=>checkCountPeerDescriptor(f.peer,'primary'));
});
test('native evidence is independently bound to permission spec receipt and owner',()=>{
 for(const reason of ['permit','spec','receipt','owner','worker','scope','duplicate','marker']){const f=fixture();
  if(reason==='permit')f.permit.commit='9'.repeat(40);if(reason==='spec')f.spec.target++;if(reason==='receipt')f.complete.specHash='0'.repeat(64);
  if(reason==='owner')f.pool.workers[0].owner='another-run';if(reason==='worker')f.pool.workers[60]={leaseUntil:1000};
  if(reason==='scope')f.evidence.state[1]._id='primary/pool:other';if(reason==='duplicate')f.evidence.journal[2]=f.evidence.journal[1];
  if(reason==='marker')f.campaign.demoRunRevoked={};
  assert.throws(()=>checkCountPeerEvidence(f.evidence,f.peer,'in_progress',100),undefined,reason);
 }
});
test('other activity failed child changed identity and incomplete admission refuse',async()=>{
 for(const reason of ['other','failed','wrong','admission','queuedChild','duplicate']){const f=fixture();
  if(reason==='other')f.runs.push({...f.other,id:999});if(reason==='failed')Object.assign(f.jobs[1],{status:'completed',conclusion:'failure'});
  if(reason==='wrong')f.other.head_sha='9'.repeat(40);if(reason==='admission')f.jobs[0].conclusion='failure';
  if(reason==='queuedChild')f.jobs[1].status='queued';if(reason==='duplicate')f.jobs[2].name=f.jobs[1].name;
  await assert.rejects(countPeerBoundary(f.args)(),undefined,reason);
 }
});
test('ended healthy peer requires closed batches and no live lease; ended failure is never ignored',async()=>{
 const f=fixture();Object.assign(f.other,{status:'completed',conclusion:'success'});f.jobs.forEach(j=>Object.assign(j,{status:'completed',conclusion:'success'}));
 await assert.rejects(countPeerBoundary(f.args)(),/ENDED_UNSETTLED/);f.pool.workers[0].leaseUntil=0;await countPeerBoundary(f.args)();
 f.pool.countAllocation.reserved=1;await assert.rejects(countPeerBoundary(f.args)(),/ENDED_UNSETTLED/);f.pool.countAllocation.reserved=0;
 f.pool.workers[0].activeBatch={id:1};await assert.rejects(countPeerBoundary(f.args)(),/ENDED_UNSETTLED/);
 f.other.conclusion='failure';await assert.rejects(countPeerBoundary(f.args)(),/PEER_IDENTITY/);
});
test('finished peer can release the next game only after target completion and successful final audit',async()=>{
 const f=fixture();Object.assign(f.other,{status:'completed',conclusion:'success'});
 f.jobs.forEach(j=>Object.assign(j,{status:'completed',conclusion:'success'}));f.pool.workers[0].leaseUntil=0;
 f.pool.confirmed=300000;f.campaign.activeGame=null;
 f.campaign.games=[{game_id:32799,status:'complete',confirmed:300000,completed:100}];
 await countPeerBoundary(f.args)();
 for(const mutation of ['count','status','timestamp','pool','audit','lease']){
  const e=f.campaign.games[0],saved=structuredClone({e,p:f.pool,j:f.jobs});
  if(mutation==='count')e.confirmed--;if(mutation==='status')e.status='active';if(mutation==='timestamp')delete e.completed;
  if(mutation==='pool')f.pool.confirmed--;if(mutation==='audit')f.jobs.find(j=>j.name==='verify').conclusion='skipped';
  if(mutation==='lease')f.pool.workers[0].leaseUntil=1000;
  await assert.rejects(countPeerBoundary(f.args)(),undefined,mutation);
  Object.assign(e,saved.e);Object.assign(f.pool,saved.p);f.jobs.splice(0,f.jobs.length,...saved.j);
 }
});

test('running peer isolates only the exact jobless run with complete native denial',async()=>{
 const f=fixture(),id=36854881370,head='38465d0872529e80bc09c60218892c14581162c0';
 f.runs.push({...f.other,id,head_sha:head,status:'queued',conclusion:null});
 const denial={schema:'sg-count-run-revoked-v1',sourceRun:id+':1',sourceCommit:head,trialId:'sg_r1_20261001_32799',revisionHash:'7557938642322bf75bc7339092cbb4d4416351661d598db6cd28b16a608b6122',profileHash:'f'.repeat(64),sourceRequests:0,newBetAllowance:0};
 const rows=[{_id:'primary/count-run:sg_r1_20261001_32799:'+id+':1',value:denial},{_id:'primary/count-jobless-revocation:sg_r1_20261001_32799:'+id+':1:complete',value:{schema:'sg-count-jobless-fence-complete-v1',denialHash:hash(denial),profileHash:denial.profileHash}}];
 const old=f.args.transport.request;f.args.transport.request=async(op,args)=>op==='parallel_rhino_jobless_fence'?rows:old(op,args);
 await countPeerBoundary(f.args)();rows[1].value.denialHash='0'.repeat(64);await assert.rejects(countPeerBoundary(f.args)(),/COUNT_PEER_LIST_READ/);
});
