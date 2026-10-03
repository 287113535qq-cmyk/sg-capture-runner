import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishedPreparedSelector} from './prepared-campaign-selector.mjs';

// Reusable stock handoff is independent of expiring demo profiles. The online
// campaign still intersects its own ready set and acquires fresh permission.
export async function reviewPreparedPublicationHandoff({task, currentCycleHash, inventory, plans, registry}) {
  const cycle = task?.cycle;
  assert(task?.schema === 'sg-capture-prepared-publication-v1' && task.sourceAllowance === 0
    && cycle?.schema === 'sg-preparation-publication-cycle-v1' && cycle.sourceAllowance === 0
    && hash(cycle) === task.cycleHash && task.cycleHash === currentCycleHash
    && inventory?.sourceAllowance === 0 && registry?.sourceAllowance === 0,
    'PREPARED_HANDOFF_CYCLE_CHANGED');
  const candidate = cycle.publication.inventory.tasks, games = [];
  for (const row of candidate) {
    const current = inventory.tasks.find(t => t.gameId === row.gameId);
    const binding = registry.bindings[String(row.gameId)], published = cycle.publication.bindings[String(row.gameId)];
    assert(current?.status === 'prepared' && !current.claim && current.proofHash === row.proofHash
      && hash(current.proof) === row.proofHash && binding?.group === published?.group
      && binding?.planHash === published?.planHash, 'PREPARED_HANDOFF_REVOKED');
    const select = publishedPreparedSelector({publication: cycle.publication, plans,
      readEvidence: async ref => cycle.evidence[ref]});
    assert(await select({readyGameIds: [row.gameId], group: binding.group}) === row.gameId,
      'PREPARED_HANDOFF_EVIDENCE');
    games.push({gameId: row.gameId, group: binding.group, planHash: binding.planHash, proofHash: row.proofHash});
  }
  assert(games.length > 0, 'PREPARED_HANDOFF_EMPTY');
  return {schema: 'sg-capture-prepared-dispatch-task-v1', status: 'online-publication-and-fresh-admission-required',
    cycleHash: task.cycleHash, games, workflow: '.github/workflows/trial-300k.yml',
    inputs: {role: 'capture', allocation: 'round-one', round_one_limit: '0', active_shards: '20'},
    sourceAllowance: 0, sourceRequests: 0, dispatched: false};
}
