import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const schema = 'sg-link-fixture-v1';
const caseId = process.env.SG_LINK_CASE;
const role = process.argv[2];
const shard = Number(process.env.SG_LINK_SHARD || 0);
assert.match(caseId || '', /^fixture_[a-z0-9_]{1,64}$/);
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Link verification runs on GitHub Actions only');
assert.equal(process.env.RUNNER_OS, 'Linux');
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
assert(['seed', 'resume', 'worker', 'audit'].includes(role));
const owner = `${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:${role}-${shard}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const evidence = { schema, fixtureOnly: true, caseId, role, shard, officialRequests: 0, gamePoolsTouched: false };

async function rpc(op, data = {}, expectCrash = false) {
  const key = process.env.SG_SSH_KEY_FILE, hosts = process.env.SG_SSH_HOSTS_FILE;
  assert(key && hosts && process.env.SG_SSH_HOST);
  const args = ['-T', '-i', key, '-o', 'IdentityAgent=none', '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${hosts}`, '-o', 'ConnectTimeout=20',
    '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', `sgcapture@${process.env.SG_SSH_HOST}`];
  return await new Promise((resolve, reject) => {
    const child = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', exceeded = false;
    const timeout = setTimeout(() => child.kill('SIGTERM'), 240000);
    child.stdout.on('data', value => { output += value.toString(); if (output.length > 65536) { exceeded = true; child.kill('SIGTERM'); } });
    child.stderr.on('data', () => {}); // Never emit host/key/authentication diagnostics into public job logs.
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timeout); reject(Object.assign(new Error('SSH_START_FAILED'), { code: 'SSH_START_FAILED' })); });
    child.on('close', code => {
      clearTimeout(timeout);
      if (expectCrash && code === 91 && !output.trim()) return resolve({ injectedCrash: true });
      if (exceeded) return reject(Object.assign(new Error('RPC_OUTPUT_TOO_LARGE'), { code: 'RPC_OUTPUT_TOO_LARGE' }));
      let result;
      try { result = JSON.parse(output); } catch { return reject(Object.assign(new Error('SSH_RPC_FAILED'), { code: 'SSH_RPC_FAILED', exitCode: code })); }
      if (code !== 0 || !result.ok) return reject(Object.assign(new Error(result.error || 'RPC_FAILED'), { code: result.error || 'RPC_FAILED' }));
      if (expectCrash) return reject(Object.assign(new Error('EXPECTED_CRASH_NOT_OBSERVED'), { code: 'EXPECTED_CRASH_NOT_OBSERVED' }));
      resolve(result);
    });
    child.stdin.end(JSON.stringify({ schema, caseId, op, ...data }));
  });
}
function round(game, sequence) {
  return { sequence, sourceRoundId: `${game}:round:${sequence}`,
    raw: { fixtureOnly: true, source: 'isolated-link-test', sequence, result: { value: 7 } },
    normalized: { fixtureOnly: true, gameKey: game, sequence, value: 7 } };
}
function owned(game, lease) { return { gameId: game, owner, epoch: lease.epoch }; }
async function claim(game) {
  for (let attempts = 0; attempts < 42; attempts++) {
    try { return await rpc('claim', { gameId: game, owner, leaseSeconds: 300 }); }
    catch (error) { if (error.code !== 'GAME_BUSY' || attempts === 41) throw error; await sleep(15000); }
  }
}
async function commit(game, lease, sequence, extra = {}, expectedCrash = false) {
  await rpc('heartbeat', owned(game, lease));
  return await rpc('commit', { ...owned(game, lease), round: round(game, sequence), ...extra }, expectedCrash);
}
function output(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  const single = 'fixture-single';
  if (role === 'seed') {
    const games = [{ gameId: single, target: 3 }, ...Array.from({ length: 20 }, (_, i) => ({ gameId: `fixture-${String(i).padStart(2, '0')}`, target: 2 }))];
    await rpc('initialize', { games });
    const status = await rpc('status');
    if (status.tasks.every(task => task.status === 'complete')) {
      evidence.alreadyComplete = true; output('work_required', 'false'); return;
    }
    output('work_required', 'true');
    if (status.tasks.find(t => t.game === single).status === 'complete') { evidence.singleAlreadyComplete = true; return; }
    const lease = await claim(single);
    // A second owner is denied while the first is healthy.
    await assert.rejects(rpc('claim', { gameId: single, owner: owner + '-contender' }), e => e.code === 'GAME_BUSY');
    evidence.activeLeaseConflictRejected = true;
    const first = await commit(single, lease, 1);
    const duplicate = await commit(single, lease, 1);
    assert(duplicate.duplicate && duplicate.mongoInserted === 0);
    evidence.firstInsert = first.mongoInserted;
    evidence.duplicateAddedRows = duplicate.mongoInserted;
    const current = await rpc('status');
    if (current.tasks.find(t => t.game === single).checkpoint === 1 && !current.receipts.prepared) {
      const crash = await commit(single, lease, 2, { failpoint: 'after_mongo' }, true);
      assert(crash.injectedCrash);
      const interrupted = await rpc('status');
      assert.equal(interrupted.tasks.find(t => t.game === single).checkpoint, 1);
      assert.equal(interrupted.receipts.prepared, 1);
      evidence.realServerProcessCrashAfterMongo = true;
      evidence.checkpointDidNotAdvance = true;
    }
    await rpc('release', { ...owned(single, lease), status: 'pending', reason: 'fixture_stop' });
    evidence.stoppedBetweenConfirmedRounds = true;
    return;
  }
  if (role === 'resume') {
    const status = await rpc('status');
    if (status.tasks.find(t => t.game === single).status === 'complete') { evidence.alreadyComplete = true; return; }
    const lease = await claim(single);
    evidence.startCheckpoint = lease.checkpoint;
    const second = await commit(single, lease, 2);
    assert.equal(second.checkpoint, 2);
    evidence.recoveredJournalRows = second.recovered;
    evidence.duplicateMongoInsertions = second.mongoInserted;
    await commit(single, lease, 3);
    const duplicated = await commit(single, lease, 3);
    assert(duplicated.duplicate && duplicated.mongoInserted === 0);
    await rpc('release', { ...owned(single, lease), status: 'complete' });
    const verified = await rpc('verify');
    assert.equal(verified.count, 3);
    evidence.resumedOnAnotherRunner = true;
    evidence.parity = verified;
    return;
  }
  if (role === 'worker') {
    assert(Number.isInteger(shard) && shard >= 0 && shard < 20);
    const game = `fixture-${String(shard).padStart(2, '0')}`;
    let lease;
    try { lease = await claim(game); }
    catch (error) { if (error.code !== 'ALREADY_COMPLETE') throw error; evidence.alreadyComplete = true; evidence.gameId = game; return; }
    let inserted = 0;
    for (let sequence = 1; sequence <= 2; sequence++) inserted += (await commit(game, lease, sequence)).mongoInserted;
    await rpc('release', { ...owned(game, lease), status: 'complete' });
    evidence.gameId = game; evidence.activeGames = 1; evidence.mongoInserted = inserted; evidence.checkpoint = 2;
    return;
  }
  const status = await rpc('status');
  assert.equal(status.tasks.length, 21);
  assert(status.tasks.every(t => t.status === 'complete'));
  assert.equal(status.receipts.committed, 43);
  assert.equal(status.receipts.prepared || 0, 0);
  const matrix = status.tasks.filter(t => t.game !== single);
  assert.equal(new Set(matrix.map(t => t.game)).size, 20);
  assert.equal(new Set(matrix.map(t => t.last_owner)).size, 20);
  const verified = await rpc('verify');
  assert.equal(verified.count, 43);
  const first = await rpc('promote');
  const repeated = await rpc('promote');
  assert.equal(first.acceptedCount, 43);
  assert.equal(repeated.inserted, 0);
  assert.equal(repeated.duplicates, 43);
  await assert.rejects(rpc('claim', { gameId: single, owner }), e => e.code === 'ALREADY_COMPLETE');
  evidence.completedFixtureGames = 21; evidence.distinctMatrixWorkers = 20;
  evidence.parity = verified; evidence.acceptance = first; evidence.repeatedImport = repeated;
  evidence.completedGameNotReclaimed = true;
}
try {
  await main();
  console.log(JSON.stringify(evidence));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Fixture-only link verification: ${role}\n\n\`\`\`json\n${JSON.stringify(evidence, null, 2)}\n\`\`\`\n\nNo official SG requests. No game-pool writes.\n`);
} catch (error) {
  console.error(JSON.stringify({ fixtureOnly: true, role, shard, error: /^[A-Z_]+$/.test(error.code || '') ? error.code : 'VERIFICATION_FAILED', ...(error.exitCode !== undefined ? { sshExitCode: error.exitCode } : {}) }));
  process.exitCode = 1;
}
