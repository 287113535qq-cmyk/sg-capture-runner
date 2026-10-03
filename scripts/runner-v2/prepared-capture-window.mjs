import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// A first prepared runtime gets a bounded verification window, not a new quota.
// Longer windows must be explicitly present in its registered immutable revision.
export function preparedCaptureWindow({profile,revision,receipt,commit}){
 assert(profile?.schema==='sg-prepared-count-profile-v1','PREPARED_WINDOW_PROFILE');
 if(revision){
  assert(['sg-prepared-zero-source-runtime-v1','sg-prepared-settled-runtime-v1'].includes(revision.schema)
   &&revision.activation===profile.activation&&revision.gameId===profile.gameId&&revision.profileHash===hash(profile)
   &&receipt?.schema==='sg-count-runtime-v2'&&receipt.commit===commit&&receipt.activation===profile.activation
   &&receipt.profileHash===hash(profile)&&receipt.revisionHash===hash(revision)
   &&receipt.sourceRequests===0&&receipt.newBetAllowance===0,'PREPARED_WINDOW_BINDING');
 }
 const minutes=revision?.captureMinutes??5;
 assert([5,15,240].includes(minutes),'PREPARED_WINDOW_DURATION');
 return {minutes,verification:minutes===5,revisionHash:revision?hash(revision):hash(profile)};
}
