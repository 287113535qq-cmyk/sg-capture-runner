import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
// Read the real shared-stop closure; never relabel it as an ordinary retirement.
export async function reviewPyramidsMajorRetirement({store,profile,pool,retired,oldProfile}){
 const key='count-shared-close:sg_r1_20260928_32721:36848037333:1';
 assert(profile.retirementKey===key+':complete'&&pool.countSharedClosure===key
  &&retired?.schema==='sg-count-shared-close-v1'&&hash(retired)===profile.retirementHash
  &&retired.profileHash==='1d21c06584f4752c16daff71373c3abb7d5bcc89c67aca5f5043e89c5c82ac0a'
  &&retired.sourceRun===profile.sourceRun&&retired.sourceCommit===profile.sourceCommit
  &&retired.trialId==='sg_r1_20260928_32721'&&retired.activation===oldProfile.activation
  &&retired.completePreserved===3211&&retired.abandonedAttempts===2&&retired.unknownAttempts===0
  &&retired.recordsHash===profile.recordsHash&&retired.repairKey===profile.repairKey
  &&retired.sourceRequests===0&&retired.newBetAllowance===0&&retired.requiresNewSession===true
  &&retired.group==='secondary'&&retired.retirement===pool.retiredCount,'PYRAMIDS_MAJOR_SHARED_CLOSURE');
 const [settled,before,full]=await store.getMany('journal',[key+':settled',key+':before',retired.retirement+':complete']);
 assert(hash(settled?.value)===hash(retired)&&before?.value?.schema==='sg-count-shared-before-v1'
  &&before.value.profileHash===retired.profileHash&&before.value.commit===retired.commit&&before.value.run===retired.run
  &&full?.value?.schema==='sg-retired-count-result-v1'&&hash(full.value)===retired.retirementHash
  &&full.value.trialId===retired.trialId&&full.value.completePreserved===3211&&full.value.abandonedAttempts===2
  &&full.value.recordsHash===profile.recordsHash&&full.value.sourceRequests===0&&full.value.newBetAllowance===0,
  'PYRAMIDS_MAJOR_SHARED_READBACK');
 return retired;
}
