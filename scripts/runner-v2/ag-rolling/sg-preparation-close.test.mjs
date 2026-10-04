import test from 'node:test';import assert from 'node:assert/strict';
import {closePreparation} from './sg-preparation-close.mjs';import {queueHash} from './sg-queue-profile.mjs';
function setup(){
 const activation='a'.repeat(64),commit='b'.repeat(40),run='123:1';
 const ended={schema:'sg-ag-rolling-window-ended-v1',queueId:'queue',run:'122:1',activation:'c'.repeat(64),commit:'d'.repeat(40)};
 const target={activation,payload:{queueId:'queue',games:[]},manifest:[],resume:{previousActivation:ended.activation,previousRun:ended.run,endedProofHash:queueHash(ended)}};
 const source={owner:run,queueId:'queue',status:'preparing',activation,commit,expiresAt:9000};
 const profile={...structuredClone(target),activation:'e'.repeat(64),operation:'close-ended-admission',sourceAllowance:0,nativeGatewayHash:'f'.repeat(64),nativeManifestHash:'g'.repeat(64),
  preparationRecovery:{schema:'sg-ag-preparing-recovery-v1',targetActivation:activation,targetRun:run,targetCommit:commit,targetProfileHash:queueHash(target),nativeSourceHash:queueHash(source)}};
 const docs=new Map([['state/rolling-source',{value:source,version:1}],['journal/rolling-activation:'+activation,{value:{schema:'sg-ag-rolling-activation-v1',run,commit,activation,queueId:'queue',profileHash:queueHash(target),sourceRequests:0}}],
  ['journal/rolling-activation:'+ended.activation+':complete',{value:{run:ended.run,commit:ended.commit,queueId:'queue'}}],['journal/rolling-ended:queue:122:1',{value:ended}]]),writes=[];
 const store={async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},async getMany(c,keys){return keys.map(()=>null);},
  async create(c,k,v){writes.push(['create',k]);docs.set(c+'/'+k,{value:structuredClone(v)});},async cas(c,k,b,v){writes.push(['cas',k]);docs.set(c+'/'+k,{value:structuredClone(v),version:b.version+1});return true;}};
 const gh={id:123,run_attempt:1,head_sha:commit,status:'completed',conclusion:'failure',event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',repository:{full_name:'zyzuoyang/sg-capture-runner'}};
 const jobs={total_count:2,jobs:[{id:1,name:'ag-rolling-admit',status:'completed',conclusion:'failure'},{id:2,name:'AG rolling lane ${{ matrix.lane }}',status:'completed',conclusion:'skipped'}]};
 const args={profile,target,store,transport:{request:async()=>({group:'primary',gatewaySha256:profile.nativeGatewayHash,accessManifestHash:profile.nativeManifestHash})},boundary:async()=>{},
  readEnded:async id=>id==='123'?gh:{status:'completed',head_sha:ended.commit},readEndedJobs:async id=>id==='123'?jobs:{total_count:22,jobs:Array.from({length:22},()=>({status:'completed'}))},commit:'h'.repeat(40),run:'124:1',now:()=>1000};
 return {args,docs,writes,gh,jobs};
}
test('source-free GitHub closure seals the exact claim and keeps the old full-window anchor, without task, lease or round writes',async()=>{
 const s=setup(),old=structuredClone(s.args.target);const result=await closePreparation(s.args);
 assert.equal(result.sourceRequests,0);assert.equal(result.taskWrites,0);assert.equal(result.roundWrites,0);assert.deepEqual(s.args.target,old);
 assert.equal(s.writes.length,2);assert.deepEqual(s.writes[1],['cas','rolling-source']);const after=s.docs.get('state/rolling-source').value;
 assert.equal(after.status,'idle');assert.equal(after.lastRun,'122:1');assert.equal(after.lastAdmissionClosed.run,'123:1');
});
test('an unknown closure CAS is issued once and never retried or credited as a completed capture window',async()=>{
 const s=setup();let n=0;s.args.store.cas=async()=>{n++;throw Object.assign(new Error('unknown'),{outcomeUnknown:true});};
 await assert.rejects(closePreparation(s.args));assert.equal(n,1);assert.equal(s.docs.get('state/rolling-source').value.status,'preparing');
 assert.equal([...s.docs.values()].filter(d=>d.value.fullCaptureWindowEnded===false).length,1);
});
test('active preparation, a source job that ran, changed claim or absence of the old ended proof prevents every closure write',async()=>{
 for(const change of [s=>s.gh.status='in_progress',s=>s.jobs.jobs[1].conclusion='cancelled',s=>s.docs.get('state/rolling-source').value.owner='other',
  s=>s.docs.delete('journal/rolling-ended:queue:122:1')]){
  const s=setup();change(s);await assert.rejects(closePreparation(s.args));assert.equal(s.writes.length,0);}
});
