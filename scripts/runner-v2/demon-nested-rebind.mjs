import assert from 'node:assert/strict';
import {DemonNestedRecovery} from './demon-nested-recovery.mjs';
import {ProtocolRecovery} from './protocol-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {protocolGrant} from './protocol-recovery-core.mjs';
import {reviewZeroAncestor} from './demon-nested-ancestor.mjs';
import {nestedShortPlan} from './demon-nested-short.mjs';
import {beginStage,stageBoundary,completeStage,STAGE_KEY} from './demon-nested-rebind-stage.mjs';
export const PREVIOUS={prefix:'demon-nested:demon-nested-36562923330',stage:'demon-nested-stage:36562923330',proof:'de6ad5f8d8a469ac8afec5206afbd939e8ff85d0139b782a8214fa989737a968',profile:'9ab103f94fff55ef74c5f59a01c70891e8829e2b9a1b31d25fa4ecbb1d5504a7',commit:'bc0348918dc6d79c347cb84cd582928b9a77a6aa',run:'36574038011:1',failedRun:'capture-run:36574646755:1',spec:'c67b76ba5457b3108fde7071b2271c78d597c6633c227bbfba64be7c2c3e7fc2'};
export async function reviewNestedAncestor(o){
 await reviewZeroAncestor(o);const read=async k=>(await o.store.get('journal',k))?.value;
 const p=await read(PREVIOUS.prefix+':proof'),s=await read(PREVIOUS.stage),d=await read(PREVIOUS.stage+':complete'),r=await read(PREVIOUS.prefix+':reconciled'),spec=await read('pending-first:'+PREVIOUS.proof);
 assert(p?.proofHash===PREVIOUS.proof&&hash(p.proof)===PREVIOUS.proof&&hash(p.profile)===PREVIOUS.profile
  &&p.proof.commit===PREVIOUS.commit&&p.proof.run===PREVIOUS.run&&p.proof.profileHash===PREVIOUS.profile,'NESTED_ANCESTOR_PROOF_CHANGED');
 assert(s&&d&&s.profileHash===PREVIOUS.profile&&s.commit===PREVIOUS.commit&&s.run===PREVIOUS.run
  &&d.stageHash===hash(s)&&d.commit===s.commit&&d.run===s.run&&d.proofHash===PREVIOUS.proof
  &&d.at>=s.createdAt&&d.at<s.expiresAt&&o.now()>=d.at,'NESTED_ANCESTOR_STAGE_CHANGED');
 assert(r?.proofHash===PREVIOUS.proof&&r.count===267&&r.committed===267&&r.flushed===11&&r.abandonedAttempts===0
  &&r.originalPendingPreserved===2&&r.sourceRequests===0&&hash(spec)===o.profile.previousSpecHash,'NESTED_ANCESTOR_RESULT_CHANGED');
 return spec;
}
export class DemonNestedRebind extends DemonNestedRecovery{
 constructor(args){super(args);this.prefix='demon-nested-rebind:demon-nested-rebind-36574646755';}
 async boundary(){const holds=await ProtocolRecovery.prototype.boundary.call(this);await reviewNestedAncestor(this);await stageBoundary(this);return holds;}
 async recover(){this.recovering=true;try{
  const holds=await this.boundary(),s=await this.snapshots(),c=s.campaign.value,p=s.pool.value,profile=this.profile;
  assert(profile.schema==='sg-demon-nested-rebind-v1'&&profile.id==='demon-nested-rebind-36574646755'&&profile.complete===267&&profile.checkpoint===267&&profile.pending===2,'WRONG_REBIND_INCIDENT');
  assert(this.now()>=profile.createdAt&&this.now()-profile.createdAt<7200000,'INCIDENT_PROOF_STALE');
  assert(hash(s)===profile.snapshotHash&&hash(this.plan)===profile.planHash,'REBIND_STATE_CHANGED');
  assert(c.enabled&&!c.reason&&!c.audit&&c.activeGame===32739&&c.validationLimit===10&&c.games.find(g=>g.game_id===32739)?.status==='parking-protocol'
   &&c.protocolValidation.proofHash===PREVIOUS.proof&&c.protocolValidation.commit===PREVIOUS.commit&&c.protocolValidation.runKey===PREVIOUS.failedRun
   &&c.protocolValidation.nestedShort===profile.previousSpecHash&&p.enabled&&!p.failure&&p.protocolRecovery===PREVIOUS.proof,'REBIND_CAMPAIGN_CHANGED');
  assert(!(await this.store.get('journal',this.prefix+':proof')),'RECOVERY_ALREADY_STARTED');await this.checkLeases();await this.archives();
  const oldSpec=await reviewNestedAncestor(this),before=(await this.store.get('journal',PREVIOUS.prefix+':before')).value;
  assert(s.batches.length===19&&hash(p.workers)===profile.workersHash,'REBIND_WORKERS_CHANGED');
  for(const {value:b} of s.batches){const old=before.batches.find(x=>x.value.id===b.id)?.value;
   assert(old&&['id','worker','start','end','sessionHash','journaled'].every(k=>b[k]===old[k])&&b.checkpoint===b.journaled&&!b.failure&&!b.bootstrapAwaiting
    &&b.leaseUntil<=this.now()&&hash(b.pending)===hash(old.pending),'REBIND_ORIGINAL_CHANGED');
   if(b.pending){assert(b.protocolResume?.proofHash===PREVIOUS.proof&&oldSpec.entries.some(e=>e.batchId===b.id&&hash(e.pending)===hash(b.pending)),'REBIND_PERMISSION_CONSUMED');
    assert(hash(await this.parser.call({op:'next',plan:this.plan,raw:b.pending.raw}))===hash({MSGID:'FREE_GAME'}),'CONTINUATION_CHANGED');}
  }
  const full=await this.verifyRecords(s,{allCommitted:true});assert(full.count===267&&full.recordsHash===profile.recordsHash,'REBIND_RECORDS_CHANGED');
  await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');await this.checkLeases();await beginStage(this,s,full);
  const proof={schema:'sg-demon-nested-rebind-proof-v1',profileHash:hash(profile),snapshotHash:hash(s),verified:full,previousProof:PREVIOUS.proof,commit:this.commit,run:this.run,createdAt:this.now()},proofHash=hash(proof);
  await this.store.create('journal',this.prefix+':proof',{proof,proofHash,profile},{immutable:true});await this.store.create('journal',this.prefix+':before',{...s,holds},{immutable:true});
  assert(hash(await this.verifyRecords(s,{backup:true,allCommitted:true}))===hash(full),'BACKUP_CHANGED');
  await this.store.create('journal',this.prefix+':backup-complete',{proofHash,snapshotHash:hash(s),recordsHash:full.recordsHash},{immutable:true});
  await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
  const grant=protocolGrant({plan:this.plan,batches:s.batches,proofHash,commit:this.commit,now:this.now()});
  const original=await reviewZeroAncestor(this),spec={...nestedShortPlan({plan:this.plan,batches:s.batches,original,proofHash,commit:this.commit,createdAt:grant.createdAt,expiresAt:grant.expiresAt}),schema:'sg-demon-nested-rebind-short-v1',stageKey:STAGE_KEY};
  await this.store.create('journal','protocol-resume:'+proofHash,grant,{immutable:true});await this.store.create('journal','pending-first:'+proofHash,spec,{immutable:true});
  for(const {value:b} of s.batches){await this.boundary();await this.store.update('state',`batch:${this.plan.trialId}:${b.id}`,v=>{assert(hash(v)===hash(b),'BATCH_CHANGED');return {...v,epoch:v.epoch+1,protocolRecovery:proofHash,protocolResume:v.pending?{proofHash,pendingHash:hash(v.pending)}:null};});}
  const result={proofHash,...full,oldPreserved:267,flushed:0,originalPendingPreserved:2,abandonedAttempts:0,grantExpiresAt:grant.expiresAt,at:this.now(),sourceRequests:0,replayedBets:0,validRecordsDeleted:0};
  await this.store.create('journal',this.prefix+':reconciled',result,{immutable:true});await this.boundary();
  await this.store.update('state',this.poolKey,v=>{assert(hash(v)===hash(p),'POOL_CHANGED');return {...v,protocolRecovery:proofHash};});
  await this.store.update('state','campaign',v=>{assert(hash(v)===hash(c),'CAMPAIGN_CHANGED');v.games.find(g=>g.game_id===32739).status='active';return {...v,protocolValidation:{phase:'short',gameId:32739,proofHash,commit:this.commit,runKey:null,nestedShort:hash(spec)}};});
  await completeStage(this,result);return result;
 }finally{this.recovering=false;}}
}
