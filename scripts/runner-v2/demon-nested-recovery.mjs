import assert from 'node:assert/strict';
import {ProtocolRecovery} from './protocol-recovery.mjs';
import {protocolGrant} from './protocol-recovery-core.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {DurableQueue,WritePermits,receiptKey} from './durable-queue.mjs';
import {MongoWriter,stable} from './mongo-writer.mjs';
import {reviewZeroAncestor,ZERO} from './demon-nested-ancestor.mjs';
import {beginStage,stageBoundary,completeStage} from './demon-nested-stage.mjs';
import {nestedShortPlan} from './demon-nested-short.mjs';
import {PendingFirst} from './pending-first.mjs';
import {nextRequest} from '../trial/squid-protocol.mjs';
export const NESTED_ID='demon-nested-36562923330';
export function reviewNested({plan,profile,s,now}){
 const c=s.campaign.value,p=s.pool.value;
 assert(profile.schema==='sg-demon-nested-v1'&&profile.id===NESTED_ID&&profile.complete===267&&profile.checkpoint===256&&profile.pending===2,'WRONG_NESTED_INCIDENT');
 assert(now>=profile.createdAt&&now-profile.createdAt<7200000,'INCIDENT_PROOF_STALE');
 assert(hash(plan)===profile.planHash&&plan.gameId===32739&&plan.phase===1&&plan.buy===0,'PLAN_CHANGED');
 assert(hash(c)===profile.campaignHash&&hash(p)===profile.poolHash,'INCIDENT_STATE_CHANGED');
 assert(c.enabled&&!c.reason&&!c.audit&&c.activeGame===32739&&c.validationLimit===10
  &&c.protocolValidation?.phase==='short'&&c.protocolValidation.proofHash===ZERO.proof&&c.protocolValidation.commit===ZERO.commit
  &&c.protocolValidation.runKey==='capture-run:36562923330:1'&&!c.games.some(g=>g.status==='ready'),'SHORT_STATE_CHANGED');
 assert(!p.enabled&&p.failure==='PROTOCOL_VALIDATION_FAILED'&&p.protocolRecovery===ZERO.proof&&p.planHash===profile.planHash,'POOL_CHANGED');
 assert(Object.keys(p.workers).length===20&&new Set(Object.values(p.workers).map(w=>w.sessionHash)).size===20
  &&Object.entries(p.workers).every(([id,w])=>Number(id)>=0&&Number(id)<20&&w.leaseUntil<=now),'WORKERS_ACTIVE_OR_CHANGED');
 assert(s.batches.length===19&&profile.batches.length===19&&p.nextBatchId===20,'BATCHES_CHANGED');
 let count=0,checkpoint=0,end=0;const owners=[];
 for(const [i,{value:b}] of s.batches.entries()){
  const e=profile.batches[i];assert(b.id===i+1&&e.id===b.id&&hash(b)===e.hash,'BATCH_CHANGED');
  assert(b.start===end+1&&b.end>=b.start&&b.end-b.start<100&&b.end<=plan.target,'RANGE_CHANGED');end=b.end;
  assert(b.start-1<=b.checkpoint&&b.checkpoint<=b.journaled&&b.journaled<b.end,'COUNTS_CHANGED');
  assert(b.leaseUntil<=now&&!b.bootstrapAwaiting&&!b.pendingOriginal&&!b.protocolResume
   &&(b.failure===null||(b.id===3&&b.failure==='PROTOCOL_VALIDATION_FAILED')),'BATCH_REQUIRES_REVIEW');
  assert(p.workers[b.worker]?.sessionHash===b.sessionHash
   &&(p.workers[b.worker].activeBatch?.id===b.id||(b.worker===13&&p.workers[13].activeBatch===null)),'SESSION_CHANGED');
  count+=b.journaled-b.start+1;checkpoint+=b.checkpoint-b.start+1;
  if(b.pending){const q=b.pending;owners.push(b.worker);
   assert(q.awaiting===null&&q.sequence===b.journaled+1&&hash(q)===e.pendingHash
    &&((b.id===3&&b.worker===14&&q.sequence===218&&q.raw.steps.length===8)||(b.id===5&&b.worker===0&&q.sequence===440&&q.raw.steps.length===1)),'PENDING_CHANGED');
   assert(q.raw.steps.every(x=>!x.sourceRejected)&&stable(nextRequest(q.raw))===stable({MSGID:'FREE_GAME'}),'PENDING_NOT_SUPPORTED');
  }else assert(e.pendingHash===null,'UNREVIEWED_PENDING');
 }
 assert(end+1===p.nextSequence&&count===267&&checkpoint===256&&hash(owners.sort((a,b)=>a-b))===hash([0,14]),'COUNTS_CHANGED');
 return {count,checkpoint,pending:2};
}
export class DemonNestedRecovery extends ProtocolRecovery{
 constructor(args){super({...args,profile:{...args.profile,id:'demon-32739-20260929'}});Object.assign(this,{profile:args.profile,run:args.run,checkLeases:args.checkLeases,prefix:'demon-nested:'+NESTED_ID,recovering:false});}
 async boundary(){const holds=await super.boundary();await reviewZeroAncestor(this);await stageBoundary(this);return holds;}
 async archives(){
  assert(Object.keys(this.profile.archives).sort().join(',')==='117,1706,434,806,902','ARCHIVE_SCOPE_CHANGED');
  for(const [sequence,e] of Object.entries(this.profile.archives)){
   const a=(await this.store.get('journal',e.prefix+':abandoned:'+e.batch))?.value,r=(await this.store.get('journal',e.prefix+':reconciled'))?.value;
   assert(a&&r&&hash(a)===e.archiveHash&&hash(r)===e.reconciledHash&&a.pending.sequence===Number(sequence)
    &&a.worker===e.worker&&a.proofHash===e.proof&&r.proofHash===e.proof&&a.disposition==='source-invalid-session/abandon_without_replay','OLD_ARCHIVE_CHANGED');
  }
 }
 async recover(){this.recovering=true;try{
  const holds=await this.boundary(),s=await this.snapshots();assert(typeof this.checkLeases==='function','LEASE_REVIEW_REQUIRED');await this.checkLeases();
  assert(!(await this.store.get('journal',this.prefix+':proof')),'RECOVERY_ALREADY_STARTED');reviewNested({plan:this.plan,profile:this.profile,s,now:this.now()});
  await this.archives();
  for(const {value:b} of s.batches)if(b.pending)assert(stable(await this.parser.call({op:'next',plan:this.plan,raw:b.pending.raw}))===stable(nextRequest(b.pending.raw)),'CONTINUATION_CHANGED');
  const full=await this.verifyRecords(s);assert(full.count===267&&full.committed===256&&full.recordsHash===this.profile.recordsHash,'COUNTS_CHANGED');
  const original=await reviewZeroAncestor(this);
  await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');await this.checkLeases();await beginStage(this,s,full);await this.boundary();
  const proof={schema:'sg-demon-nested-proof-v1',profileHash:hash(this.profile),snapshotHash:hash(s),verified:full,commit:this.commit,run:this.run,createdAt:this.now()},proofHash=hash(proof);
  await this.store.create('journal',this.prefix+':proof',{proof,proofHash,profile:this.profile},{immutable:true});
  await this.store.create('journal',this.prefix+':before',{...s,holds},{immutable:true});
  assert(stable(await this.verifyRecords(s,{backup:true}))===stable(full),'BACKUP_CHANGED');
  await this.store.create('journal',this.prefix+':backup-complete',{proofHash,snapshotHash:hash(s),recordsHash:full.recordsHash},{immutable:true});
  await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
  for(const {value:b} of s.batches){
   await this.boundary();const key=`batch:${this.plan.trialId}:${b.id}`,epoch=b.epoch+1;
   await this.store.update('state',key,v=>{assert(hash(v)===hash(b),'BATCH_CHANGED');return {...v,owner:this.owner,epoch,leaseUntil:0,failure:null};});
   const queue=new DurableQueue({store:this.store,plan:this.plan,batchKey:key,owner:this.owner,epoch});
   const writer=new MongoWriter({gate:this.gate,queue,permits:new WritePermits({store:this.store,group:'primary',owner:this.owner,now:this.now}),sink:{read:ids=>this.transport.request('rounds_read',{trialId:this.plan.trialId,ids}),insert:records=>this.transport.request('rounds_insert',{trialId:this.plan.trialId,records})}});
   while(true){const rows=await queue.outstanding();if(!rows.length)break;await this.boundary();const r=await writer.deliver(rows);if(r.paused)await this.sleep(1000);}
   await this.store.update('state',key,v=>{assert(v.owner===this.owner&&v.epoch===epoch&&v.journaled===v.checkpoint&&hash(v.pending)===hash(b.pending),'RECONCILE_CHANGED');return {...v,owner:null};});
  }
  const after=await this.snapshots(),verified=await this.verifyRecords(after,{allCommitted:true});assert(verified.count===267&&verified.recordsHash===full.recordsHash,'VALID_RECORDS_CHANGED');
  const grant=protocolGrant({plan:this.plan,batches:after.batches,proofHash,commit:this.commit,now:this.now()});
  const spec=nestedShortPlan({plan:this.plan,batches:after.batches,original,proofHash,commit:this.commit,createdAt:grant.createdAt,expiresAt:grant.expiresAt});
  await this.boundary();await this.store.create('journal','protocol-resume:'+proofHash,grant,{immutable:true});await this.store.create('journal','pending-first:'+proofHash,spec,{immutable:true});
  for(const {value:b} of after.batches){await this.boundary();await this.store.update('state',`batch:${this.plan.trialId}:${b.id}`,v=>{assert(hash(v)===hash(b),'BATCH_CHANGED');return {...v,epoch:v.epoch+1,protocolRecovery:proofHash,protocolResume:v.pending?{proofHash,pendingHash:hash(v.pending)}:null};});}
  const result={proofHash,...verified,oldPreserved:267,flushed:11,originalPendingPreserved:2,abandonedAttempts:0,grantExpiresAt:grant.expiresAt,at:this.now(),sourceRequests:0,replayedBets:0,validRecordsDeleted:0};
  await this.store.create('journal',this.prefix+':reconciled',result,{immutable:true});await this.boundary();
  await this.store.update('state',this.poolKey,v=>{assert(hash(v)===hash(s.pool.value),'POOL_CHANGED');for(const w of Object.values(v.workers)){w.owner=null;w.leaseUntil=0;w.resumeSafe=true;}return {...v,enabled:true,failure:null,protocolRecovery:proofHash};});
  await this.store.update('state','campaign',v=>{assert(hash(v)===hash(s.campaign.value),'CAMPAIGN_CHANGED');return {...v,protocolValidation:{phase:'short',gameId:32739,proofHash,commit:this.commit,runKey:null,nestedShort:hash(spec)}};});
  await completeStage(this,result);return result;
 }finally{this.recovering=false;}}
 async validate(){
  const {s,base}=await this.reviewedShort();assert(!(await this.store.get('journal',this.prefix+':validation')),'VALIDATION_ALREADY_APPLIED');await this.archives();
  const pf=new PendingFirst({store:this.store,transport:this.transport,analyzer:this.parser,plan:this.plan,stage:'capture',runKey:s.campaign.value.protocolValidation.runKey,now:this.now});
  const spec=await pf.load({commitSha:this.commit});assert(spec.schema==='sg-demon-nested-short-v1','NESTED_PROOF_CHANGED');for(const e of spec.entries)await pf.settled(e);
  const full=await this.verifyRecords(s,{allCommitted:true});assert(full.count===446&&Object.keys(full.workerCounts).length===20,'SHORT_COUNT_CHANGED');
  for(let w=0;w<20;w++)assert(full.workerCounts[w]-(spec.baseline[w]||0)===10,'SHORT_WORKER_COUNT_CHANGED');
  const before=(await this.store.get('journal',this.prefix+':before')).value;
  for(const {value:b} of before.batches){
   const after=s.batches.find(x=>x.value.id===b.id)?.value;assert(after&&['id','worker','start','end','sessionHash'].every(k=>after[k]===b[k]),'ORIGINAL_BATCH_CHANGED');
   const rows=(await this.store.get('journal',`${this.prefix}:records:${b.id}`)).value.records;
   if(rows.length){const current=await this.store.getMany('journal',rows.map(r=>receiptKey(this.plan.trialId,r.sequence)));assert(current.every((x,i)=>x&&stable(x.value)===stable(rows[i])),'OLD_RECORDS_CHANGED');}
  }
  for(const [sequence,e] of Object.entries(this.profile.archives)){
   const a=(await this.store.get('journal',e.prefix+':abandoned:'+e.batch)).value,t=(await this.store.get('journal',e.prefix+':reconciled')).value;
   const r=(await this.store.get('journal',receiptKey(this.plan.trialId,Number(sequence))))?.value;
   assert(r&&r.batchId===e.batch&&r.shardId===e.worker&&r.sourceSessionHash===a.sessionHash&&r.attempt!==a.pending.attempt
    &&r.raw.steps.filter(x=>x.msgId==='BET').length===1&&r.raw.steps[0].ts>new Date(t.at).toISOString(),'OLD_ARCHIVE_REPLAYED');
  }
  const feature=(await this.store.get('journal',receiptKey(this.plan.trialId,218)))?.value;
  assert(feature?.bonus===2&&feature.fixtureOnly===false&&feature.buy===0&&nextRequest(feature.raw)===null,'LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED');
  await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
  const result={proofHash:base.proofHash,fullReadback:446,oldPreserved:267,newComplete:179,originalTotalNew:200,originalPendingSettled:2,replacementAttemptsSettled:5,liveDemonFeature:{sequence:218,rawHash:hash(feature.raw)},pending:0,poolHash:hash(s.pool.value),campaignHash:hash(s.campaign.value),at:this.now()};
  await this.store.create('journal',this.prefix+':validation',result,{immutable:true});return result;
 }
 async formal(){const {s,base}=await this.reviewedShort(),v=(await this.store.get('journal',this.prefix+':validation'))?.value;
  assert(v?.proofHash===base.proofHash&&v.fullReadback===446&&v.originalPendingSettled===2&&v.replacementAttemptsSettled===5&&v.liveDemonFeature
   &&v.poolHash===hash(s.pool.value)&&v.campaignHash===hash(s.campaign.value)&&this.now()>=v.at&&this.now()-v.at<900000,'VALIDATION_STALE_OR_CHANGED');
  const feature=(await this.store.get('journal',receiptKey(this.plan.trialId,218)))?.value;
  assert(feature?.bonus===2&&hash(feature.raw)===v.liveDemonFeature.rawHash&&nextRequest(feature.raw)===null,'LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED');
  await this.store.create('journal',this.prefix+':formal',{validation:v,commit:this.commit,at:this.now()},{immutable:true});
  await this.store.update('state','campaign',c=>{assert(hash(c)===v.campaignHash,'CAMPAIGN_CHANGED');return {...c,validationLimit:0,protocolValidation:null};});return {proofHash:base.proofHash,validationLimit:0,sourceRequests:0};
 }
}
