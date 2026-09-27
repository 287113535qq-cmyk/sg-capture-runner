const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-preparation-test-'));
const corpus = path.join(temp, 'rounds');
process.env.SG_CAPTURE_ROOT = corpus;
const { loadRoundStats, buildPlanStatus } = require('../script/batch-capture');
const { captureGame } = require('../sg');
const { SGSessionClient } = require('../sg.http');
const root = path.resolve(__dirname, '..');
function json(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); }
function rows(id, values) { fs.mkdirSync(path.join(corpus, String(id)), { recursive: true }); fs.writeFileSync(path.join(corpus, String(id), 'rounds.jsonl'), values.map(x => JSON.stringify({ data: x })).join('\n') + '\n'); }
function fingerprint(dir) {
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => {
    const full = path.join(e.parentPath, e.name);
    return [path.relative(dir, full), crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')];
  }));
}
function run(args) {
  return spawnSync(process.execPath, ['--require', 'ts-node/register', 'script/batch-capture.ts', ...args], {
    cwd: root, encoding: 'utf8', timeout: 30000, env: { ...process.env, SG_CAPTURE_ROOT: corpus,
      SG_BATCH_ALLOW_SHARED_SESSION: '', SG_REQUIRE_STANDARD_ROUNDS: '', SG_BATCH_CONCURRENT_GAMES: '',
      SG_CAPTURE_RULES_PATH: '', SG_STATIC_MANIFEST: '', SG_BATCH_METADATA: '' },
  });
}
const metadata = path.join(temp, 'metadata.json'), rules = path.join(temp, 'rules.json');
const skips = path.join(temp, 'skips.json'), statics = path.join(temp, 'statics.json');
json(metadata, Array.from({ length: 9 }, (_, i) => ({ gameId: i + 1, name: `fixture-${i + 1}`,
  runtimeSlug: `fixture${i + 1}`, operatorId: 'TEST_ONLY_OPERATOR', currency: 'USD', lang: 'en', mode: 'demo',
  sessionId: i === 3 ? '' : `TEST_ONLY_SECRET_${i + 1}`, serverAddress: 'https://example.invalid',
  startUrl: 'https://example.invalid/?session=TEST_ONLY_SECRET' })));
json(rules, Array.from({ length: 9 }, (_, i) => ({ gameId: i + 1, disableDerivedEnhancedBetOptions: true,
  ...(i === 2 ? { knownSpecialKinds: ['freeGame', 'feature'] } : {}),
  ...(i === 5 ? { enhancedBetOptions: [{ buy: 1, level: 1, label: 'fixture variant' }] } : {}),
  ...(i === 6 ? { knownSpecialKinds: ['freeGame'], freeChoiceOptionCount: 2 } : {}),
  ...(i === 7 ? { knownSpecialKinds: ['freeGame'] } : {}) })));
json(skips, { skipped: [{ gameId: 5, reason: 'TEST_ONLY_SECRET', source: 'runtime-failure' }] });
json(statics, {});
rows(1, [{}, {}]); rows(2, [{}]);
rows(3, [{ primaryBonusKind: 'freeGame' }, { primaryBonusKind: 'freeGame' }]);
rows(7, [{ primaryBonusKind: 'freeGame', freeChoiceOptionIndex: 1 }, { primaryBonusKind: 'freeGame', freeChoiceOptionIndex: 8 }]);
rows(8, [{ primaryBonusKind: 'freeGame' }]);
fs.mkdirSync(path.join(corpus, '9'), { recursive: true });
fs.writeFileSync(path.join(corpus, '9', 'finish.txt'), 'historical marker; no round evidence');
const args = ['--dry-run', '--ignore-yaml-config', '--metadata', metadata, '--static-manifest', statics,
  '--capture-rules', rules, '--skipped-games', skips, '--round-limit', '2'];

test('dry-run classifies plans, preserves corpus and ledgers, and reports no private values', () => {
  const before = fingerprint(corpus), beforeLedger = fs.readFileSync(skips);
  const report = path.join(temp, 'preflight.json');
  const result = run([...args, '--preflight-report', report]);
  assert.equal(result.status, 0, result.stderr);
  const text = fs.readFileSync(report, 'utf8'), doc = JSON.parse(text);
  assert.equal(doc.preparationOnly, true); assert.equal(doc.requestedConcurrentGames, 1);
  assert.equal(doc.distinctGames, 9); assert.equal(doc.totalPlans, 10);
  assert.equal(doc.complete, 2); assert.equal(doc.pending, 6); assert.equal(doc.missingConfig, 1); assert.equal(doc.skipped, 1);
  assert.equal(doc.plans.find(p => p.gameId === 3).status, 'pending', 'one special kind cannot mask another');
  assert.equal(doc.plans.find(p => p.gameId === 7).status, 'pending', 'out of range choice cannot substitute required option');
  assert.equal(doc.plans.find(p => p.gameId === 9).status, 'pending', 'marker alone is not completion');
  assert.equal(doc.plans.find(p => p.gameId === 9).finishMarkerPresent, true);
  assert.equal(doc.plans.find(p => p.gameId === 1).stats.roundCount, 2);
  assert.equal(doc.plans.filter(p => p.gameId === 6).length, 2);
  assert.doesNotMatch(text + result.stdout + result.stderr, /TEST_ONLY_SECRET|TEST_ONLY_OPERATOR|example\.invalid/);
  assert.deepEqual(fingerprint(corpus), before); assert.deepEqual(fs.readFileSync(skips), beforeLedger);
});
test('existing output cannot be overwritten even if it is a formal file', () => {
  const marker = path.join(corpus, '9', 'finish.txt'), before = fs.readFileSync(marker);
  const result = run([...args, '--preflight-report', marker]);
  assert.notEqual(result.status, 0); assert.deepEqual(fs.readFileSync(marker), before);
});
test('real batch entry refuses before planning or source access', () => {
  const result = run(['--metadata', 'missing-private-file']);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /SG_PREPARATION_ONLY/);
});
test('shared sessions and unbounded concurrency are rejected', () => {
  for (const flag of ['--allow-shared-session', '--concurrent-games=all']) {
    const result = run([...args, flag]); assert.notEqual(result.status, 0);
  }
});
test('capture and protocol entry points reject before networking', async () => {
  await assert.rejects(captureGame({}), /SG_PREPARATION_ONLY/);
  await assert.rejects(new SGSessionClient({}).postGDM('init'), /SG_PREPARATION_ONLY/);
});
test('malformed or non-round lines fail closed with no raw value in error', async () => {
  for (const [key, text] of [['truncated', '{"session":"TEST_ONLY_SECRET"'], ['error-page', '<html>TEST_ONLY_SECRET</html>'], ['not-round', '{}']]) {
    fs.mkdirSync(path.join(corpus, key), { recursive: true }); fs.writeFileSync(path.join(corpus, key, 'rounds.jsonl'), text);
    await assert.rejects(loadRoundStats(key), e => /SG_INVALID_JSONL/.test(e.message) && !e.message.includes('TEST_ONLY_SECRET'));
  }
});
test('streaming stats accepts CRLF and counts valid nonempty lines', async () => {
  fs.mkdirSync(path.join(corpus, 'crlf'), { recursive: true });
  fs.writeFileSync(path.join(corpus, 'crlf', 'rounds.jsonl'), '{"data":{}}\r\n\r\n{"data":{"primaryBonusKind":"feature"}}\r\n');
  const stats = await loadRoundStats('crlf'); assert.equal(stats.roundCount, 2); assert.equal(stats.featureCount, 1);
});
test('per-kind and option coverage do not inflate completion', () => {
  const stats = { roundCount: 500, bonusLikeCount: 100, freeGameCount: 100, featureCount: 0, freeFeatureCount: 0, freeChoiceOptionHits: { 1: 1, 10: 1 } };
  assert.equal(buildPlanStatus({}, stats, ['freeGame', 'feature'], 0, 2000, 1).status, 'pending');
  assert.equal(buildPlanStatus({}, stats, ['freeGame'], 2, 2000, 1).status, 'pending');
});
test.after(() => {
  assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
  assert(path.basename(temp).startsWith('sg-preparation-test-'));
  fs.rmSync(temp, { recursive: true, force: true });
});
test('source identity mapping separates runtime IDs and excludes private fields', () => {
  const { buildSourceCatalog } = require('../../scripts/build-source-catalog.cjs');
  const runtime = [{ gameId: 32971, sourceId: 'official-fixture', name: 'fixture' }];
  const launches = { 32749: { id: 32749, sourceId: 'official-fixture', pageSlug: 'fixture', sessionId: 'TEST_ONLY_SECRET', operatorId: 'TEST_ONLY_OPERATOR', launchUrl: 'https://example.invalid/?secret=TEST_ONLY_SECRET' } };
  const result = buildSourceCatalog(runtime, launches);
  assert.equal(result[0].gameId, 32749); assert.equal(result[0].runtimeGameId, 32971);
  assert.doesNotMatch(JSON.stringify(result), /TEST_ONLY_|launchUrl|sessionId|operatorId/);
  assert.throws(() => buildSourceCatalog(runtime, {}), /mapping/);
  assert.throws(() => buildSourceCatalog(runtime, [...Object.values(launches), ...Object.values(launches)]), /mapping/);
  assert.throws(() => buildSourceCatalog([...runtime, ...runtime], launches), /duplicate/);
});
