import assert from 'node:assert/strict';
import {DemonTwoRecovery,reviewDemonTwo,DEMON_TWO} from './demon-two-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {SupersessionReceipt,NEW_PREFIX,RECEIPT_KEY} from './supersession-receipt.mjs';

// Reuse the tested exact117 incident algorithm without changing any old profile.
// This wrapper owns a distinct prefix and a single immutable supersession receipt.
export class DemonQueueRecovery extends DemonTwoRecovery {
  constructor(args){
    super(args);this.prefix=NEW_PREFIX;
    this.supersession=new SupersessionReceipt({...args,checkOldRun:args.githubIdle});
  }
  async boundary(){
    // Before begin(), ordinary recovery review still uses all parent guards.
    if(await this.store.get('journal',RECEIPT_KEY))
      await this.supersession.boundary({recovering:this.recovering});
    return super.boundary();
  }
  async recover(){
    assert(!(await this.store.get('journal',RECEIPT_KEY)),'SUPERSESSION_ALREADY_STARTED');
    this.recovering=true;
    try {
      await this.boundary();const s=await this.snapshots();
      const prior=(await this.store.get('journal',DEMON_TWO.oldPrefix+':before'))?.value;
      reviewDemonTwo({plan:this.plan,profile:this.profile,s,prior,now:this.now()});
      await this.oldEvidence(s);
      const verified=await this.verifyRecords(s,{allCommitted:true});
      assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
      await this.supersession.begin({snapshot:s,verified});
      const result=await super.recover();
      // Parent ends recovering mode; receipt completion verifies ownership explicitly.
      await this.supersession.complete(result);return {...result,supersededRun:36525403196};
    } finally {this.recovering=false;}
  }
}
