import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {preparationHandlers} from './preparation-handlers.mjs';
import {preparationRevision} from './preparation-revision.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishImmutableInbox} from './work-line-mailbox.mjs';

export function linuxPreparationTasks({root, index, result, origin}) {
  assert(result?.schema === 'sg-offline-preflight-v1' && result.passed === true && result.complete === true
    && result.sourceRequests === 0 && result.mongoWrites === 0 && result.runs?.length > 0,
    'PREPARATION_LINUX_INCOMPLETE');
  const expected = {'python': 8, 'collector-protocol': 3, 'runner-persistence': 2};
  for (const run of result.runs) {
    assert(run.passed === true && run.groups?.length === 3, 'PREPARATION_LINUX_INCOMPLETE');
    assert(new Set(run.groups.map(g => g.group)).size === 3
      && run.groups.every(g => ['python', 'collector-protocol', 'runner-persistence'].includes(g.group)
        && g.passed === true && g.commands?.length === g.expectedCommands && g.expectedCommands === expected[g.group]
        && g.commands.every(c => c.exitCode === 0 && /^[a-f0-9]{64}$/.test(c.argvHash))),
      'PREPARATION_LINUX_INCOMPLETE');
  }
  assert(origin.workflow === '.github/workflows/preflight.yml', 'PREPARATION_LINUX_ORIGIN');
  return Object.keys(preparationHandlers).map(Number).map(gameId => {
    const {revisionHash, fileHashes} = preparationRevision(root, gameId, index.games.find(g => g.gameId === gameId));
    assert(!Object.values(fileHashes).includes('missing'), 'PREPARATION_LINUX_FILES');
    return {schema: 'sg-preparation-linux-task-v1', gameId, sourceAllowance: 0,
      receipt: {schema: 'sg-preparation-gate-v1', gate: 'linux', gameId, revisionHash,
        verified: true, sourceAllowance: 0, supportingHashes: [hash(result)], origin}};
  });
}

export function validateLinuxPreparationTask(root, task, origin) {
  const r = task.receipt;
  assert(origin.workflow === '.github/workflows/preflight.yml' && task.schema === 'sg-preparation-linux-task-v1'
    && task.sourceAllowance === 0 && preparationHandlers[task.gameId] && r?.schema === 'sg-preparation-gate-v1'
    && r.gameId === task.gameId && r.gate === 'linux' && r.verified === true && r.sourceAllowance === 0
    && hash(r.origin) === hash(origin) && r.supportingHashes?.length === 1
    && /^[a-f0-9]{64}$/.test(r.supportingHashes[0]), 'PREPARATION_LINUX_SCOPE');
  const index = JSON.parse(fs.readFileSync(path.join(root, '.local/preparation-worker/admission/feature-index.json'), 'utf8'));
  assert(preparationRevision(root, task.gameId, index.games.find(g => g.gameId === task.gameId)).revisionHash === r.revisionHash,
    'PREPARATION_LINUX_REVISION_CHANGED');
}

export function deliverLinuxPreparationTask(root, task, origin) {
  validateLinuxPreparationTask(root, task, origin);
  const dir = path.join(root, '.local/preparation-worker/evidence', String(task.gameId));
  // Repeated successful Linux checks do not introduce conflicting duplicate
  // gates for identical code. Retain the first immutable verified receipt.
  if (fs.existsSync(dir)) for (const name of fs.readdirSync(dir).filter(n => /^[a-f0-9]{64}\.json$/.test(n))) {
    const old = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    if (hash(old) + '.json' === name && old.gate === 'linux' && old.revisionHash === task.receipt.revisionHash) {
      validateLinuxPreparationTask(root, {...task, receipt: old}, old.origin);
      return {status: 'linux-gate-reused', mailbox: name.slice(0, -5), sourceRequests: 0};
    }
  }
  return {status: 'linux-gate-delivered', mailbox: publishImmutableInbox(dir, task.receipt), sourceRequests: 0};
}
