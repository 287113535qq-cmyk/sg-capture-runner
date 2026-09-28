// Explicit operator workflow: reconcile frozen complete rounds and archive the
// exact unknown attempts covered by that snapshot. There is no SG transport.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {DurableQueue,WritePermits} from './durable-queue.mjs';
import {MongoWriter,stable} from './mongo-writer.mjs';
import {repositories} from '../trial/runner-group.mjs';
import {reviewFrozenBatch} from './recovery-core.mjs';

const cfg=JSON.parse(fs.readFileSync('config/github-migration-v2.json','utf8'));
const group=repositories[process.env.GITHUB_REPOSITORY]?.name;assert(group);
const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))[cfg.groups[group]];
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000});
const digest=value=>createHash('sha256').update(stable(value)).digest('hex');
const owner=`migration-recovery:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`;
const expected={primary:{complete:56177,committed:55287,unknownIntents:16},secondary:{complete:32160,committed:31623,unknownIntents:3}}[group];
const delay=ms=>new Promise(r=>setTimeout(r,ms));

async function noCaptureJobs(){
  assert(process.env.GH_TOKEN);
  for(const repository of Object.keys(repositories)){
    const get=async path=>{
      const response=await fetch(`https://api.github.com/repos/${repository}/${path}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
      assert(response.ok,'RUN_LIST_UNAVAILABLE');return response.json();
    };
    const runs=await get('actions/runs?per_page=100');
    for(const run of runs.workflow_runs.filter(r=>r.status!=='completed')){
      assert(run.path==='.github/workflows/trial-300k.yml','OTHER_ACTIVE_WORKFLOW');
      const jobs=await get(`actions/runs/${run.id}/jobs?per_page=100`);
      const active=jobs.jobs.filter(j=>!['skipped'].includes(j.conclusion));
      assert(active.length===1 && active[0].name==='github-recover','CAPTURE_OR_UNKNOWN_JOB_ACTIVE');
    }
  }
}

try{
  await noCaptureJobs();
  assert(!(await store.get('state','migration-recovery-complete')),'RECOVERY_ALREADY_APPLIED');
  const migration=(await store.get('state','migration-complete'))?.value;
  assert(migration && migration.manifestHash===cfg.manifestHash && migration.queueSha256===cfg.queueSha256);
  for(const [k,v] of Object.entries(expected))assert.equal(migration[k],v,'MIGRATION_COUNT_CHANGED');
  assert.equal(migration.pending,migration.unknownIntents,'NON_UNKNOWN_PENDING_REQUIRES_PROTOCOL_RECOVERY');
  const campaign=await store.get('state','campaign'),pool=await store.get('state','pool:'+plan.trialId);
  assert(!campaign.value.enabled && !pool.value.enabled);
  assert(Object.values(pool.value.workers).every(w=>w.leaseUntil===0));
  const batches=[];
  for(const spec of Object.values(pool.value.legacyBatches)){
    const saved=await store.get('state',`batch:${plan.trialId}:${spec.id}`);if(!saved)continue;
    assert(saved.value.leaseUntil===0 && saved.value.migration===cfg.manifestHash);
    const beforeKey=`migration-batch-before:${plan.trialId}:${spec.id}`;
    let before=await store.get('journal',beforeKey);
    if(!before){
      reviewFrozenBatch(saved.value,migration);
      before=await store.create('journal',beforeKey,{snapshot:saved},{immutable:true});
    }
    reviewFrozenBatch(before.value.snapshot.value,migration);
    batches.push(before.value.snapshot);
  }
  const existingProof=await store.get('journal','migration-recovery-proof');
  const proof=existingProof?.value.proof || {schema:'sg-github-migration-recovery-v2',group,trialId:plan.trialId,manifestHash:cfg.manifestHash,
    migration,campaignVersion:campaign.version,poolVersion:pool.version,
    batches:batches.map(x=>({id:x.value.id,version:x.version,stateHash:digest(x.value)})),
    sourceRequests:0,unknownDisposition:'abandon_without_replay',validRoundsDeleted:0};
  const proofHash=digest(proof);
  assert(proof.group===group && proof.manifestHash===cfg.manifestHash && stable(proof.migration)===stable(migration));
  await store.create('journal','migration-recovery-proof',{proofHash,proof},{immutable:true});
  await store.create('state','global-hold',{active:true,reason:'LEGACY_STORAGE_REVIEW_REQUIRED'},{immutable:true});
  let fullCount=0,archived=0;
  const legacyConfirmedByBatch={};
  for(const saved of batches){
    const b=saved.value,batchKey=`batch:${plan.trialId}:${b.id}`;
    // Archive the entire frozen pending object before removing it from the
    // new runtime state. The old SQLite and private backup are untouched.
    if(b.pendingOriginal){
      await store.create('journal',`abandoned:${plan.trialId}:${b.id}`,{proofHash,
        disposition:'unknown/abandon_without_replay',pending:b.pendingOriginal,worker:b.worker,sessionHash:b.sessionHash},{immutable:true});
      archived++;
    }
    const epoch=b.epoch+1;
    await store.update('state',batchKey,value=>{
      if(value.recoveryProof===proofHash){
        assert(value.journaled===b.journaled && value.sessionHash===b.sessionHash && !value.pending && !value.pendingOriginal);
        return {...value,owner,epoch};
      }
      assert(digest(value)===digest(b),'RECOVERY_BATCH_CHANGED');
      return {...value,owner,epoch,pendingOriginal:null,pending:null,bootstrapAwaiting:null,
        failure:null,legacyJournaled:b.journaled,recoveryProof:proofHash};
    });
    const queue=new DurableQueue({store,plan,batchKey,owner,epoch});
    const writer=new MongoWriter({gate,queue,permits:new WritePermits({store,group,owner}),
      sink:{read:ids=>transport.request('rounds_read',{trialId:plan.trialId,ids}),
        insert:records=>transport.request('rounds_insert',{trialId:plan.trialId,records})}});
    while(true){
      const rows=await queue.outstanding();if(!rows.length)break;
      await store.writable();const result=await writer.deliver(rows);if(result.paused)await delay(1000);
    }
    const after=(await store.get('state',batchKey)).value;
    assert(after.checkpoint===b.journaled && !after.pending);
    await store.update('state',batchKey,value=>({...value,owner:null,leaseUntil:0}));
    const count=b.journaled-b.start+1;legacyConfirmedByBatch[String(b.id)]=count;fullCount+=count;
  }
  assert.equal(fullCount,expected.complete);assert.equal(archived,expected.unknownIntents);
  await store.update('state','pool:'+plan.trialId,value=>{
    if(value.recoveryProof===proofHash){assert(value.confirmed===fullCount);return null;}
    assert(digest(value)===digest(pool.value),'RECOVERY_POOL_CHANGED');
    value.confirmed=fullCount;value.legacyConfirmedByBatch=legacyConfirmedByBatch;value.recoveryProof=proofHash;
    value.failure=null;
    for(const worker of Object.values(value.workers)){worker.resumeSafe=true;worker.owner=null;worker.leaseUntil=0;}
    return value; // enabled deliberately remains false until operator activation
  });
  const result={group,trialId:plan.trialId,proofHash,completeFullReadback:fullCount,unknownAttemptsArchived:archived,
    originalUnknownRequestsReplayed:0,validRoundsDeleted:0,sourceEnabled:false,at:Date.now()};
  await store.create('state','migration-recovery-complete',result,{immutable:true});console.log(JSON.stringify(result));
}catch(error){
  const code=/^[A-Z_]{1,100}$/.test(error.code || '')?error.code:'MIGRATION_RECOVERY_STOPPED';
  console.log(JSON.stringify({group,error:code,sourceEnabled:false,sourceRequests:0}));process.exitCode=2;
}finally{transport.close();}
