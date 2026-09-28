import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {repositories} from './runner-group.mjs';

export const READY_STEP = 'Wait for every capture runner';

export function independentShard(env) {
  if (env.CAPTURE_STARTUP_MODE !== 'available-workers') return null;
  assert.equal(env.SG_CAPTURE_ALLOCATION, 'round-one', 'INDEPENDENT_ROUND_ONE_ONLY');
  assert(Object.hasOwn(repositories, env.GITHUB_REPOSITORY), 'RUNNER_REPOSITORY_NOT_ALLOWED');
  assert(/^(?:[0-9]|1[0-9])$/.test(env.SG_TRIAL_SHARD ?? ''), 'BAD_LOCAL_SHARD');
  return Number(env.SG_TRIAL_SHARD);
}

export function readinessTimeoutMs(value) {
  // The longer window is used only by an explicit source-free diagnostic.
  assert(value === undefined || value === '180' || value === '600', 'BAD_READINESS_TIMEOUT');
  return Number(value ?? '180') * 1000;
}

export function inspectReadiness(jobs, expected) {
  assert([2, 4, 20].includes(expected));
  const selected = jobs.filter(job => /^capture-\d+$/.test(job.name));
  const byShard = new Map(selected.map(job => [Number(job.name.slice(8)), job]));
  assert.equal(byShard.size, selected.length, 'Duplicate capture runner');
  const ready = [], failed = [];
  for (let shard = 0; shard < expected; shard++) {
    const job = byShard.get(shard);
    if (!job) continue;
    const step = job.steps?.find(item => item.name === READY_STEP);
    if (job.status === 'completed' && job.conclusion !== 'success') failed.push(shard);
    if (job.runner_name && (step?.status === 'in_progress' || step?.conclusion === 'success')) {
      ready.push(shard);
    }
  }
  return {expected, ready, failed, allReady: ready.length === expected && failed.length === 0};
}

async function main() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  assert.equal(process.env.RUNNER_OS, 'Linux');
  const expected = Number(process.env.CAPTURE_RUNNERS);
  assert([2, 4, 20].includes(expected));
  const repository = process.env.GITHUB_REPOSITORY;
  assert(Object.hasOwn(repositories, repository), 'RUNNER_REPOSITORY_NOT_ALLOWED');
  assert([undefined,'','available-workers'].includes(process.env.CAPTURE_STARTUP_MODE), 'BAD_STARTUP_MODE');
  const shard = independentShard(process.env);
  if (shard !== null) {
    console.log(JSON.stringify({startup:'available-workers',shard,requestedWorkers:expected,
      allTwentyReadyVerified:false,sourceRequests:0}));
    return;
  }
  const run = process.env.GITHUB_RUN_ID, attempt = process.env.GITHUB_RUN_ATTEMPT;
  assert(/^\d+$/.test(run) && /^\d+$/.test(attempt));
  const token = process.env.GH_TOKEN;
  assert(token);
  const timeout = readinessTimeoutMs(process.env.CAPTURE_READINESS_TIMEOUT_SECONDS);
  const deadline = Date.now() + timeout;
  let last = '';
  while (Date.now() < deadline) {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${run}/attempts/${attempt}/jobs?per_page=100`, {
      headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json'},
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    assert(response.ok, `RUNNER_READINESS_HTTP_${response.status}`);
    const body = await response.json();
    assert(body.total_count <= 100 && Array.isArray(body.jobs), 'Unexpected job list');
    const state = inspectReadiness(body.jobs, expected);
    const message = JSON.stringify({...state, sourceRequests: 0});
    if (message !== last) { console.log(message); last = message; }
    assert.equal(state.failed.length, 0, 'A capture runner failed before collective startup');
    if (state.allReady) {
      console.log(`All ${expected} capture runners reached the startup gate.`);
      return;
    }
    // Twenty diagnostic jobs share the repository's GITHUB_TOKEN rate budget.
    await new Promise(resolve => setTimeout(resolve, timeout === 600000 ? 30000 : 10000));
  }
  throw Error('RUNNER_CAPACITY_NOT_READY: no SG requests were made by this runner');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
