import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fixture as base,finish} from './demon-nested-test-fixture.mjs';
import {DemonNestedRebind,PREVIOUS as P} from './demon-nested-rebind.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {GithubCampaign} from './campaign.mjs';
import {PendingFirst} from './pending-first.mjs';
import {STAGE_KEY} from './demon-nested-rebind-stage.mjs';
export async function fixture(){
 const f=base(),r=await f.operator.recover(),old=f.operator;
 const history=JSON.parse(fs.readFileSync('scripts/runner-v2/demon-nested-rebind-history-fixture.json','utf8'));
 for(const [k,v] of Object.entries(history))f.put('journal',k,v);
 f.docs.get('journal/'+P.prefix+':proof').value.profile=JSON.parse(fs.readFileSync('config/demon-nested-20260929.json','utf8'));
 const spec=f.get('journal','pending-first:'+r.proofHash).value;spec.proofHash=P.proof;spec.commit=P.commit;f.put('journal','pending-first:'+P.proof,spec);
 const c=f.docs.get('state/campaign').value,p=f.docs.get('state/pool:'+f.plan.trialId).value;c.games[0].status='parking-protocol';c.protocolValidation={phase:'short',gameId:32739,proofHash:P.proof,commit:P.commit,runKey:P.failedRun,nestedShort:hash(spec)};p.protocolRecovery=P.proof;
 for(const {value:b} of (await old.snapshots()).batches){const v=f.docs.get('state/batch:'+f.plan.trialId+':'+b.id).value;v.protocolRecovery=P.proof;if(v.protocolResume)v.protocolResume.proofHash=P.proof;}
 const snapshot=await old.snapshots();
 const profile={...f.profile,schema:'sg-demon-nested-rebind-v1',id:'demon-nested-rebind-36574646755',checkpoint:267,createdAt:Date.parse('2026-09-29T13:30:00Z'),snapshotHash:hash(snapshot),workersHash:hash(p.workers),previousSpecHash:hash(spec)};
 const now=()=>profile.createdAt+1000;f.profile=profile;f.operator=new DemonNestedRebind({...old,profile,run:'999998:1',commit:'f'.repeat(40),now});
 const campaign=new GithubCampaign({store:old.store,transport:old.transport,control:{allowed:async()=>{}},analyzer:old.parser,plans:{32739:f.plan},group:'primary',owner:'synthetic',commit:f.operator.commit,now});
 f.put('journal','parked:'+f.plan.trialId+':1',{batch:{oldArchive:true}});
 f.writes.length=0;return {...f,campaign};
}
test('actual campaign route reproduces archive conflict before repair, then selects preserved game',async()=>{
 const f=await fixture();await assert.rejects(f.campaign.select(),/DUPLICATE/);
 const prior=await f.operator.snapshots(),r=await f.operator.recover();assert.equal(r.sourceRequests,0);assert.equal(r.flushed,0);
 const next=await f.campaign.selectForRun('capture-run:999999:1');assert.equal(next.action,'capture');assert.equal(next.plan.gameId,32739);
 const after=await f.operator.snapshots();for(const {value:b} of prior.batches)assert.deepEqual(after.batches.find(x=>x.value.id===b.id).value.pending,b.pending);
 const gate=new PendingFirst({store:f.operator.store,transport:f.operator.transport,analyzer:f.operator.parser,plan:f.plan,stage:'resume',runKey:'capture-run:999999:1',now:f.operator.now});
 for(const worker of [0,14])assert.equal((await gate.admit({shardId:worker,commitSha:f.operator.commit,sessionHash:after.pool.value.workers[worker].sessionHash},worker)).limit,1);
 await assert.rejects(f.operator.recover());
});
test('rebind retains267, remaining179 and complete446 validation',async()=>{const f=await fixture();await f.operator.recover();await finish(f);assert.equal((await f.operator.validate()).newComplete,179);await f.operator.formal();});
for(const key of ['stage','backup'])test('rebind old job at '+key+' blocks mutations',async()=>{const f=await fixture(),s=await f.operator.snapshots();f.hook(k=>{if(k===(key==='stage'?STAGE_KEY:f.operator.prefix+':backup-complete'))f.block();});await assert.rejects(f.operator.recover(),/OLD_JOB_EXISTS/);assert.deepEqual(await f.operator.snapshots(),s);});
test('rebind active lease prevents receipt',async()=>{const f=await fixture();f.occupy();await assert.rejects(f.operator.recover(),/LEASE_ACTIVE/);assert.equal(f.writes.length,0);});
test('rebind incomplete backup cannot rerun or change original pending',async()=>{const f=await fixture(),s=await f.operator.snapshots();f.fail(f.operator.prefix+':records:19');await assert.rejects(f.operator.recover(),/INJECTED_FAILURE/);assert.deepEqual(await f.operator.snapshots(),s);f.fail(null);await assert.rejects(f.operator.recover());});
