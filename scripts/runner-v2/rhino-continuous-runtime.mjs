import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkCountPeerDescriptor} from './count-peer-boundary.mjs';

// Reuse the independently applied two-session layout and its remaining target.
// Runtime refresh audits the ended run and every closed settlement beforehand.
export function checkRhinoContinuousRevision(profile,revision){
 assert(profile?.schema==='sg-session-layout-rhino-v1'&&profile.gameId===32799&&[2,4].includes(profile.sessionLayout?.lanesPerHost)
  &&revision?.schema==='sg-count-runtime-refresh-profile-v1'&&revision.purpose===(profile.sessionLayout.lanesPerHost===4?'continuous-four-count-v1':'continuous-count-v1')
  &&revision.gameId===32799&&revision.profileHash===hash(profile)&&revision.activation===profile.activation
  &&revision.captureMinutes===220&&revision.newBetAllowance===0&&revision.resourceObservation==='sg-resource-observation-v1'
  &&Number.isSafeInteger(revision.completePreserved)&&revision.completePreserved>=profile.completePreserved
  &&revision.completePreserved<300000&&revision.remainingComplete===300000-revision.completePreserved,'RHINO_CONTINUOUS_PERMISSION');
 if(profile.sessionLayout.lanesPerHost===4)assert(/^[a-f0-9]{64}$/.test(revision.fourSessionProofHash??''),'RHINO_FOUR_RESOURCE_PROOF_REQUIRED');
 if(revision.secondaryPeer)checkCountPeerDescriptor(revision.secondaryPeer,'primary');
 return revision.captureMinutes;
}
export function rhinoContinuousMinutes(profile,revision,receipt,commit){
 const minutes=checkRhinoContinuousRevision(profile,revision);
 assert(receipt?.schema==='sg-count-runtime-v2'&&receipt.commit===commit&&receipt.profileHash===hash(profile)
  &&receipt.activation===profile.activation&&receipt.revisionHash===hash(revision)&&receipt.newBetAllowance===0
  &&receipt.sourceRequests===0,'RHINO_CONTINUOUS_RECEIPT');
 return minutes;
}

export async function checkFourContinuousProof({store,plan,profile,revision}){
 if(profile.sessionLayout?.lanesPerHost!==4)return;
 checkRhinoContinuousRevision(profile,revision);
 const proof=(await store.get('journal',`session-comparison:${plan.trialId}:${revision.fourSessionProofHash}`))?.value;
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${revision.sourceRun}`))?.value;
 assert(proof?.schema==='sg-four-session-window-review-v1'&&hash(proof)===revision.fourSessionProofHash
  &&proof.run===revision.sourceRun&&proof.commit===revision.fromCommit&&proof.trialId===plan.trialId
  &&proof.activation===profile.activation&&proof.profileHash===hash(profile)
  &&permit?.schema==='sg-count-run-v1'&&permit.run===proof.run&&permit.commit===proof.commit
  &&permit.activation===profile.activation&&permit.profileHash===hash(profile)
  &&proof.sourcePermitHash===revision.sourcePermitHash&&hash(permit)===revision.sourcePermitHash
  &&proof.complete===revision.completePreserved&&proof.remainingComplete===revision.remainingComplete
  &&proof.sourceRequests===0&&proof.databaseWrites===0&&proof.sourceAllowance===0,'RHINO_FOUR_RESOURCE_PROOF_BINDING');
 const r=proof.safety,w=proof.window;
 assert(r?.schema==='sg-resource-workers-review-v1'&&r.run===proof.run&&r.commit===proof.commit
  &&r.logSha256===proof.logSha256&&r.workers===80&&r.verified===true&&r.resourceEvidenceComplete===true
  &&r.backendEvidenceComplete===true&&r.hostEvidenceComplete===true&&r.sourceErrors===0&&r.unknown===0&&r.resourceHolds===0
  &&r.startMs===w?.startMs&&r.endMs===w.endMs&&w.endMs-w.startMs===600000
  &&w.stableIntervalCandidate===true&&w.missing===0&&w.invalid===0&&w.complete>0
  &&[r.peakCpuPercent,r.peakMemoryPercent,r.hostPeakCpuPercent,r.hostPeakMemoryPercent].every(v=>Number.isFinite(v)&&v>=0&&v<95)
  &&r.minDiskFreeBytes>=30*1024**3,'RHINO_FOUR_RESOURCE_PROOF_UNSAFE');
 const comparison=(await store.get('journal',`session-comparison:${plan.trialId}:${profile.comparisonHash}`))?.value,b=comparison?.candidate,m=proof.metrics;
 assert(comparison?.schema==='sg-session-comparison-v1'&&comparison.mode==='same-run-canary-v1'
  &&hash(comparison)===profile.comparisonHash&&comparison.profileHash===profile.parentProfileHash
  &&comparison.activation===profile.parentActivation&&comparison.trialId===plan.trialId
  &&comparison.fullReadback===true&&b?.lanesPerHost===2&&b.durationMs===600000
  &&b.errors===0&&b.unknown===0&&b.resourceHolds===0&&b.complete>0&&b.requestP95Ms>0
  &&m?.lanesPerHost===4&&m.durationMs===600000&&m.complete===w.complete
  &&Number.isFinite(m.requestP95Ms)&&m.requestP95Ms>0&&m.complete>b.complete&&m.requestP95Ms<=b.requestP95Ms,'RHINO_FOUR_NOT_IMPROVED');
 return proof;
}
