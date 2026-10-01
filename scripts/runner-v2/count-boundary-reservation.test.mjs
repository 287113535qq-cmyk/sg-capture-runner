import test from 'node:test';import assert from 'node:assert/strict';
import {reserveCountBoundary,reservationIdentity,reservationRead,reservationSource} from './count-boundary-reservation.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {revokedMarker} from './demo-run-fence.mjs';
import {RunnerState} from './state-store.mjs';
function fixture(){
 const activation=hash('activation'),profileHash=hash('count-profile'),peer={schema:'sg-count-peer-v1',group:'primary',gameId:32799,
  ...reservationSource,profileHash,activation,lanesPerHost:2};delete peer.ref;
 const permit={schema:'sg-count-run-v1',run:peer.run,commit:peer.commit,activation,profileHash,completeBefore:100,remainingComplete:299900};
 const profile={schema:'sg-count-boundary-reservation-profile-v1',purpose:'session-canary-v1',sourcePeer:peer,
  sourcePermitHash:hash(permit),createdAt:1,expiresAt:1000,sourceRequests:0,newBetAllowance:0};
 const spec={schema:'sg-complete-count-v1',trialId:peer.trialId,activation,profileHash,gameId:32799,target:300000,
  planHash:hash('plan'),commit:peer.commit,sessionLayout:{lanesPerHost:2}};
 const evidence={state:[{_id:'primary/campaign',value:{group:'primary',enabled:true,activeGame:32799,validationLimit:0,
  formalCount:{activation,profileHash,trialId:peer.trialId},demoRunRevoked:revokedMarker}},
  {_id:'primary/pool:'+peer.trialId,value:{enabled:true,confirmed:200,countAllocation:{specHash:hash(spec),reserved:100},
   workers:{0:{activeBatch:{id:1},leaseUntil:200,owner:peer.run+':formal-capture:0'}}}},
  {_id:'primary/capture-run:'+peer.run,value:{gameId:32799}}],journal:[
  {_id:'primary/count-run:'+peer.trialId+':'+peer.run,value:permit},
  {_id:'primary/complete-count:'+peer.trialId+':'+activation,value:spec},
  {_id:'primary/complete-count:'+peer.trialId+':'+activation+':complete',value:{schema:'sg-complete-count-activation-v1',specHash:hash(spec),
   trialId:peer.trialId,planHash:spec.planHash,commit:spec.commit}}]};
 const source={id:Number(peer.run.split(':')[0]),run_attempt:1,head_sha:peer.commit,head_branch:reservationSource.ref,
  repository:{full_name:peer.repository},event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',status:'in_progress',conclusion:null};
 const jobs={total_count:21,jobs:[{name:'formal-admit',status:'completed',conclusion:'success'},...Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'in_progress',conclusion:null}))]};
 const rows=new Map(),transport={async request(op,fields){
  if(op==='parallel_rhino_count_boundary')return evidence;
  assert.equal(fields.collection,'journal');if(op==='read')return rows.has(fields.key)?{value:rows.get(fields.key),version:0}:null;
  assert.equal(op,'create');if(rows.has(fields.key))return {created:false};rows.set(fields.key,fields.value);return {created:true};
 }},store=new RunnerState({transport});store.writable=async()=>{};
 const read=async path=>path.includes('/jobs?')?jobs:path.includes('/actions/runs?')?{total_count:1,workflow_runs:[source]}:source;
 const now=()=>100,boundary=()=>reservationIdentity({read,transport,profile,now});
 return {args:{store,profile,run:'999:1',commit:'b'.repeat(40),boundary,now},read,transport,source,jobs,evidence,rows};
}
test('live healthy source remains untouched while only one future relay key is reserved',async()=>{
 const f=fixture(),before=hash(f.evidence);const r=await reserveCountBoundary(f.args);
 assert.equal(r.databaseWrites,1);assert.equal(r.newBetAllowance,0);assert.equal(hash(f.evidence),before);assert.equal(f.rows.size,1);
 assert.equal([...f.rows.values()][0].schema,'sg-formal-relay-boundary-reserved-v1');await assert.rejects(()=>reserveCountBoundary(f.args));
});
test('existing real relay intent wins unchanged over boundary reservation',async()=>{
 const f=fixture(),key=`count-relay:${reservationSource.trialId}:${reservationSource.run}:intent`,intent={schema:'sg-formal-relay-v1'};
 f.rows.set(key,intent);await assert.rejects(()=>reserveCountBoundary(f.args),/BOUNDARY_RELAY_ALREADY_CLAIMED/);assert.deepEqual(f.rows.get(key),intent);
});
test('reservation and real relay atomic claims never overwrite the winning task',async()=>{
 const f=fixture(),key=`count-relay:${reservationSource.trialId}:${reservationSource.run}:intent`;
 const real={schema:'sg-formal-relay-v1'};
 const results=await Promise.allSettled([reserveCountBoundary(f.args),f.args.store.create('journal',key,real,{immutable:true})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.rows.size,1);
});
test('only exact authenticated source is permitted in the independent metadata boundary',async()=>{
 const f=fixture(),read=reservationRead({read:f.read,transport:f.transport,profile:f.args.profile,now:f.args.now});
 const r=await read('repos/'+reservationSource.repository+'/actions/runs?status=in_progress&per_page=100');assert.equal(r.total_count,0);
 f.source.head_sha='e'.repeat(40);await assert.rejects(()=>read('repos/'+reservationSource.repository+'/actions/runs?status=in_progress&per_page=100'));
});
for(const bad of ['ended-source','failed-capture','foreign-lease','changed-permit','expired-profile','wrong-purpose','quota','late-commit'])
test('boundary reservation rejects '+bad+' without any write',async()=>{
 const f=fixture();
 if(bad==='ended-source')f.source.status='completed';
 if(bad==='failed-capture'){f.jobs.jobs[1].status='completed';f.jobs.jobs[1].conclusion='failure';}
 if(bad==='foreign-lease')f.evidence.state[1].value.workers[0].owner='other';
 if(bad==='changed-permit')f.evidence.journal[0].value.completeBefore++;
 if(bad==='expired-profile')f.args.profile.expiresAt=99;
 if(bad==='wrong-purpose')f.args.profile.purpose='continue-count';
 if(bad==='quota')f.args.profile.newBetAllowance=100;
 if(bad==='late-commit')f.source.head_sha='e'.repeat(40);
 await assert.rejects(()=>reserveCountBoundary(f.args));assert.equal(f.rows.size,0);
});
