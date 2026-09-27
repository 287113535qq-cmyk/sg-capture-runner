import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('../../collector/node_modules/puppeteer');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.RUNNER_OS, 'Linux');
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
const game = JSON.parse(fs.readFileSync('config/games.json', 'utf8')).find(g => g.gameId === 32471);
assert(game && game.name === 'Book of Sevens');
const report = { gameId: game.gameId, runtimeGameId: game.runtimeGameId, game: game.name,
  runner: 'github-hosted-linux', requestedRoundTarget: 300000, stage: 'fresh-demo-launch-check', paidRoundRequests: 0 };
let browser;
try {
  const executablePath = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/opt/google/chrome/chrome'].find(p => fs.existsSync(p));
  assert(executablePath, 'CHROME_RUNTIME_MISSING');
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  let seen = false, login = false, launchResponseStatus = null;
  const statuses = [];
  function inspect(value) {
    if (typeof value === 'string') {
      try { const u = new URL(value); if (u.pathname.includes('/gcm/gcm-launcher/launcher.html') && u.searchParams.has('sessionid')) seen = true; } catch {}
    } else if (Array.isArray(value)) value.forEach(inspect);
    else if (value && typeof value === 'object') Object.values(value).forEach(inspect);
  }
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url(); inspect(url);
    if (url.includes('myaccount.draftkings.com/auth/login')) login = true;
    if (url.includes('/gcm/gcm-launcher/launcher.html')) { request.abort().catch(() => {}); return; }
    request.continue().catch(() => {});
  });
  page.on('response', async response => {
    try {
      const u = new URL(response.url());
      if (response.request().isNavigationRequest()) statuses.push({ host: u.hostname, status: response.status() });
      if (u.pathname.includes('/launch/browser/demoplay/')) {
        launchResponseStatus = response.status(); inspect(await response.json());
      }
    } catch {}
  });
  const demo = `https://casino.draftkings.com/games/${game.sourceId}/${game.pathSlug}/demo?returnUrl=%2Fcategory%2Fslots`;
  await page.goto(demo, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  const until = Date.now() + 45000;
  while (!seen && !login && Date.now() < until) await new Promise(r => setTimeout(r, 1000));
  report.freshLaunchObserved = seen; report.loginRequired = login; report.navigationStatuses = statuses; report.launchResponseStatus = launchResponseStatus;
  report.pageTitle = await page.title().catch(() => 'unavailable');
  report.challengeObserved = await page.evaluate(() => /verify you are human|access denied|access restricted|not a robot|temporarily restricted/i.test(document.body?.innerText || '')).catch(() => false);
  report.status = seen ? 'ready-for-single-round-test' : login ? 'source-login-required' : 'source-launch-unavailable';
  if (!seen) process.exitCode = 2;
} catch {
  report.status = 'source-check-failed'; process.exitCode = 2;
} finally {
  await browser?.close().catch(() => {});
  // Never report a session, complete launch URL, response body, cookie or token.
  console.log(JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Single-game 300k source readiness\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`);
}
