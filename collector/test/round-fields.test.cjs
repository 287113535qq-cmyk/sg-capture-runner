const assert = require('node:assert/strict');
const test = require('node:test');
const { buildRoundDoc } = require('../sg.round');
const { prepareNextgenRound } = require('../sg.ingest');
const samples = require('../../fixtures/round-fields.json').samples.filter(s => s.raw.protocol === 'nextgen');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
for (const sample of samples) {
  test(`business fields from NextGen protocol: ${sample.id}`, () => {
    const doc = prepareNextgenRound(sample.raw, { ...sample.expected, typeMappingHash: 'fixture-test-hash' });
    for (const [key, value] of Object.entries(sample.expected)) assert.equal(doc[key], value);
  });
}
test('collector output and the actual server analyzer agree for every NextGen sample', () => {
  for (const sample of samples) {
    const result = spawnSync(process.platform === 'win32' ? 'python' : 'python3',
      [path.resolve(__dirname, '../../service/round_fields.py')], { input: JSON.stringify(sample.raw), encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0);
    const fields = JSON.parse(result.stdout).fields;
    assert.deepEqual(prepareNextgenRound(sample.raw, fields), fields);
  }
});
test('free type needs an explicit mapping; feature kind never becomes a numeric free type', () => {
  const free = samples.find(s => s.id === 'ng-natural-free').raw;
  assert.throws(() => buildRoundDoc(1, 'fixture', free.steps, free.startBalanceRaw), /FREE_TYPE_MAPPING_REQUIRED/);
  const feature = samples.find(s => s.id === 'ng-feature-only').raw;
  assert.equal(buildRoundDoc(1, 'fixture', feature.steps, feature.startBalanceRaw).doc.bonus, 0);
});
test('zero/negative wagers, malformed wins and unsettled balance evidence are rejected', () => {
  const raw = samples.find(s => s.id === 'ng-loss').raw;
  const build = value => buildRoundDoc(1, 'fixture', value.steps, value.startBalanceRaw);
  for (const start of [99875, 99874, -1, NaN, Infinity, 100000.5]) assert.throws(() => build({ ...raw, startBalanceRaw: start }));
  for (const value of ['', 'NaN', '-1', '0.5', 'Infinity']) {
    const changed = structuredClone(raw); changed.steps[0].responsePayload = changed.steps[0].responsePayload.replace('TW=0', `TW=${value}`);
    assert.throws(() => build(changed), /INVALID_MONEY_EVIDENCE/);
  }
  const changed = structuredClone(raw); changed.steps[0].responsePayload = changed.steps[0].responsePayload.replace('AB=99875', 'AB=99876');
  assert.throws(() => build(changed), /UNRECONCILED_FINAL_BALANCE/);
});
