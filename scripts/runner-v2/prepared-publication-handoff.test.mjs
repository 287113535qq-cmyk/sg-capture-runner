import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPreparedPublication} from './prepared-publication.mjs';
import {reviewPreparedPublicationHandoff} from './prepared-publication-handoff.mjs';
import {preparationGates} from './preparation-inventory.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

test('continuous prepared stock reaches the capture consumer without an expiring profile, semantics or new quota', async () => {
  const plan = {gameId: 1, trialId: 'fixture',buy:0,phase:1}, receipts = {}, gates = {}, revisionHash = 'a'.repeat(64);
  for (const gate of preparationGates) {
    const r = {schema: 'sg-preparation-gate-v1', gameId: 1, gate, revisionHash, verified: true,
      sourceAllowance: 0, supportingHashes: ['b'.repeat(64)],failureEvidenceHash:'c'.repeat(64)};
    receipts[hash(r)] = r; gates[gate] = {verified: true, evidenceHash: hash(r)};
  }
  const proof = {schema: 'sg-reusable-preparation-v1', gameId: 1, revisionHash, gates, sourceAllowance: 0};
  const inventory = {schema: 'sg-preparation-inventory-v1', revision: 1, sourceAllowance: 0,
    tasks: [{gameId: 1, status: 'prepared', claim: null, proof, proofHash: hash(proof),failureEvidenceHash:'c'.repeat(64)}]};
  const compiled = await buildPreparedPublication({inventory, resolvePlan: async () => ({plan, group: 'secondary'}),
    readEvidence: async (_g, h) => receipts[h]});
  const cycle = {schema: 'sg-preparation-publication-cycle-v1', publication: compiled.publication,
    evidence: compiled.evidence, sourceAllowance: 0, rejected: [], sourceRequests: 0, newBetAllowance: 0};
  const task = {schema: 'sg-capture-prepared-publication-v1', cycle, cycleHash: hash(cycle), sourceAllowance: 0};
  const options = {task, currentCycleHash: task.cycleHash, inventory, plans: {1: plan},
    registry: {sourceAllowance: 0, bindings: {1: {group: 'secondary', planHash: hash(plan)}}}};
  const result = await reviewPreparedPublicationHandoff(options);
  assert.equal(result.inputs.role, 'capture'); assert.equal(result.dispatched, false); assert.equal(result.sourceAllowance, 0);
  assert.equal(result.status, 'online-publication-and-fresh-admission-required');
  await assert.rejects(reviewPreparedPublicationHandoff({...options, currentCycleHash: 'd'.repeat(64)}), /PREPARED_HANDOFF_CYCLE_CHANGED/);
  const revoked = structuredClone(inventory); revoked.tasks[0].status = 'blocked';
  await assert.rejects(reviewPreparedPublicationHandoff({...options, inventory: revoked}), /PREPARED_HANDOFF_REVOKED/);
  await assert.rejects(reviewPreparedPublicationHandoff({...options, plans: {1: {...plan, gameId: 2}}}), /PREPARED_HANDOFF_EVIDENCE/);
  const wrong = structuredClone(options); wrong.registry.bindings[1].group = 'primary';
  await assert.rejects(reviewPreparedPublicationHandoff(wrong), /PREPARED_HANDOFF_REVOKED/);
  const activation='d'.repeat(64),name=`formal-prepared-count-1-${activation}.json`;
  const profile={schema:'sg-prepared-count-profile-v1',gameId:1,trialId:'fixture',group:'secondary',basePlanHash:hash(plan),activation,
   targetComplete:300000,completePreserved:0,remainingComplete:300000,maxSequence:600000,sessionRotation:'closed-batches-v1',
   newBetAllowance:0,requiresNewSession:true,createdAt:1,expiresAt:7200001,
   preparationProofHash:hash(proof),failureEvidenceHash:'c'.repeat(64),sceneHash:'e'.repeat(64),recordsHash:'e'.repeat(64),closureHash:'e'.repeat(64),
   planHash:hash({...plan,target:300000,countAllocation:activation})};
  const countRegistry={schema:'sg-prepared-count-authorizations-v1',sourceAllowance:0,profiles:{[name]:{
   schema:'sg-prepared-count-authorization-v1',gameId:1,trialId:'fixture',group:'secondary',basePlanHash:hash(plan),activation,profileHash:hash(profile)}}};
  const counted=await reviewPreparedPublicationHandoff({...options,countRegistry,readProfile:async()=>profile});
  assert.equal(counted.inputs.role,'formal-count');assert.equal(counted.inputs.formal_profile,name);
  assert.equal(counted.inputs.round_one_limit,'0');assert.equal(counted.sourceAllowance,0);
  const changed=structuredClone(profile);changed.preparationProofHash='f'.repeat(64);
  await assert.rejects(reviewPreparedPublicationHandoff({...options,countRegistry,readProfile:async()=>changed}));
});
