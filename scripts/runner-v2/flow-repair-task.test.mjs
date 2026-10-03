import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishCaptureFailure} from './work-line-mailbox.mjs';
import {reviewFlowRepairTask} from './flow-repair-task.mjs';

const evidence = {plan: {gameId: 1, sourceKey: 'fixture', maxSteps: 100},
  raw: {sourceKey: 'fixture', steps: [{responseXml: 'original', msgId: 'BET'}]}};
const task = {schema: 'sg-flow-repair-task-v1', gameId: 1, evidenceHash: hash(evidence), evidence, sourceAllowance: 0};
test('durable fault sends unchanged original evidence to flow repair as well as independent protocol analysis', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-flow-repair-'));
  try {
    const ids = publishCaptureFailure(root, {gameId: 1, proofHash: 'a'.repeat(64), reason: 'FLOW_GAP', evidence});
    const original = JSON.parse(fs.readFileSync(path.join(root, '.local/preparation-worker/repair/evidence-inbox', ids.flow + '.json')));
    assert.deepEqual(original, task);
    assert.equal(publishCaptureFailure(root, {gameId: 1, proofHash: 'a'.repeat(64), reason: 'FLOW_GAP', evidence}).flow, ids.flow);
    assert.equal(fs.readdirSync(path.join(root, '.local/protocol-analysis-worker/inbox')).length, 1);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});
test('two independent route checks do not mint terminal, readback, ready or replay permission', async () => {
  const calls = [];
  const parser = {call: async r => {calls.push(r.op); return r.op === 'plan' ? {validated: true} : {MSGID: 'FREE_GAME'};}};
  const out = await reviewFlowRepairTask({task, parser, runnerNext: () => ({MSGID: 'FREE_GAME'})});
  assert.deepEqual(calls, ['plan', 'next']); assert.equal(out.routeAgreement, true);
  for (const key of ['prepared', 'settlementVerified', 'persistenceVerified', 'replayAllowed']) assert.equal(out[key], false);
  assert.equal(out.sourceRequests, 0);
  await assert.rejects(reviewFlowRepairTask({task, parser, runnerNext: () => null}), /INDEPENDENT_ROUTE_MISMATCH/);
  await assert.rejects(reviewFlowRepairTask({task: {...task, evidenceHash: 'b'.repeat(64)}, parser, runnerNext: () => null}), /EVIDENCE_CHANGED/);
  const terminal = await reviewFlowRepairTask({task, parser: {call: async r => r.op === 'plan' ? {validated: true} : null}, runnerNext: () => null});
  assert.equal(terminal.status, 'terminal-requires-full-readback'); assert.equal(terminal.prepared, false);
});
