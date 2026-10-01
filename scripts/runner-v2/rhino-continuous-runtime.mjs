import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkCountPeerDescriptor} from './count-peer-boundary.mjs';

// Reuse the independently applied two-session layout and its remaining target.
// Runtime refresh audits the ended run and every closed settlement beforehand.
export function checkRhinoContinuousRevision(profile,revision){
 assert(profile?.schema==='sg-session-layout-rhino-v1'&&profile.gameId===32799&&profile.sessionLayout?.lanesPerHost===2
  &&revision?.schema==='sg-count-runtime-refresh-profile-v1'&&revision.purpose==='continuous-count-v1'
  &&revision.gameId===32799&&revision.profileHash===hash(profile)&&revision.activation===profile.activation
  &&revision.captureMinutes===220&&revision.newBetAllowance===0&&revision.resourceObservation==='sg-resource-observation-v1'
  &&Number.isSafeInteger(revision.completePreserved)&&revision.completePreserved>=profile.completePreserved
  &&revision.completePreserved<300000&&revision.remainingComplete===300000-revision.completePreserved,'RHINO_CONTINUOUS_PERMISSION');
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
