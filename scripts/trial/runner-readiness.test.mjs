import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectReadiness, READY_STEP} from './runner-readiness.mjs';

const ready = shard => ({name: `capture-${shard}`, status: 'in_progress', runner_name: `runner-${shard}`,
  steps: [{name: READY_STEP, status: 'in_progress'}]});

test('four queued jobs cannot pass the twenty-runner gate', () => {
  const jobs = Array.from({length: 20}, (_, i) => i < 16 ? ready(i) : {name: `capture-${i}`, status: 'queued', runner_name: ''});
  assert.equal(inspectReadiness(jobs, 20).ready.length, 16);
  assert.equal(inspectReadiness(jobs, 20).allReady, false);
});

test('all twenty independent runners at the gate can proceed', () => {
  const jobs = Array.from({length: 20}, (_, i) => ready(i));
  assert.equal(inspectReadiness(jobs, 20).allReady, true);
  jobs[0].steps[0] = {name: READY_STEP, status: 'completed', conclusion: 'success'};
  assert.equal(inspectReadiness(jobs, 20).allReady, true);
});

test('assigned runners still installing dependencies are not ready', () => {
  const jobs = Array.from({length: 20}, (_, i) => ready(i));
  jobs[19].steps[0].status = 'queued';
  assert.equal(inspectReadiness(jobs, 20).allReady, false);
});

test('failed or duplicate workers cannot satisfy readiness', () => {
  const jobs = Array.from({length: 20}, (_, i) => ready(i));
  jobs[7].status = 'completed'; jobs[7].conclusion = 'failure';
  assert.equal(inspectReadiness(jobs, 20).allReady, false);
  assert.deepEqual(inspectReadiness(jobs, 20).failed, [7]);
  assert.throws(() => inspectReadiness([...jobs, ready(0)], 20), /Duplicate/);
});

test('verification jobs do not fill missing capture slots', () => {
  const jobs = [...Array.from({length: 19}, (_, i) => ready(i)), {...ready(19), name: 'verify'}];
  assert.equal(inspectReadiness(jobs, 20).allReady, false);
  assert.equal(inspectReadiness([ready(0), ready(1)], 2).allReady, true);
});
