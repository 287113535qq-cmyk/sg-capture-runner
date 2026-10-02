import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {validatePreparationProof} from './work-line-events.mjs';

export function reviewCaptureHandoff(receipt,profile,now=Date.now()){
 assert(receipt?.schema==='sg-capture-ready-handoff-v1'
  &&/^[a-f0-9]{40}$/.test(receipt.commit)&&/^[a-f0-9]{64}$/.test(receipt.profileHash)
  &&/^[a-z0-9][a-z0-9-]*\.json$/.test(receipt.profile),'CAPTURE_READY_SCOPE');
 assert(profile.schema==='sg-demo-next-game-v1'&&profile.gameId===receipt.gameId
  &&profile.group===receipt.group&&['primary','secondary'].includes(profile.group)
  &&profile.generation===receipt.generation&&hash(profile)===receipt.profileHash,'CAPTURE_READY_PROFILE_CHANGED');
 assert(Number.isSafeInteger(profile.createdAt)&&Number.isSafeInteger(profile.expiresAt)
  &&now>=profile.createdAt&&now<profile.expiresAt&&profile.expiresAt-profile.createdAt<=7200000,'CAPTURE_READY_PROFILE_STALE');
 assert(profile.newBetAllowance===100&&profile.workers===20&&profile.perWorker===5
  &&profile.workerOffset===(profile.group==='primary'?0:20)
  &&profile.basePlan?.gameId===receipt.gameId&&profile.basePlan.buy===0
  &&profile.basePlan.phase===1&&profile.basePlan.mode==='demo','CAPTURE_READY_BUDGET_SCOPE');
 assert(validatePreparationProof(receipt.preparationProof,receipt.gameId)===receipt.preparationProofHash,'CAPTURE_READY_PROOF_CHANGED');
 return {schema:'sg-capture-dispatch-task-v1',status:'online-fresh-admission-required',receipt,
  workflow:'.github/workflows/trial-300k.yml',inputs:{role:'demo-fresh-short',round_limit:'100',allocation:'round-one',round_one_limit:'5',pilot_profile:receipt.profile},
  sourceAllowance:0,sourceRequests:0,dispatched:false};
}
