import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createRpc } from './rpc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
require(path.join(root, 'collector/node_modules/ts-node')).register({ project: path.join(root, 'collector/tsconfig.json') });
const { prepareNextgenRound } = require(path.join(root, 'collector/sg.ingest.ts'));
const samples = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/round-fields.json'), 'utf8')).samples;
const caseId = process.env.SG_LINK_CASE;
assert.match(caseId || '', /^fixture_fields_[a-z0-9_]+$/);
const rpc = createRpc(caseId);
const role = process.argv[2];
assert(['seed', 'resume', 'audit'].includes(role));
const owner = `${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:fields-${role}`;
const evidence = { schema: 'sg-round-fields-verification-v1', caseId, role, fixtureOnly: true, officialRequests: 0, gamePoolsTouched: false };

function round(sample) {
  const result = spawnSync('python3', [path.join(root, 'service/round_fields.py')], {
    input: JSON.stringify(sample.raw), encoding: 'utf8', timeout: 10000, maxBuffer: 65536,
  });
  assert.equal(result.status, 0, 'Offline analysis rejected a fixture');
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  let fields = parsed.fields;
  if (sample.raw.protocol === 'nextgen') {
    const fromCollector = prepareNextgenRound(sample.raw, fields);
    assert.deepEqual(fromCollector, fields, 'Collector and server field rules differ');
    fields = fromCollector;
  }
  for (const [key, value] of Object.entries(sample.expected)) assert.equal(fields[key], value);
  const game = `fixture-${sample.id}`;
  return { sequence: 1, sourceRoundId: `${game}:round:1`, raw: sample.raw,
    normalized: { fixtureOnly: true, gameKey: game, sequence: 1, ...fields } };
}
const rounds = samples.map(round);
async function claim(gameId) {
  for (let i = 0; i < 42; i++) {
    try { return await rpc('claim', { gameId, owner }); }
    catch (error) { if (error.code !== 'GAME_BUSY' || i === 41) throw error; await new Promise(resolve => setTimeout(resolve, 15000)); }
  }
}
function owned(lease) { return { gameId: lease.gameId, epoch: lease.epoch, owner }; }
async function verified() {
  const result = await rpc('verify');
  assert.equal(result.count, samples.length);
  assert.equal(result.businessFieldsVerified, samples.length);
  for (const sample of samples) {
    const row = result.businessFields.find(row => row.gameId === `fixture-${sample.id}`);
    assert(row);
    for (const [key, value] of Object.entries(sample.expected)) assert.equal(row[key], value);
  }
  return result;
}
function output(name, value) { fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`); }
async function main() {
  if (role === 'seed') {
    await rpc('initialize', { games: samples.map(s => ({ gameId: `fixture-${s.id}`, target: 1 })) });
    const status = await rpc('status');
    const complete = status.tasks.every(t => t.status === 'complete');
    output('work_required', String(!complete));
    if (complete) { evidence.alreadyComplete = true; return; }
    const first = rounds[0], game = first.normalized.gameKey;
    if (status.tasks.find(t => t.game === game).status === 'complete') { evidence.firstAlreadyComplete = true; return; }
    const lease = await claim(game);
    let rejections = 0;
    for (const key of ['bet', 'mul', 'buy', 'bonus']) {
      const changed = structuredClone(first); changed.normalized[key] += 1;
      await assert.rejects(rpc('commit', { ...owned(lease), round: changed }), e => e.code === 'ROUND_FIELDS_MISMATCH');
      rejections++;
    }
    const unknown = structuredClone(first); unknown.raw.steps[0].requestPayload += '&ABPM=999';
    await assert.rejects(rpc('commit', { ...owned(lease), round: unknown }), e => e.code === 'BUY_MAPPING_REQUIRED');
    rejections++;
    const unknownFree = structuredClone(rounds[2]);
    unknownFree.sourceRoundId = first.sourceRoundId; unknownFree.normalized.gameKey = game;
    unknownFree.raw.steps.at(-1).responsePayload = unknownFree.raw.steps.at(-1).responsePayload.replace('CFG=2', 'CFG=99');
    await assert.rejects(rpc('commit', { ...owned(lease), round: unknownFree }), e => e.code === 'FREE_TYPE_MAPPING_REQUIRED');
    rejections++;
    if (!(status.receipts.prepared || 0)) {
      await rpc('heartbeat', owned(lease));
      await rpc('commit', { ...owned(lease), round: first, failpoint: 'after_mongo' }, true);
      evidence.realProcessCrashAfterMongo = true;
    }
    const interrupted = await rpc('status');
    assert.equal(interrupted.tasks.find(t => t.game === game).checkpoint, 0);
    assert.equal(interrupted.receipts.prepared, 1);
    await rpc('release', { ...owned(lease), status: 'pending', reason: 'fixture_stop' });
    evidence.invalidSubmissionsRejected = rejections;
    evidence.checkpointStayedAtZero = true;
    return;
  }
  if (role === 'resume') {
    const status = await rpc('status');
    let inserted = 0, recovered = 0;
    for (const value of rounds) {
      const game = value.normalized.gameKey;
      if (status.tasks.find(t => t.game === game).status === 'complete') continue;
      const lease = await claim(game);
      await rpc('heartbeat', owned(lease));
      const saved = await rpc('commit', { ...owned(lease), round: value });
      inserted += saved.mongoInserted; recovered += saved.recovered;
      const repeated = await rpc('commit', { ...owned(lease), round: value });
      assert.equal(repeated.mongoInserted, 0); assert.equal(repeated.duplicate, true);
      await rpc('release', { ...owned(lease), status: 'complete' });
    }
    evidence.mongoInserted = inserted; evidence.recoveredJournalRows = recovered;
    evidence.duplicateAddedRows = 0; evidence.parity = await verified();
    return;
  }
  evidence.parity = await verified();
  evidence.acceptance = await rpc('promote');
  evidence.repeatedImport = await rpc('promote');
  assert.equal(evidence.acceptance.acceptedCount, samples.length);
  assert.equal(evidence.repeatedImport.inserted, 0);
  evidence.buyCodes = [...new Set(samples.map(s => s.expected.buy))].sort((a,b) => a-b);
  evidence.bonusCodes = [...new Set(samples.map(s => s.expected.bonus))].sort((a,b) => a-b);
}
try {
  await main();
  console.log(JSON.stringify(evidence));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### SG business fields: ${role}\n\n\`\`\`json\n${JSON.stringify(evidence, null, 2)}\n\`\`\`\n\nSynthetic samples only. No official SG requests or game-pool writes.\n`);
} catch (error) {
  console.error(JSON.stringify({ fixtureOnly: true, role, error: /^[A-Z_]+$/.test(error.code || '') ? error.code : 'BUSINESS_FIELDS_VERIFICATION_FAILED' }));
  process.exitCode = 1;
}
