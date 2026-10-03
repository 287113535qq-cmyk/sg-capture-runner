import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildPreparedPublication} from './prepared-publication.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishImmutableInbox} from './work-line-mailbox.mjs';
import {replaceLocalJson} from './atomic-local-state.mjs';

// Isolate one bad game instead of withholding every independently valid game.
// No profiles, groups or missing gates are inferred from an incoming event.
export async function compilePreparedCycle({inventory, resolvePlan, readEvidence}) {
  assert(inventory?.schema === 'sg-preparation-inventory-v1' && inventory.sourceAllowance === 0,
    'PREPARATION_PUBLICATION_SCOPE');
  const tasks = [], bindings = {}, evidence = {}, rejected = [];
  for (const task of inventory.tasks.filter(t => t.status === 'prepared')) {
    try {
      const result = await buildPreparedPublication({
        inventory: {...inventory, tasks: [task]}, resolvePlan, readEvidence,
      });
      tasks.push(...result.publication.inventory.tasks);
      Object.assign(bindings, result.publication.bindings);
      Object.assign(evidence, result.evidence);
    } catch (error) {
      rejected.push({gameId: task.gameId, proofHash: task.proofHash,
        reason: /^[A-Z_]+$/.test(error.message) ? error.message : 'PREPARATION_PUBLICATION_REQUIRES_REVIEW'});
    }
  }
  return {schema: 'sg-preparation-publication-cycle-v1', sourceAllowance: 0,
    publication: {schema: 'sg-prepared-publication-v1', sourceAllowance: 0,
      inventory: {schema: inventory.schema, sourceAllowance: 0, revision: inventory.revision, tasks}, bindings},
    evidence, rejected, sourceRequests: 0, newBetAllowance: 0};
}

// A durable local publication candidate, not a GitHub deployment. A reviewed
// foreground publication still supplies the exact files to the online reader.
export async function stagePreparedCycle(root, inventory) {
  const load = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const plans = load('config/round-one-plans.json');
  const registry = load('config/preparation-plan-bindings.json');
  assert(registry.schema === 'sg-preparation-plan-bindings-v1' && registry.sourceAllowance === 0,
    'PREPARATION_PLAN_REGISTRY_SCOPE');
  const result = await compilePreparedCycle({inventory,
    resolvePlan: async gameId => {
      const binding = registry.bindings[String(gameId)], plan = plans[gameId];
      assert(binding && plan && binding.planHash === hash(plan), 'PREPARATION_FIXED_PLAN_REQUIRED');
      return {plan, group: binding.group};
    },
    readEvidence: async (gameId, digest) => load(`.local/preparation-worker/evidence/${gameId}/${digest}.json`),
  });
  const dir = path.join(root, '.local/preparation-worker/publication');
  const id = publishImmutableInbox(path.join(dir, 'cycles'), result);
  const pointer = {schema: 'sg-preparation-publication-pointer-v1', cycleHash: id,
    prepared: result.publication.inventory.tasks.map(t => t.gameId), rejected: result.rejected,
    sourceAllowance: 0, sourceRequests: 0};
  const dest = path.join(dir, 'current.json');
  if (fs.existsSync(dest) && hash(JSON.parse(fs.readFileSync(dest, 'utf8'))) === hash(pointer)) {
    if (pointer.prepared.length) publishImmutableInbox(path.join(root, '.local/capture-handoff-worker/inbox'),
      {schema: 'sg-capture-prepared-publication-v1', cycleHash: id, cycle: result, sourceAllowance: 0});
    return {...pointer, changed: false};
  }
  replaceLocalJson(dest, pointer);
  if (pointer.prepared.length) publishImmutableInbox(path.join(root, '.local/capture-handoff-worker/inbox'),
    {schema: 'sg-capture-prepared-publication-v1', cycleHash: id, cycle: result, sourceAllowance: 0});
  return {...pointer, changed: true};
}
