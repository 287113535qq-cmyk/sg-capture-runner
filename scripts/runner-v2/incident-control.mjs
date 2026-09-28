// Evidence-bound incident maintenance. Runs only on GitHub; never sends SG requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {DurableQueue,WritePermits,receiptKey} from './durable-queue.mjs';
import {MongoWriter,stable} from './mongo-writer.mjs';
import {analyzer} from './analyzer.mjs';
import {repositories} from '../trial/runner-group.mjs';
import {digest,reviewIncident,releaseReviewedPool} from './incident-core.mjs';

const profile=JSON.parse(fs.readFileSync('config/incident-panda-20260929.json','utf8'));
const group=repositories[process.env.GITHUB_REPOSITORY]?.name;
assert(group===profile.group,'INCIDENT_GROUP_MISMATCH');
const stage=process.argv[2];assert(['recover','validate','formal'].includes(stage));
const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))[profile.gameId];
const transport=connectGateway(),gate=new ResourceGate(),parser=analyzer();
const store=new RunnerState({transport,gate,deadline:Date.now()+30*60000});
const prefix='incident:'+profile.id,owner=prefix+':'+process.env.GITHUB_RUN_ID;
const proofHash=digest(profile),poolKey='pool:'+plan.trialId;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function githubIdle(){
  assert(process.env.GH_TOKEN,'GITHUB_AUTH_REQUIRED');
  for(const repo of Object.keys(repositories))for(const status of ['in_progress','queued','pending','waiting','requested']){
    const response=await fetch(`https://api.github.com/repos/${repo}/actions/runs?status=${status}&per_page=100`,{
      headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
    assert(response.ok,'GITHUB_RUN_READ_FAILED');const data=await response.json();
    assert(data.total_count<100,'GITHUB_RUN_LIST_TRUNCATED');
    assert(data.workflow_runs.every(r=>String(r.id)===process.env.GITHUB_RUN_ID && repo===process.env.GITHUB_REPOSITORY
      && r.path==='.github/workflows/trial-300k.yml'),'OTHER_RUN_ACTIVE');
  }
}
async function snapshots(){
  const campaign=await store.get('state','campaign'),pool=await store.get('state',poolKey),hold=await store.get('state','global-hold');
  assert(campaign&&pool&&hold,'MISSING_STATE');const batches=[];
  for(let i=1;i<pool.value.nextBatchId;i++){const b=await store.get('state',`batch:${plan.trialId}:${i}`);assert(b,'BATCH_MISSING');batches.push(b);}
  assert(Object.values(pool.value.workers).every(w=>w.leaseUntil<=Date.now()),'WORKERS_ACTIVE');
  assert(batches.every(b=>b.value.leaseUntil<=Date.now()),'BATCHES_ACTIVE');
  return {campaign,pool,hold,batches};
}
async function verifyRecords(snapshot,{allCommitted=false}={}){
  let count=0,committed=0;const recordsDigest=createHash('sha256'),workerCounts={};
  for(const doc of snapshot.batches){
    const b=doc.value;assert(b.journaled-b.start+1<=100,'BATCH_RANGE_CHANGED');
    const keys=[];for(let n=b.start;n<=b.journaled;n++)keys.push(receiptKey(plan.trialId,n));
    if(!keys.length)continue;
    const saved=await store.getMany('journal',keys);assert(saved.every(Boolean),'RECEIPT_MISSING');
    const records=saved.map(x=>x.value);
    const existing=await transport.request('rounds_read',{trialId:plan.trialId,ids:records.map(r=>r._id)});
    const byId=new Map(existing.map(r=>[r._id,r]));assert(byId.size===existing.length,'DUPLICATE_READBACK');
    for(const [i,r] of records.entries()){
      assert(r.sequence===b.start+i && r.batchId===b.id && r.shardId===b.worker && r.fixtureOnly===false && r.buy===0,'RECORD_IDENTITY_CHANGED');
      assert(r.sourceSessionHash===b.sessionHash && r.sourceSessionHash===snapshot.pool.value.workers[String(b.worker)]?.sessionHash,'SESSION_CHANGED');
      await parser.call({op:'verify',plan,record:r,raw:r.raw});
      const old=byId.get(r._id);
      if(old){assert(stable(old)===stable(r),'FULL_MONGO_MISMATCH');committed++;}
      else assert(!allCommitted && r.sequence>b.checkpoint,'CHECKPOINT_WITHOUT_RECORD');
      recordsDigest.update(stable([r._id,r.contentHash])+'\n');workerCounts[r.shardId]=(workerCounts[r.shardId]||0)+1;count++;
    }
  }
  // This bounded scan also rejects unexpected extra official records.
  let seen=0,after=0;
  while(true){const rows=await transport.request('rounds_scan',{trialId:plan.trialId,after});if(!rows.length)break;
    for(const r of rows){assert(r.sequence>after,'UNORDERED_RECORDS');after=r.sequence;seen++;}}
  assert(seen===committed,'EXTRA_OFFICIAL_RECORDS');
  return {count,committed,recordsHash:recordsDigest.digest('hex'),workerCounts};
}
try{
  await githubIdle();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  const snapshot=await snapshots();
  if(stage==='recover'){
    assert(!(await store.get('journal',prefix+':proof')),'INCIDENT_ALREADY_STARTED');
    reviewIncident({profile,plan,...snapshot});
    const unknown=snapshot.batches.find(x=>x.value.id===profile.abandon.batch).value.pending;
    await parser.call({op:'intent',plan,raw:unknown.raw,payload:unknown.awaiting});
    const verified=await verifyRecords(snapshot);
    assert(verified.count===profile.complete && verified.committed===profile.checkpoint,'COUNTS_CHANGED');
    await githubIdle();reviewIncident({profile,plan,...await snapshots()});
    await store.create('journal',prefix+':proof',{profile,proofHash,verified,at:Date.now(),commit:process.env.GITHUB_SHA},{immutable:true});
    await store.create('journal',prefix+':before',{campaign:snapshot.campaign,pool:snapshot.pool,hold:snapshot.hold},{immutable:true});
    for(const doc of snapshot.batches)await store.create('journal',prefix+':batch:'+doc.value.id,doc,{immutable:true});
    for(const doc of snapshot.batches){
      const b=doc.value,key=`batch:${plan.trialId}:${b.id}`,epoch=b.epoch+1;
      if(b.pending)await store.create('journal',prefix+':abandoned:'+b.id,{proofHash,disposition:'unknown/abandon_without_replay',
        worker:b.worker,sessionHash:b.sessionHash,pending:b.pending},{immutable:true});
      await store.update('state',key,v=>{assert(digest(v)===digest(b),'BATCH_CHANGED');
        return {...v,owner,epoch,leaseUntil:0,pending:null,incidentRecovery:proofHash};});
      const queue=new DurableQueue({store,plan,batchKey:key,owner,epoch});
      const writer=new MongoWriter({gate,queue,permits:new WritePermits({store,group,owner}),sink:{
        read:ids=>transport.request('rounds_read',{trialId:plan.trialId,ids}),insert:records=>transport.request('rounds_insert',{trialId:plan.trialId,records})}});
      while(true){const rows=await queue.outstanding();if(!rows.length)break;await store.writable();const result=await writer.deliver(rows);if(result.paused)await delay(1000);}
      await store.update('state',key,v=>{assert(v.owner===owner && v.epoch===epoch && !v.pending && v.checkpoint===v.journaled,'RECONCILE_INCOMPLETE');return {...v,owner:null};});
    }
    await store.update('state',poolKey,v=>{assert(digest(v)===digest(snapshot.pool.value),'POOL_CHANGED');return releaseReviewedPool(v,proofHash);});
    const after=await snapshots(),full=await verifyRecords(after,{allCommitted:true});
    assert(full.count===profile.complete && full.recordsHash===verified.recordsHash,'VALID_RECORDS_CHANGED');
    const result={proofHash,fullReadback:full.count,recordsHash:full.recordsHash,workerCounts:full.workerCounts,archivedUnknown:1,
      sourceRequests:0,replayedUnknownRequests:0,validRecordsDeleted:0,poolHash:digest(after.pool.value),at:Date.now()};
    await store.create('journal',prefix+':reconciled',result,{immutable:true});
    await githubIdle();
    await store.update('state','campaign',v=>{assert(digest(v)===digest(snapshot.campaign.value),'CAMPAIGN_CHANGED');return {...v,validationLimit:10};});
    await store.update('state','global-hold',v=>{assert(digest(v)===digest(snapshot.hold.value),'HOLD_CHANGED');return {...v,active:false,reason:null,incidentRecovery:proofHash};});
    console.log(JSON.stringify({stage,...result,validationLimit:10}));
  }else{
    const base=(await store.get('journal',prefix+':reconciled'))?.value;
    assert(base?.proofHash===proofHash && snapshot.pool.value.incidentRecovery===proofHash,'RECOVERY_REQUIRED');
    assert(snapshot.campaign.value.activeGame===plan.gameId && snapshot.campaign.value.validationLimit===10,'SHORT_PHASE_REQUIRED');
    assert(!snapshot.pool.value.failure && snapshot.pool.value.enabled,'POOL_HALTED');
    assert(snapshot.batches.every(x=>!x.value.pending&&!x.value.bootstrapAwaiting&&!x.value.failure&&x.value.journaled===x.value.checkpoint),'UNSETTLED_BATCH');
    const holds=await transport.request('global_holds');assert(holds.every(x=>x&&x.value.active===false),'GLOBAL_HOLD');
    if(stage==='validate'){
      assert(!(await store.get('journal',prefix+':validation')),'VALIDATION_ALREADY_APPLIED');
      const full=await verifyRecords(snapshot,{allCommitted:true});
      assert(full.count===profile.complete+200 && Object.keys(full.workerCounts).length===20,'SHORT_COUNT_CHANGED');
      for(let w=20;w<40;w++)assert(full.workerCounts[w]-(base.workerCounts[w]||0)===10,'WORKER_SHORT_COUNT_CHANGED');
      // Old immutable receipts are bound by the original proof; verify their digest independently of additions.
      const original=createHash('sha256');
      for(const spec of profile.batches){const before=(await store.get('journal',prefix+':batch:'+spec.id)).value.value;
        const keys=[];for(let n=before.start;n<=before.journaled;n++)keys.push(receiptKey(plan.trialId,n));
        if(keys.length)for(const x of await store.getMany('journal',keys)){assert(x);original.update(stable([x.value._id,x.value.contentHash])+'\n');}}
      assert(original.digest('hex')===base.recordsHash,'OLD_RECORDS_CHANGED');
      const result={proofHash,fullReadback:full.count,newComplete:200,workers:20,pending:0,poolHash:digest(snapshot.pool.value),
        campaignHash:digest(snapshot.campaign.value),at:Date.now(),sourceRequests:0};
      await store.create('journal',prefix+':validation',result,{immutable:true});console.log(JSON.stringify({stage,...result}));
    }else{
      const proof=(await store.get('journal',prefix+':validation'))?.value;
      assert(proof?.proofHash===proofHash && proof.fullReadback===profile.complete+200 && proof.pending===0
        && proof.poolHash===digest(snapshot.pool.value) && proof.campaignHash===digest(snapshot.campaign.value)
        && Date.now()>=proof.at && Date.now()-proof.at<15*60000,'VALIDATION_STALE_OR_CHANGED');
      await store.create('journal',prefix+':formal',{proof,at:Date.now(),commit:process.env.GITHUB_SHA},{immutable:true});
      await store.update('state','campaign',v=>{assert(digest(v)===proof.campaignHash,'CAMPAIGN_CHANGED');return {...v,validationLimit:0};});
      console.log(JSON.stringify({stage,proofHash,validationLimit:0,sourceRequests:0}));
    }
  }
}catch(error){console.log(JSON.stringify({stage,group,error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'INCIDENT_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
