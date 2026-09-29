import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {original} from './expired-run-review.mjs';
export const ANCESTOR={prefix:'demon-queue:demon-two-36525403196',receipt:'queued-supersession:36525403196',commit:'4b38a0f306e6a3017b0245cd43a014acbc9a51ec',run:'36551302211:1',profileHash:'933af2a4689c4ea4be7aeabcee62ce0e5842896be12c98118c99c6c6a1b28689',proof:'5ac6d9068bf7b1c8d52f0ed7f8f17bf8a91f2b6265c58fb312701ccf7abbed26'};
// This only proves immutable history. Fresh GitHub boundary and the new incident
// profile/run/proof are separate requirements; the old expiry is never renewed.
export async function reviewQueueAncestor({store,profile,now=Date.now}){
 const a=ANCESTOR,read=async k=>(await store.get('journal',k))?.value;
 const r=await read(a.receipt),d=await read(a.receipt+':complete');
 assert(r && d && hash(r)===profile.ancestorReceiptHash && hash(d)===profile.ancestorCompleteHash,'ANCESTOR_RECEIPT_CHANGED');
 assert(r.schema==='sg-queued-supersession-v1' && r.oldRun===original.id && r.oldCommit===original.commit
  && r.oldProfileHash===original.profileHash && r.oldExpiresAt===original.expiresAt
  && r.newPrefix===a.prefix && r.newCommit===a.commit && r.newRun===a.run && r.newProfileHash===a.profileHash,'ANCESTOR_BINDING_CHANGED');
 assert(d.receiptHash===hash(r) && d.commit===a.commit && d.run===a.run && d.proofHash===a.proof
  && d.at>=r.createdAt && d.at<r.expiresAt && now()>=d.at && now()>=original.expiresAt+300000,'ANCESTOR_NOT_COMPLETED');
 const p=await read(a.prefix+':proof'),b=await read(a.prefix+':backup-complete'),c=await read(a.prefix+':reconciled');
 assert(p?.proofHash===a.proof && hash(p.proof)===a.proof && hash(p.profile)===a.profileHash
  && p.proof.profileHash===a.profileHash && p.proof.commit===a.commit
  && b?.proofHash===a.proof && c?.proofHash===a.proof && c.count===246 && c.oldPreserved===246
  && c.originalPendingPreserved===2 && c.abandonedAttempts===1 && c.sourceRequests===0,'ANCESTOR_BACKUP_CHANGED');
 const old=['proof','before','backup-complete','abandoned:2','reconciled',...Array.from({length:19},(_,i)=>'records:'+(i+1))];
 assert((await store.getMany('journal',old.map(k=>'demon-two:demon-two-36524060044:'+k))).every(x=>!x),'OLD_RECOVERY_HAS_WRITES');
 return {receiptHash:hash(r),completeHash:hash(d),proofHash:a.proof};
}
