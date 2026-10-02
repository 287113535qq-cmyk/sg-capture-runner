import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {directCaptureJobs} from './action-direct-resource.mjs';
import {checkDirectRelayBinding,directRelayTargetReached} from './action-direct-relay-runtime.mjs';
export async function checkDirectFinalAudit({store,base,plan,profile,revision,permission,source,jobs,spec,complete,receipt,now=Date.now}){
 assert(permission?.schema==='sg-direct-final-audit-v1'&&permission.gameId===32721&&permission.trialId===plan.trialId
  &&permission.sourceRun===`${source?.id}:${source?.run_attempt}`&&permission.sourceCommit===source.head_sha
  &&permission.profileHash===hash(profile)&&permission.revisionHash===hash(revision)
  &&permission.target===plan.target&&permission.sourceRequests===0&&permission.newBetAllowance===0
  &&Number.isSafeInteger(permission.createdAt)&&permission.createdAt<=now()&&now()<permission.expiresAt
  &&permission.expiresAt-permission.createdAt<=7200000,'DIRECT_AUDIT_PERMISSION');
 assert(source.status==='completed'&&source.conclusion==='success','DIRECT_AUDIT_SOURCE_NOT_ENDED');
 directCaptureJobs({source,jobs,commit:permission.sourceCommit});
 assert(jobs.jobs.every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion)),'DIRECT_AUDIT_SOURCE_JOBS');
 checkDirectRelayBinding({base,plan,profile,revision,spec,complete,receipt,commit:permission.sourceCommit});
 assert(hash(spec)===permission.specHash&&hash(receipt)===permission.receiptHash,'DIRECT_AUDIT_BINDING');
 assert(await directRelayTargetReached({store,plan,spec,now}),'DIRECT_AUDIT_NOT_AT_TARGET');
 return {verified:true,sourceRequests:0,newBetAllowance:0};
}
