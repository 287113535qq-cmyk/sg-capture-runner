import assert from 'node:assert/strict';
import path from 'node:path';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishImmutableInbox} from './work-line-mailbox.mjs';

// Original evidence travels independently to flow repair and gameplay analysis.
// An action review is not a terminal receipt, preparation gate or replay permit.
export function deliverFlowRepair(root, {gameId, rawHash, evidence}) {
  assert(Number.isSafeInteger(gameId) && hash(evidence) === rawHash, 'FLOW_REPAIR_EVIDENCE_CHANGED');
  const task = {schema: 'sg-flow-repair-task-v1', gameId, evidenceHash: rawHash, evidence, sourceAllowance: 0};
  return publishImmutableInbox(path.join(root, '.local/preparation-worker/repair/evidence-inbox'), task);
}

export async function reviewFlowRepairTask({task, parser, runnerNext}) {
  assert(task?.schema === 'sg-flow-repair-task-v1' && task.sourceAllowance === 0
    && hash(task.evidence) === task.evidenceHash, 'FLOW_REPAIR_EVIDENCE_CHANGED');
  const {plan, raw} = task.evidence;
  assert(plan?.gameId === task.gameId && raw && raw.sourceKey === plan.sourceKey
    && Array.isArray(raw.steps) && raw.steps.length > 0 && raw.steps.length <= plan.maxSteps
    && typeof runnerNext === 'function', 'FLOW_REPAIR_ORIGINAL_SCOPE');
  assert.deepEqual(await parser.call({op: 'plan', plan}), {validated: true});
  const next = await parser.call({op: 'next', plan, raw});
  assert.deepEqual(runnerNext(raw, plan), next, 'FLOW_REPAIR_INDEPENDENT_ROUTE_MISMATCH');
  // The original session was abandoned. Even a valid next action cannot be sent.
  return {schema: 'sg-flow-repair-review-v1', gameId: task.gameId, evidenceHash: task.evidenceHash,
    planHash: hash(plan), rawHash: hash(raw), status: next === null ? 'terminal-requires-full-readback'
      : 'route-reviewed-requires-settlement-evidence', nextAction: next, routeAgreement: true,
    settlementVerified: false, persistenceVerified: false, prepared: false,
    requiresNewSession: true, sourceAllowance: 0, sourceRequests: 0, replayAllowed: false};
}
