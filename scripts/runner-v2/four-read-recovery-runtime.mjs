import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export const fourReadRecoveryName='count-runtime-rhino-four-read-recovery-20261002.json';
export function checkFourReadRecovery(profile,revision){
 assert(profile?.schema==='sg-session-layout-rhino-v1'&&profile.gameId===32799&&profile.sessionLayout?.lanesPerHost===4
  &&revision?.schema==='sg-count-runtime-refresh-profile-v1'&&revision.purpose==='bounded-four-read-recovery-v1'
  &&revision.profileHash===hash(profile)&&revision.activation===profile.activation&&revision.gameId===32799
  &&revision.sourceRun==='36908875451:1'&&revision.fromCommit==='f1cf4b3c82216daf35c03957e88ac96d55e1a549'
  &&revision.captureMinutes===20&&revision.newBetAllowance===0&&revision.completePreserved===247434
  &&revision.remainingComplete===52566&&revision.resourceObservation==='sg-resource-observation-v1'
  &&revision.hostResourceObservation==='sg-host-resource-observation-v1'&&revision.controlReadMode==='compact-worker-v1'
  &&/^[a-f0-9]{64}$/.test(revision.initialReadFailureHash??''),'FOUR_READ_RECOVERY_SCOPE');
 return 20;
}
export function fourReadRecoveryMinutes(profile,revision,receipt,commit){
 const minutes=checkFourReadRecovery(profile,revision);
 assert(receipt?.schema==='sg-count-runtime-v2'&&receipt.commit===commit&&receipt.profileHash===hash(profile)
  &&receipt.activation===profile.activation&&receipt.revisionHash===hash(revision)
  &&receipt.initialReadFailureHash===revision.initialReadFailureHash&&receipt.newBetAllowance===0&&receipt.sourceRequests===0,
  'FOUR_READ_RECOVERY_RECEIPT');
 return minutes;
}
