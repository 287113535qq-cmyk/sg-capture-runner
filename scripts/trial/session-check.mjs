import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { XMLParser } = require('../../collector/node_modules/fast-xml-parser');
const report = { gameId: 32471, runtimeGameId: 33026, game: 'Book of Sevens',
  runner: 'github-hosted-linux', requestedRoundTarget: 300000,
  stage: 'existing-demo-session-check', paidRoundRequests: 0, sourceRequests: 0 };
try {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.RUNNER_OS, 'Linux');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  const game = JSON.parse(process.env.SG_TRIAL_DEMO_CONFIG || '{}');
  assert.equal(game.id, 32471);
  assert.equal(game.mode, 'demo');
  assert.equal(game.runtimeSlug, 'bookofsevens96');
  assert.equal(game.serverAddress, 'ogs-gdm-usnj.nyxop.net/nextgen');
  for (const key of ['sessionId', 'operatorId', 'currency', 'lang']) {
    assert.equal(typeof game[key], 'string');
    assert(game[key].length > 0 && game[key].length < 512);
  }
  const xml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const payload = `GN=${game.runtimeSlug}&PID=gdmgcm${game.sessionId}&MSGID=INIT`;
  const body = '<gdmRequest><clienttype>flash</clienttype><lang>en_us</lang>' +
    `<currency>${xml(game.currency)}</currency><mode>demo</mode>` +
    `<token>${xml(game.sessionId + '@' + game.operatorId)}</token>` +
    `<methodName>processGameMessage</methodName><payload>${xml(payload)}</payload></gdmRequest>`;
  report.sourceRequests++;
  const start = performance.now();
  const response = await fetch(`https://${game.serverAddress}/`, {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'text/xml; charset=utf-8' }, body,
  });
  report.httpStatus = response.status;
  report.elapsedMs = Math.round(performance.now() - start);
  if (response.status === 429) {
    report.status = 'source-rate-limited';
  } else if (!response.ok) {
    report.status = 'source-http-rejected';
  } else {
    const text = await response.text();
    assert(text.length < 2000000 && !/<!DOCTYPE|<!ENTITY/i.test(text));
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' }).parse(text);
    const root = parsed.GDMRESPONSE || parsed.gdmresponse || {};
    report.protocolSuccess = String(root.SUCCESS).toLowerCase() === 'true';
    const values = Object.fromEntries(String(root.PAYLOAD || '').split('&').map(p => {
      const index = p.indexOf('='); return [p.slice(0, index), p.slice(index + 1)];
    }));
    report.initAcknowledged = values.MSGID === 'INIT';
    // Only fixed statuses and numeric codes leave the Runner; never source messages or payloads.
    const code = String(root.OGS_RC ?? root.ERRORCODE ?? '');
    if (/^-?\d{1,8}$/.test(code)) report.numericResultCode = code;
    report.status = report.protocolSuccess && report.initAcknowledged
      ? 'ready-for-single-round-test' : 'existing-session-rejected';
  }
  if (report.status !== 'ready-for-single-round-test') process.exitCode = 2;
} catch {
  report.status = 'session-check-failed'; process.exitCode = 2;
} finally {
  console.log(JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Existing demo session check\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`);
}
