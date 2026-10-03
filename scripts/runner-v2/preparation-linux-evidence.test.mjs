import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {linuxPreparationTasks} from './preparation-linux-evidence.mjs';
import {evidenceOrigin, receiveSealedEvidence} from './work-line-evidence-delivery.mjs';
import {sealWorkLineEvidence, recipientFingerprint} from './work-line-sealed-evidence.mjs';
import {preparationHandlers} from './preparation-handlers.mjs';

test('only the complete fixed Linux check set emits Linux gates; a live or failed run never admits evidence', () => {
  const origin = {workflow: '.github/workflows/preflight.yml'};
  const result = {schema: 'sg-offline-preflight-v1', passed: true, complete: true, sourceRequests: 0, mongoWrites: 0,
    runs: [{passed: true, groups: Object.entries({'python': 8, 'collector-protocol': 3, 'runner-persistence': 2})
      .map(([group, expectedCommands]) => ({group, expectedCommands, passed: true,
        commands: Array.from({length: expectedCommands}, () => ({exitCode: 0, argvHash: 'a'.repeat(64)}))}))}]};
  const index = {games: []};
  const tasks = linuxPreparationTasks({root: process.cwd(), index, result, origin});
  assert.equal(tasks.length, Object.keys(preparationHandlers).length);
  assert(tasks.every(t => t.receipt.gate === 'linux' && t.sourceAllowance === 0));
  for (const change of [{passed: false}, {complete: false}, {sourceRequests: 1}, {mongoWrites: 1}])
    assert.throws(() => linuxPreparationTasks({root: process.cwd(), index, result: {...result, ...change}, origin}), /PREPARATION_LINUX_INCOMPLETE/);
  const short = structuredClone(result); short.runs[0].groups[0].commands.pop(); short.runs[0].groups[0].expectedCommands--;
  assert.throws(() => linuxPreparationTasks({root: process.cwd(), index, result: short, origin}), /PREPARATION_LINUX_INCOMPLETE/);
  const repository = 'zyzuoyang/sg-capture-runner', run = {id: 1, run_attempt: 1, head_sha: 'a'.repeat(40), head_branch: 'main',
    event: 'workflow_dispatch', path: origin.workflow, repository: {full_name: repository}, head_repository: {full_name: repository}};
  assert.throws(() => evidenceOrigin({...run, status: 'in_progress'}, repository), /EVIDENCE_RUN_SCOPE/);
  assert.throws(() => evidenceOrigin({...run, status: 'completed', conclusion: 'failure'}, repository), /EVIDENCE_RUN_SCOPE/);
  assert.equal(evidenceOrigin({...run, status: 'completed', conclusion: 'success'}, repository).workflow, origin.workflow);
});

test('encrypted Linux evidence reaches the preparation gate store; repeated runs reuse the original gate and do not mint other gates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-linux-gate-'));
  const key = generateKeyPairSync('rsa', {modulusLength: 2048, publicKeyEncoding: {type: 'spki', format: 'pem'}, privateKeyEncoding: {type: 'pkcs8', format: 'pem'}});
  const recipient = {schema: 'sg-work-line-recipient-v1', publicKey: key.publicKey, fingerprint: recipientFingerprint(key.publicKey)};
  try {
    // Copy only source identity inputs into an isolated root, never game data.
    const source = process.cwd();
    for (const [id, h] of Object.entries(preparationHandlers)) for (const file of [...h.node, ...h.python.map(n => 'service/tests/' + n)]) {
      const dest = path.join(root, file); fs.mkdirSync(path.dirname(dest), {recursive: true}); fs.copyFileSync(path.join(source, file), dest);
    }
    fs.mkdirSync(path.join(root, '.local/preparation-worker/admission'), {recursive: true});
    const index = {games: []}; fs.writeFileSync(path.join(root, '.local/preparation-worker/admission/feature-index.json'), JSON.stringify(index));
    const origin = {workflow: '.github/workflows/preflight.yml', repository: 'zyzuoyang/sg-capture-runner', runId: '1', attempt: '1', commit: 'a'.repeat(40)};
    const result = {schema: 'sg-offline-preflight-v1', passed: true, complete: true, sourceRequests: 0, mongoWrites: 0,
      runs: [{passed: true, groups: Object.entries({'python': 8, 'collector-protocol': 3, 'runner-persistence': 2})
        .map(([group, expectedCommands]) => ({group, expectedCommands, passed: true,
          commands: Array.from({length: expectedCommands}, () => ({exitCode: 0, argvHash: 'a'.repeat(64)}))}))}]};
    const tasks = linuxPreparationTasks({root, index, result, origin});
    const deliver = (tasks, origin) => receiveSealedEvidence({root, origin, privateKey: key.privateKey,
      sealed: sealWorkLineEvidence({schema: 'sg-work-line-delivery-v1', origin, tasks, sourceAllowance: 0}, recipient)});
    assert.equal(deliver(tasks, origin).tasks, 9);
    const next = {...origin, runId: '2'}, repeated = tasks.map(t => ({...t, receipt: {...t.receipt, origin: next}}));
    assert.deepEqual(deliver(repeated, next).mailboxes, deliver(tasks, origin).mailboxes);
    for (const id of Object.keys(preparationHandlers)) {
      const files = fs.readdirSync(path.join(root, '.local/preparation-worker/evidence', id)); assert.equal(files.length, 1);
      assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.local/preparation-worker/evidence', id, files[0]))).gate, 'linux');
    }
    const changed = structuredClone(tasks); changed[0].receipt.revisionHash = 'd'.repeat(64);
    assert.throws(() => deliver(changed, origin), /PREPARATION_LINUX_REVISION_CHANGED/);
    assert(!fs.existsSync(path.join(root, '.local/capture-handoff-worker')));
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});
