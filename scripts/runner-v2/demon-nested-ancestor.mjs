import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewOneAncestor} from './demon-zero-ancestor.mjs';
import {ZERO_PROOF,ZERO_SPEC_HASH} from './demon-nested-short.mjs';
export const ZERO={prefix:'demon-zero:demon-zero-36559066920',stage:'demon-zero-stage:36559066920',
 commit:'a7f550910c16e7de7bfa2fcb7c44ed73614905da',run:'36562547221:1',
 profileHash:'0f5cd88157a487984f9deb5d736b5f7acae3aa02394af606738b3e071fc8e12f',proof:ZERO_PROOF};
export async function reviewZeroAncestor(o){
 await reviewOneAncestor(o);
 const read=async key=>(await o.store.get('journal',key))?.value;
 const s=await read(ZERO.stage),d=await read(ZERO.stage+':complete'),p=await read(ZERO.prefix+':proof');
 const b=await read(ZERO.prefix+':backup-complete'),r=await read(ZERO.prefix+':reconciled');
 assert(s&&d&&hash(s)===o.profile.zeroStageHash&&hash(d)===o.profile.zeroCompleteHash
  &&s.schema==='sg-demon-zero-stage-v1'&&s.commit===ZERO.commit&&s.run===ZERO.run&&s.profileHash===ZERO.profileHash
  &&d.stageHash===hash(s)&&d.commit===ZERO.commit&&d.run===ZERO.run&&d.proofHash===ZERO.proof
  &&d.at>=s.createdAt&&d.at<s.expiresAt&&o.now()>=d.at,'ZERO_HISTORY_CHANGED');
 assert(p?.proofHash===ZERO.proof&&hash(p.proof)===ZERO.proof&&hash(p.profile)===ZERO.profileHash
  &&p.proof.profileHash===ZERO.profileHash&&p.proof.commit===ZERO.commit&&p.proof.run===ZERO.run
  &&b?.proofHash===ZERO.proof&&r?.proofHash===ZERO.proof&&r.count===246&&r.oldPreserved===246
  &&r.originalPendingPreserved===0&&r.abandonedAttempts===1&&r.sourceRequests===0,'ZERO_BACKUP_CHANGED');
 const spec=await read('fresh-start:'+ZERO.proof);
 assert(hash(spec)===ZERO_SPEC_HASH,'ORIGINAL_QUOTA_CHANGED');
 return spec;
}
