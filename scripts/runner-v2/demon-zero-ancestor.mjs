import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewQueueAncestor} from './demon-one-ancestor.mjs';
export const ONE={prefix:'demon-one:demon-one-36551698305',stage:'demon-one-stage:36551698305',
 commit:'f68344a15e0185dfc26abc0c5f50ff98f6e0b50f',run:'36558680223:1',
 profileHash:'7624f15c9bc09064b8a3b233f982115f44013f1f5b00c26c958f14151a75e64a',
 proof:'199d5fdab13d33074b5d2362c1222dc6829e8f4592b1c5dbda47bf4906c88c41'};
export async function reviewOneAncestor(o){
 await reviewQueueAncestor(o);
 const read=async key=>(await o.store.get('journal',key))?.value;
 const s=await read(ONE.stage),d=await read(ONE.stage+':complete'),p=await read(ONE.prefix+':proof');
 const b=await read(ONE.prefix+':backup-complete'),r=await read(ONE.prefix+':reconciled');
 assert(s && d && hash(s)===o.profile.oneStageHash && hash(d)===o.profile.oneCompleteHash
  && s.schema==='sg-demon-one-stage-v1' && s.commit===ONE.commit && s.run===ONE.run && s.profileHash===ONE.profileHash
  && s.ancestorReceiptHash===o.profile.ancestorReceiptHash && s.ancestorCompleteHash===o.profile.ancestorCompleteHash
  && d.stageHash===hash(s) && d.commit===ONE.commit && d.run===ONE.run && d.proofHash===ONE.proof
  && d.at>=s.createdAt && d.at<s.expiresAt && o.now()>=d.at,'ONE_HISTORY_CHANGED');
 assert(p?.proofHash===ONE.proof && hash(p.proof)===ONE.proof && hash(p.profile)===ONE.profileHash
  && p.proof.profileHash===ONE.profileHash && p.proof.commit===ONE.commit && p.proof.run===ONE.run
  && b?.proofHash===ONE.proof && r?.proofHash===ONE.proof && r.count===246 && r.oldPreserved===246
  && r.originalPendingPreserved===1 && r.abandonedAttempts===1 && r.sourceRequests===0,'ONE_BACKUP_CHANGED');
 return {stageHash:hash(s),completeHash:hash(d),proofHash:ONE.proof};
}
