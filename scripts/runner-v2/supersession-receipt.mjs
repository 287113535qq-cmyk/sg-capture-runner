import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {original} from './expired-run-review.mjs';

export const RECEIPT_KEY='queued-supersession:36525403196';
export const NEW_PREFIX='demon-queue:demon-two-36525403196';
export class SupersessionReceipt {
  constructor({store,profile,commit,run,now=Date.now,checkOldRun,checkLeases}) {
    assert(/^[a-f0-9]{40}$/.test(commit) && commit!==original.commit,'NEW_COMMIT_REQUIRED');
    assert(/^\d+:1$/.test(run) && !run.startsWith(original.id+':'),'NEW_UNIQUE_RUN_REQUIRED');
    Object.assign(this,{store,profile,commit,run,now,checkOldRun,checkLeases});
  }
  async absentOldProof(){
    const keys=['proof','before','backup-complete','abandoned:2','reconciled',
      ...Array.from({length:19},(_,i)=>'records:'+(i+1))];
    const found=await this.store.getMany('journal',keys.map(k=>'demon-two:demon-two-36524060044:'+k));
    assert(found.every(x=>!x),'OLD_RECOVERY_HAS_WRITES');
  }
  async begin({snapshot,verified}) {
    assert(!(await this.store.get('journal',RECEIPT_KEY)),'SUPERSESSION_ALREADY_STARTED');
    assert(this.now()>=original.expiresAt+300000,'OLD_PROFILE_NOT_EXPIRED');
    assert(this.now()>=this.profile.createdAt && this.now()-this.profile.createdAt<7200000,'NEW_PROFILE_STALE');
    assert(verified.count===246 && verified.committed===246,'BASELINE_NOT_FULLY_COMMITTED');
    await this.checkOldRun();await this.checkLeases();await this.absentOldProof();
    const value={schema:'sg-queued-supersession-v1',oldRun:original.id,oldCommit:original.commit,
      oldProfileHash:original.profileHash,oldExpiresAt:original.expiresAt,
      newPrefix:NEW_PREFIX,newCommit:this.commit,newRun:this.run,newProfileHash:hash(this.profile),
      snapshotHash:hash(snapshot),verified,createdAt:this.now(),expiresAt:this.profile.createdAt+7200000};
    await this.store.create('journal',RECEIPT_KEY,value,{immutable:true});
    assert(hash((await this.store.get('journal',RECEIPT_KEY))?.value)===hash(value),'SUPERSESSION_READBACK_FAILED');
    return value;
  }
  async boundary({recovering=false}={}) {
    const r=(await this.store.get('journal',RECEIPT_KEY))?.value;
    assert(r?.schema==='sg-queued-supersession-v1' && r.oldRun===original.id
      && r.oldCommit===original.commit && r.oldProfileHash===original.profileHash
      && r.newPrefix===NEW_PREFIX && r.newCommit===this.commit && r.newProfileHash===hash(this.profile),
      'SUPERSESSION_BINDING_CHANGED');
    assert(this.now()>=r.createdAt && this.now()<r.expiresAt,'SUPERSESSION_EXPIRED');
    if(recovering)assert(r.newRun===this.run,'SUPERSESSION_OWNER_CHANGED');
    else {
      const done=(await this.store.get('journal',RECEIPT_KEY+':complete'))?.value;
      const proof=(await this.store.get('journal',NEW_PREFIX+':proof'))?.value;
      const reconciled=(await this.store.get('journal',NEW_PREFIX+':reconciled'))?.value;
      assert(done?.receiptHash===hash(r) && done.proofHash===proof?.proofHash
        && done.proofHash===reconciled?.proofHash && done.commit===this.commit,'SUPERSESSION_NOT_COMPLETE');
    }
    await this.checkOldRun();await this.absentOldProof();
    return r;
  }
  async complete(result){
    const r=await this.boundary({recovering:true});
    const proof=(await this.store.get('journal',NEW_PREFIX+':proof'))?.value;
    const reconciled=(await this.store.get('journal',NEW_PREFIX+':reconciled'))?.value;
    assert(result.proofHash===proof?.proofHash && result.proofHash===reconciled?.proofHash
      && result.count===246 && result.oldPreserved===246 && result.originalPendingPreserved===2,'RECOVERY_RECEIPT_MISMATCH');
    const value={receiptHash:hash(r),proofHash:result.proofHash,commit:this.commit,run:this.run,at:this.now()};
    await this.store.create('journal',RECEIPT_KEY+':complete',value,{immutable:true});
    assert(hash((await this.store.get('journal',RECEIPT_KEY+':complete'))?.value)===hash(value),'SUPERSESSION_READBACK_FAILED');
    return value;
  }
}
