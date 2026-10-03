import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// A verification run never starts another matrix. Ordinary prepared capture
// may consume the next reviewed game after finalization; it cannot regrant
// the stopped game's allocation or wait for gameplay classification.
export async function preparedNextGameAllowed({inputs,profile,store,run,commit}){
 if(inputs.role!=='formal-count')return true;
 if(profile?.schema!=='sg-prepared-count-profile-v1')return false;
 if(inputs.formal_relay&&inputs.formal_relay!=='none')return false;
 assert(/^\d+:1$/.test(run)&&/^[a-f0-9]{40}$/.test(commit),'PREPARED_NEXT_IDENTITY');
 const permit=(await store.get('journal',`count-run:${profile.trialId}:${run}`))?.value;
 assert(permit?.schema==='sg-count-run-v1'&&permit.run===run&&permit.commit===commit
  &&permit.activation===profile.activation&&permit.profileHash===hash(profile),
  'PREPARED_NEXT_SOURCE_PERMISSION');
 assert([5,15,240].includes(permit.captureMinutes)
  &&permit.verificationWindow===(permit.captureMinutes===5),'PREPARED_NEXT_WINDOW');
 return permit.verificationWindow===false;
}
