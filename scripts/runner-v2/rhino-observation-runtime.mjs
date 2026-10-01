import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function checkRhinoObservationRevision(profile,revision){
 assert(profile?.schema==='sg-session-layout-rhino-v1'&&profile.gameId===32799&&profile.sessionLayout?.lanesPerHost===2
  &&revision?.schema==='sg-count-runtime-refresh-profile-v1'&&revision.gameId===32799&&revision.profileHash===hash(profile)
  &&revision.activation===profile.activation&&revision.captureMinutes===30&&revision.newBetAllowance===0
  &&revision.resourceObservation==='sg-resource-observation-v1','RHINO_OBSERVATION_PERMISSION');
 return 30;
}
export function rhinoObservationMinutes(profile,revision,receipt,commit){
 const minutes=checkRhinoObservationRevision(profile,revision);
 assert(receipt?.schema==='sg-count-runtime-v2'&&receipt.commit===commit&&receipt.profileHash===hash(profile)
  &&receipt.activation===profile.activation&&receipt.revisionHash===hash(revision)&&receipt.newBetAllowance===0
  &&receipt.sourceRequests===0,'RHINO_OBSERVATION_RECEIPT');return minutes;
}
