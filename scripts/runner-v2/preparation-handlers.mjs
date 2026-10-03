import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparationGates} from './preparation-inventory.mjs';
export const preparationSourceHash=text=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');

// Fixed executable checks, never commands supplied by a mailbox or raw reply.
export const preparationHandlers=Object.freeze({
 32636:{node:['scripts/trial/piggies-protocol.test.mjs','scripts/trial/piggies-size2.test.mjs'],python:['test_piggies_fields.py','test_piggies_size2.py']},
 32714:{node:['scripts/trial/huff-protocol.test.mjs','scripts/trial/huff-touchup.test.mjs','scripts/trial/huff-retrigger-review.test.mjs','scripts/trial/free-game-counters.test.mjs','scripts/trial/feature-state.test.mjs'],python:['test_huff_fields.py','test_huff_touchup_review.py','test_huff_retrigger.py','test_free_game_counters.py','test_feature_state.py']},
 32718:{node:['scripts/trial/morepuff-protocol.test.mjs','scripts/trial/morepuff-megahat-review.test.mjs'],python:['test_morepuff_fields.py','test_morepuff_megahat_review.py']},
 32719:{node:['scripts/trial/inca-protocol.test.mjs','scripts/trial/inca-free-review.test.mjs','scripts/trial/inca-coin-review.test.mjs'],python:['test_inca_hold_action_review.py','test_inca_free_review.py','test_inca_coin_review.py']},
 32720:{node:['scripts/trial/jinzita-protocol.test.mjs'],python:['test_jinzita_fields.py']},
 32812:{node:['scripts/trial/veryfruity-session.test.mjs','scripts/trial/veryfruity-worker.test.mjs','scripts/runner-v2/veryfruity-next-profile.test.mjs'],python:['test_veryfruity_action_fields.py']},
 32739:{node:['scripts/trial/demon-protocol.test.mjs','scripts/trial/demon-nested-protocol.test.mjs'],python:['test_demon_fields.py','test_demon_nested_fields.py']},
 32820:{node:['scripts/trial/beaver-protocol.test.mjs'],python:['test_beaver_fields.py']},
 32835:{node:['scripts/trial/luxor-protocol.test.mjs'],python:['test_luxor_fields.py']}
});

export function preparationInputHash({gameId,reference,fileHashes,evidenceHashes}){
 assert(Number.isSafeInteger(gameId),'PREPARATION_INPUT_GAME');
 return hash({gameId,handler:preparationHandlers[gameId]??null,reference,fileHashes,evidenceHashes});
}
export function reviewedPreparation({gameId,revisionHash,receipts,failureEvidenceHash}){
 const gates={},missing=[];
 for(const gate of preparationGates){
  const matching=receipts.filter(r=>r?.schema==='sg-preparation-gate-v1'&&r.gameId===gameId
   &&r.revisionHash===revisionHash&&r.gate===gate&&r.verified===true&&r.sourceAllowance===0
   &&Array.isArray(r.supportingHashes)&&r.supportingHashes.length>0
   &&r.supportingHashes.every(h=>/^[a-f0-9]{64}$/.test(h))
   &&(!failureEvidenceHash||!['route','settlement','persistence'].includes(gate)||r.failureEvidenceHash===failureEvidenceHash));
  // Ambiguous evidence is a review item, never newest-file-wins permission.
  if(matching.length!==1)missing.push(gate);
  else gates[gate]={verified:true,evidenceHash:hash(matching[0])};
 }
 if(missing.length)return {status:'blocked',reason:'PREPARATION_GATES_PENDING',missingGates:missing};
 return {status:'prepared',proof:{schema:'sg-reusable-preparation-v1',gameId,revisionHash,sourceAllowance:0,gates}};
}
