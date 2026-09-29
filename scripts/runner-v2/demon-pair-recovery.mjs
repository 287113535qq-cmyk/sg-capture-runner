import assert from 'node:assert/strict';
import {DemonNestedRecovery} from './demon-nested-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
import {nextRequest} from '../trial/squid-protocol.mjs';
import {ZERO_PROOF} from './demon-nested-short.mjs';
import {reviewPair,residualPlan,INCIDENT as I} from './demon-pair-review.mjs';
import {reviewRebindAncestor} from './demon-pair-ancestor.mjs';
import {beginStage,stageBoundary,completeStage} from './demon-pair-stage.mjs';
import {PairResidual} from './demon-pair-residual.mjs';
export class DemonPairRecovery extends DemonNestedRecovery{
 constructor(args){super(args);this.prefix=I.prefix;assert(typeof this.checkLeases==='function','LEASE_REVIEW_REQUIRED');}
 async ancestor(){return reviewRebindAncestor(this);}
 async boundary(){
  await this.githubIdle();await this.store.writable();assert(this.gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  const holds=await this.transport.request('global_holds'),a=holds.find(x=>x._id==='primary/global-hold'),b=holds.find(x=>x._id==='secondary/global-hold');
  assert(holds.length===2&&a&&b?.value.active===false,'GLOBAL_HOLD');
  if(this.recovering)assert(hash(a.value)===this.profile.primaryHoldHash&&hash(b.value)===this.profile.secondaryHoldHash&&a.value.active===true&&a.value.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'&&a.value.details?.code==='SOURCE_REJECTED'&&a.value.details.batchId===5&&a.value.details.trialId===this.plan.trialId&&!a.value.details.cooldownUntil,'UNREVIEWED_PAIR_HOLD');
  else assert(a.value.active===false,'GLOBAL_HOLD');
  await this.ancestor();await stageBoundary(this);return holds;
 }
 async recover(){this.recovering=true;try{
  const holds=await this.boundary(),s=await this.snapshots(),history=await this.ancestor(),original=(await this.store.get('journal','fresh-start:'+ZERO_PROOF))?.value;
  reviewPair({plan:this.plan,profile:this.profile,s,prior:history.before,original,now:this.now()});await this.checkLeases();await this.archives();
  assert(!(await this.store.get('journal',I.prefix+':proof')),'RECOVERY_ALREADY_STARTED');
  for(const e of I.rejected){const raw=history.before.batches.find(x=>x.value.id===e.batch).value.pending.raw;assert(hash(await this.parser.call({op:'next',plan:this.plan,raw}))===hash({MSGID:'FREE_GAME'}),'ORIGINAL_CONTINUATION_CHANGED');}
  const full=await this.verifyRecords(s,{allCommitted:true});assert(full.count===267&&full.committed===267&&full.recordsHash===this.profile.recordsHash,'PAIR_RECORDS_CHANGED');
  await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');await this.checkLeases();await beginStage(this,s,full);await this.boundary();
  const proof={schema:'sg-demon-pair-proof-v1',profileHash:hash(this.profile),snapshotHash:hash(s),verified:full,previousProof:I.proof,commit:this.commit,run:this.run,createdAt:this.now()},proofHash=hash(proof);
  await this.store.create('journal',I.prefix+':proof',{proof,proofHash,profile:this.profile},{immutable:true});await this.store.create('journal',I.prefix+':before',{...s,holds},{immutable:true});
  assert(hash(await this.verifyRecords(s,{backup:true,allCommitted:true}))===hash(full),'BACKUP_CHANGED');
  for(const e of I.rejected){const b=s.batches.find(x=>x.value.id===e.batch).value;await this.store.create('journal',I.prefix+':abandoned:'+e.batch,{proofHash,worker:e.worker,sessionHash:b.sessionHash,disposition:'source-invalid-session/abandon_without_replay',pending:b.pending},{immutable:true});}
  await this.store.create('journal',I.prefix+':backup-complete',{proofHash,snapshotHash:hash(s),recordsHash:full.recordsHash},{immutable:true});
  await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
  const cleared=s.batches.map(x=>({value:{...x.value,pending:null,protocolResume:null}}));
  const spec=residualPlan({plan:this.plan,batches:cleared,original,proofHash,commit:this.commit,createdAt:this.now(),expiresAt:this.profile.createdAt+7200000});
  await this.store.create('journal','fresh-start:'+proofHash,spec,{immutable:true});
  for(const {value:b} of s.batches){await this.boundary();await this.store.update('state',`batch:${this.plan.trialId}:${b.id}`,v=>{assert(hash(v)===hash(b),'BATCH_CHANGED');return {...v,epoch:v.epoch+1,owner:null,leaseUntil:0,pending:null,protocolResume:null,protocolRecovery:proofHash,...(I.rejected.some(e=>e.batch===b.id)?{abandonedAttemptProof:proofHash}:{})};});}
  const result={proofHash,...full,oldPreserved:267,flushed:0,originalPendingPreserved:0,abandonedAttempts:2,at:this.now(),sourceRequests:0,replayedBets:0,validRecordsDeleted:0};
  await this.store.create('journal',I.prefix+':reconciled',result,{immutable:true});await this.boundary();
  await this.store.update('state',this.poolKey,v=>{assert(hash(v)===hash(s.pool.value),'POOL_CHANGED');for(const w of Object.values(v.workers)){w.owner=null;w.leaseUntil=0;w.resumeSafe=true;}return {...v,protocolRecovery:proofHash};});
  await this.store.update('state','campaign',v=>{assert(hash(v)===hash(s.campaign.value),'CAMPAIGN_CHANGED');v.games.find(g=>g.game_id===32739).status='active';return {...v,protocolValidation:{phase:'short',gameId:32739,proofHash,commit:this.commit,runKey:null,freshStart:hash(spec)}};});
  await this.boundary();await this.store.update('state','global-hold',v=>{assert(hash(v)===this.profile.primaryHoldHash,'HOLD_CHANGED');return {...v,active:false,reason:null,demonPairRecovery:proofHash};});
  await completeStage(this,result);return result;
 }finally{this.recovering=false;}}
 async feature(before,s){
  for(const {value:b} of s.batches){const start=Math.max(b.start,(before.batches.find(x=>x.value.id===b.id)?.value.journaled??b.start-1)+1);const keys=Array.from({length:Math.max(0,b.journaled-start+1)},(_,i)=>receiptKey(this.plan.trialId,start+i));
   for(const x of keys.length?await this.store.getMany('journal',keys):[]){const r=x?.value;if(r?.bonus!==2)continue;assert(r.fixtureOnly===false&&r.buy===0&&r.raw.steps.filter(x=>x.msgId==='BET').length===1&&nextRequest(r.raw)===null,'LIVE_FEATURE_INVALID');await this.parser.call({op:'verify',plan:this.plan,raw:r.raw,record:r});const got=await this.transport.request('rounds_read',{trialId:this.plan.trialId,ids:[r._id]});assert(got.length===1&&hash(got[0])===hash(r),'LIVE_FEATURE_MONGO_CHANGED');return {sequence:r.sequence,attemptHash:hash(r.attempt),rawHash:hash(r.raw),recordHash:hash(r)};}
  }throw Error('LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED');
 }
 async validate(){
  const {s,base}=await this.reviewedShort();await this.checkLeases();await this.archives();assert(!(await this.store.get('journal',I.prefix+':validation')),'VALIDATION_ALREADY_APPLIED');
  const admission=new PairResidual({store:this.store,plan:this.plan,stage:'fresh',runKey:s.campaign.value.protocolValidation.runKey,now:this.now}),spec=await admission.load({commitSha:this.commit});
  const full=await this.verifyRecords(s,{allCommitted:true});assert(full.count===446&&full.committed===446&&Object.keys(full.workerCounts).length===20&&Array.from({length:20},(_,w)=>full.workerCounts[w]-spec.baseline[w]).every(n=>n===10),'PAIR_QUOTA_INCOMPLETE');
  const before=(await this.store.get('journal',I.prefix+':before')).value;
  for(const {value:b} of before.batches){const a=s.batches.find(x=>x.value.id===b.id)?.value;assert(a&&['id','worker','start','end','sessionHash'].every(k=>a[k]===b[k]),'ORIGINAL_BATCH_CHANGED');const rows=(await this.store.get('journal',`${I.prefix}:records:${b.id}`))?.value.records;assert(Array.isArray(rows),'BACKUP_MISSING');if(rows.length){const got=await this.store.getMany('journal',rows.map(r=>receiptKey(this.plan.trialId,r.sequence)));assert(got.every((x,i)=>x&&hash(x.value)===hash(rows[i])),'OLD_RECORDS_CHANGED');}}
  const replacements=[...Object.entries(this.profile.archives).map(([sequence,e])=>({...e,sequence:Number(sequence)})),...I.rejected.map(e=>({...e,prefix:I.prefix}))];
  for(const e of replacements){const a=(await this.store.get('journal',e.prefix+':abandoned:'+e.batch))?.value,t=(await this.store.get('journal',e.prefix+':reconciled'))?.value,r=(await this.store.get('journal',receiptKey(this.plan.trialId,e.sequence)))?.value;
   assert(a&&t&&r&&r.batchId===e.batch&&r.shardId===e.worker&&r.sourceSessionHash===a.sessionHash&&r.attempt!==a.pending.attempt&&r.raw.steps.filter(x=>x.msgId==='BET').length===1&&r.raw.steps[0].ts>new Date(t.at).toISOString(),'PAIR_REPLACEMENT_REPLAYED');}
  assert(replacements.length===7,'PAIR_REPLACEMENTS_INCOMPLETE');const feature=await this.feature(before,s);await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
  const result={proofHash:base.proofHash,fullReadback:446,oldPreserved:267,newComplete:179,originalTotalNew:200,replacementAttemptsSettled:7,originalPendingSettled:0,liveDemonFeature:feature,pending:0,poolHash:hash(s.pool.value),campaignHash:hash(s.campaign.value),at:this.now()};await this.store.create('journal',I.prefix+':validation',result,{immutable:true});return result;
 }
 async formal(){const {s,base}=await this.reviewedShort(),v=(await this.store.get('journal',I.prefix+':validation'))?.value;await this.checkLeases();
  assert(v?.proofHash===base.proofHash&&v.fullReadback===446&&v.oldPreserved===267&&v.newComplete===179&&v.replacementAttemptsSettled===7&&v.originalPendingSettled===0&&v.liveDemonFeature&&v.poolHash===hash(s.pool.value)&&v.campaignHash===hash(s.campaign.value)&&this.now()>=v.at&&this.now()-v.at<900000,'VALIDATION_STALE_OR_CHANGED');
  const before=(await this.store.get('journal',I.prefix+':before')).value;assert(hash(await this.feature(before,s))===hash(v.liveDemonFeature),'LIVE_FEATURE_CHANGED');await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
  await this.store.create('journal',I.prefix+':formal',{validation:v,commit:this.commit,at:this.now()},{immutable:true});await this.store.update('state','campaign',c=>{assert(hash(c)===v.campaignHash,'CAMPAIGN_CHANGED');return {...c,validationLimit:0,protocolValidation:null};});return {proofHash:base.proofHash,validationLimit:0,sourceRequests:0};
 }
}
