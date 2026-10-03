import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compilePreparedCycle, stagePreparedCycle} from './preparation-publication-cycle.mjs';
import {preparationGates, newInventory, claimPreparation, finishPreparation} from './preparation-inventory.mjs';
import {applyWorkLineEvent} from './work-line-events.mjs';
import {publishedPreparedSelector} from './prepared-campaign-selector.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

function reviewed(gameId, revisionHash) {
  const receipts = {}, gates = {};
  for (const gate of preparationGates) {
    const receipt = {schema: 'sg-preparation-gate-v1', gameId, revisionHash, gate,
      verified: true, sourceAllowance: 0, supportingHashes: ['b'.repeat(64)]};
    receipts[hash(receipt)] = receipt; gates[gate] = {verified: true, evidenceHash: hash(receipt)};
  }
  return {receipts, proof: {schema: 'sg-reusable-preparation-v1', gameId, revisionHash, sourceAllowance: 0, gates}};
}
function prepared(gameId, proof) {
  const q = newInventory([{gameId, name: 'fixture'}]);
  finishPreparation(q, claimPreparation(q, {owner: 'fixture', now: 0}), {status: 'prepared', proof}, 1);
  return q;
}

test('flow repair returns to admission and publication; a second bad item cannot withhold the repaired game', async () => {
  const first = reviewed(1, 'a'.repeat(64)), repaired = reviewed(1, 'c'.repeat(64));
  const inventory = prepared(1, first.proof), failedProofHash = hash(first.proof), failure = 'd'.repeat(64);
  applyWorkLineEvent(inventory, {schema: 'sg-work-line-event-v1', kind: 'capture-failed', gameId: 1,
    sourceAllowance: 0, evidenceHash: failure, proofHash: failedProofHash, reason: 'FLOW_GAP'}, 'admission', 2);
  applyWorkLineEvent(inventory, {schema: 'sg-work-line-event-v1', kind: 'repair-verified', gameId: 1,
    sourceAllowance: 0, evidenceHash: hash(repaired.proof), failureEvidenceHash: failure,
    rejectedProofHash: failedProofHash, proof: repaired.proof}, 'admission', 3);
  inventory.tasks.push({...inventory.tasks[0], gameId: 2}); // Wrong proof/game must be isolated.
  const plan = {gameId: 1, trialId: 'fixture'};
  const result = await compilePreparedCycle({inventory,
    resolvePlan: async () => ({plan, group: 'primary'}), readEvidence: async (_g, h) => repaired.receipts[h]});
  assert.deepEqual(result.publication.inventory.tasks.map(t => t.gameId), [1]);
  assert.equal(result.rejected[0].gameId, 2);
  const select = publishedPreparedSelector({publication: result.publication, plans: {1: plan},
    readEvidence: async ref => result.evidence[ref]});
  assert.equal(await select({readyGameIds: [1], group: 'primary'}), 1);
  assert.equal(await select({readyGameIds: [], group: 'primary'}), null);
  assert.equal(result.sourceRequests, 0); assert.equal(result.newBetAllowance, 0);
});

test('durable candidate is idempotent, revokes removed entries and never edits public inventory or assigns an owner', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-publication-cycle-'));
  const data = reviewed(1, 'a'.repeat(64)), plan = {gameId: 1, trialId: 'fixture'};
  const put = (name, value) => {const f = path.join(root, name); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, JSON.stringify(value));};
  try {
    put('config/round-one-plans.json', {1: plan});
    put('config/preparation-plan-bindings.json', {schema: 'sg-preparation-plan-bindings-v1', sourceAllowance: 0,
      bindings: {1: {planHash: hash(plan), group: 'secondary'}}});
    for (const [h, receipt] of Object.entries(data.receipts)) put(`.local/preparation-worker/evidence/1/${h}.json`, receipt);
    const q = prepared(1, data.proof);
    assert.equal((await stagePreparedCycle(root, q)).changed, true);
    assert.equal((await stagePreparedCycle(root, q)).changed, false);
    assert(!fs.existsSync(path.join(root, 'config/prepared-inventory.json')));
    put('config/preparation-plan-bindings.json', {schema: 'sg-preparation-plan-bindings-v1', sourceAllowance: 0, bindings: {}});
    const missing = await stagePreparedCycle(root, q);
    assert.deepEqual(missing.prepared, []); assert.equal(missing.rejected[0].reason, 'PREPARATION_FIXED_PLAN_REQUIRED');
    q.tasks[0].status = 'blocked'; q.revision++;
    const removed = await stagePreparedCycle(root, q);
    assert.deepEqual(removed.prepared, []); assert.deepEqual(removed.rejected, []);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});
