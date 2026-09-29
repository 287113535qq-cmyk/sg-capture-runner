import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from './mongo-writer.mjs';
import {STAGE,ORIGINAL_PENDING_HASH} from './beaver-transition-contract.mjs';
const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
// Separate contract, not an expansion of the old incident policy allowlist.
export function reviewBeaverResume({plan,batch,grant,worker,sessionHash,commit,now}){
 const marker=batch.protocolResume,p=batch.pending,e=grant?.entry;
 assert(plan.gameId===32820&&plan.phase===1&&plan.buy===0&&grant?.schema==='sg-beaver-pending-only-v1'&&marker?.schema===grant.schema,'BEAVER_RESUME_SCOPE');
 assert(grant.gameId===32820&&grant.planHash===hash(plan)&&grant.trialId===plan.trialId&&grant.stage===STAGE&&grant.limit===1&&grant.newBetAllowance===0,'BEAVER_RESUME_PLAN');
 assert(/^[a-f0-9]{64}$/.test(grant.proofHash)&&marker.proofHash===grant.proofHash&&/^[a-f0-9]{40}$/.test(commit)&&grant.commit===commit,'BEAVER_RESUME_PROOF');
 assert(now>=grant.createdAt&&now<grant.expiresAt&&grant.expiresAt-grant.createdAt<=7200000,'BEAVER_RESUME_STALE');
 assert(worker===7&&e?.worker===7&&e.batchId===2&&batch.id===2&&batch.worker===7&&sessionHash===e.sessionHash&&batch.sessionHash===sessionHash,'BEAVER_RESUME_OWNER');
 assert(p?.sequence===120&&p.awaiting===null&&!batch.bootstrapAwaiting&&!batch.pendingOriginal&&!batch.failure&&batch.journaled===119&&batch.checkpoint===119&&batch.end>=120,'BEAVER_RESUME_UNSAFE');
 assert(hash(p)===ORIGINAL_PENDING_HASH&&hash(e.pending)===hash(p)&&marker.pendingHash===hash(p),'BEAVER_RESUME_PREFIX');
 return structuredClone(p);
}
