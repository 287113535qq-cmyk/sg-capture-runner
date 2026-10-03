import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { MongoClient, Db } from 'mongodb';
import Decimal from 'decimal.js';
import {
    loadGames, loadMongoConfig, adminMongoUri, buildMongoUri, githubClient,
    setRepositorySecret, deleteRepositorySecret, inspectTarget, makeUsername, acquireQueueLock,
} from './public-controller';
import { RollingState, RollingGameState, TaskRecord, quotas, workerSummary, mergeDecision, canResetInterruptedTasks, mergeSelectedRows, stagingName } from './rolling-controller-lib';
import { validateReplaySequence } from '../src/ag.mongo';
import { AG_CAPTURE_SOURCE, AG_CAPTURE_VERSION } from '../src/ag.version';

const directory = path.resolve('.controller');
const statePath = path.join(directory, 'rolling-state.json');
const credentialPath = path.join(directory, 'rolling-credentials.json');
const repository = '/repos/try-catch/ag-capture';
const workflow = 'capture-ag-rolling.yml';
const secret = 'AG_ROLLING_PAYLOAD';
const publicPath = path.resolve(process.env.PUBLIC_RUNNER_PATH || '../ag-capture');
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8'));
type State = RollingState & { dispatchAt?: string; previousRunId?: number };
type Credentials = Record<string, { username: string; mongoUri: string }>;
export function isPreservedCollection(gameId: string, name: string) {
    return /^simulate_backup_[A-Za-z0-9_]+$/.test(name)
        || (gameId === 'play-coin-trio-fortune-trails' && name === 'display_state');
}
function save(file: string, value: unknown) {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(`${file}.tmp`, file);
}
function load(): State {
    const state = read<State>(statePath);
    if (state.version !== 1 || !/^rolling-\d{14}-[a-f0-9]{8}$/.test(state.queueId)) throw new Error('invalid rolling state');
    const manifest = loadGames();
    const databases = new Set<string>();
    for (const game of state.games) {
        if (!manifest.some(g => g.gameId === game.gameId && g.dbName === game.dbName) || databases.has(game.dbName)) throw new Error('rolling state manifest mismatch');
        if (game.campaignId !== `${game.dbName}-${state.queueId}`) throw new Error('rolling campaign mismatch');
        databases.add(game.dbName); quotas(game.baseline);
    }
    return state;
}
async function mongo() {
    const client = new MongoClient(adminMongoUri(loadMongoConfig()), { maxPoolSize: 8 });
    await client.connect(); return client;
}
async function liveLeases(db: Db) {
    // 不仅检查已知owner，防止遗留或外部采集程序同时写入。
    return db.collection('capture_locks').countDocuments({ expiresAt: { $gt: new Date() } });
}
async function assertNoRuns() {
    const gh = githubClient();
    for (const status of ['in_progress', 'queued', 'waiting', 'pending', 'requested']) {
        const response = await gh.get(`${repository}/actions/runs`, { params: { status, per_page: 100 } });
        if ((response.data.total_count || 0) > 0) throw new Error(`GitHub still has ${status} workflow(s); refuse another queue`);
    }
}
function checkedPublicSha() {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: publicPath, encoding: 'utf8', windowsHide: true }).trim();
    if (git('status', '--porcelain')) throw new Error('public runner must be clean before dispatch');
    const sha = git('rev-parse', 'HEAD');
    if (git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0] !== sha) throw new Error('public runner is not the published main');
    return sha;
}
async function preview() {
    const old = read<{ gameId: string; phase: string }>(path.join(directory, 'state.json'));
    const all = loadGames();
    const client = await mongo();
    try {
        const selected: Array<{ gameId: string; dbName: string; baseline: number; preservedCollections: string[] }> = [];
        const skipped: Array<{ gameId: string; total: number }> = [];
        for (const game of all) {
            const counts = await inspectTarget(client, game);
            if (counts.invalid) throw new Error(`invalid formal RTP requires diagnosis: ${game.gameId}`);
            if (counts.total >= 300000) { skipped.push({ gameId: game.gameId, total: counts.total }); continue; }
            const preservedCollections = counts.collections.filter(n => isPreservedCollection(game.gameId, n));
            const unexpected = counts.collections.filter(n => !['simulate', 'handshake', 'capture_locks', ...preservedCollections].includes(n));
            if (unexpected.length || await liveLeases(client.db(game.dbName))) throw new Error(`existing staging or leases require diagnosis: ${game.gameId}`);
            selected.push({ gameId: game.gameId, dbName: game.dbName, baseline: counts.total, preservedCollections });
        }
        return { previous: old, selected, skipped };
    } finally { await client.close(); }
}
function payload(state: State, credentials: Credentials) {
    const games = state.games.filter(g => g.phase === 'ready').map(game => {
        const credential = credentials[game.campaignId];
        if (!credential || credential.username !== game.username) throw new Error('missing scoped rolling credential');
        return { gameId: game.gameId, dbName: game.dbName, campaignId: game.campaignId, baseline: game.baseline, mongoUri: credential.mongoUri };
    });
    if (!games.length) throw new Error('no ready games in queue');
    const value = JSON.stringify({ version: 1, queueId: state.queueId, games });
    if (Buffer.byteLength(value) > 45000) throw new Error('rolling secret exceeds safe size');
    return value;
}
async function discoverDispatch(state: State): Promise<boolean> {
    const gh = githubClient();
    const result = await gh.get(`${repository}/actions/workflows/${workflow}/runs`, { params: { per_page: 100 } });
    const matches = result.data.workflow_runs.filter((r: any) => r.display_title === `AG rolling ${state.queueId}` && r.id !== state.previousRunId && Date.parse(r.created_at) >= Date.parse(state.dispatchAt!) - 1000);
    if (matches.length > 1) throw new Error('ambiguous dispatch: multiple matching runs');
    if (!matches.length) return false;
    if (matches[0].head_sha !== state.publicSha) throw new Error('dispatched source SHA mismatch');
    state.runId = matches[0].id; state.phase = 'running'; save(statePath, state);
    console.log(JSON.stringify({ action: 'rolling-started', queueId: state.queueId, runId: state.runId, games: state.games.filter(g => g.phase === 'ready').length, workers: 20, threads: 8 }));
    return true;
}
async function dispatch(state: State, credentials: Credentials) {
    await assertNoRuns();
    state.publicSha = checkedPublicSha();
    await setRepositorySecret(githubClient(), payload(state, credentials), secret);
    state.previousRunId = state.runId || undefined;
    state.runId = null; state.dispatchAt = new Date().toISOString(); state.phase = 'dispatching';
    save(statePath, state); // 先保存派发意图，网络响应不明时只查询，不再次POST。
    await githubClient().post(`${repository}/actions/workflows/${workflow}/dispatches`, { ref: 'main', inputs: { queue_id: state.queueId } });
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 2000));
        if (await discoverDispatch(state)) return;
    }
    throw new Error('dispatch pending confirmation; use start to discover, do not create another queue');
}
async function start() {
    let state: State;
    if (fs.existsSync(statePath)) {
        state = load();
        if (state.phase === 'dispatching') {
            if (!await discoverDispatch(state)) throw new Error('dispatch not found; retained intent, manual investigation required');
            return;
        }
        if (state.phase !== 'preparing') throw new Error('rolling queue already exists; use status/reconcile/resume');
    } else {
        const plan = await preview();
        if (plan.previous.phase !== 'complete') throw new Error('previous single-game capture must be finalized first');
        if (!plan.selected.length) { console.log(JSON.stringify({ action: 'all-complete' })); return; }
        await assertNoRuns();
        const queueId = `rolling-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`;
        state = { version: 1, queueId, runId: null, phase: 'preparing', startedAt: new Date().toISOString(), publicSha: checkedPublicSha(), games: plan.selected.map(g => ({ ...g, campaignId: `${g.dbName}-${queueId}`, phase: 'pending' })) };
        save(statePath, state);
    }
    await assertNoRuns();
    const credentials: Credentials = fs.existsSync(credentialPath) ? read(credentialPath) : {};
    const client = await mongo();
    try {
        for (const game of state.games) {
            const db = client.db(game.dbName);
            const counts = await inspectTarget(client, game);
            if (counts.total !== game.baseline || counts.invalid || await liveLeases(db)) throw new Error(`baseline changed: ${game.gameId}`);
            const initialAllowed = ['simulate', 'handshake', 'capture_locks', ...(game.preservedCollections || [])];
            if (['provisioning', 'ready'].includes(game.phase)) initialAllowed.push('capture_queue');
            if (counts.collections.some(n => !initialAllowed.includes(n))) throw new Error(`unexpected collection before provisioning: ${game.gameId}`);
            if (!credentials[game.campaignId]) {
                const username = makeUsername();
                const pass = crypto.randomBytes(32).toString('base64url');
                credentials[game.campaignId] = { username, mongoUri: buildMongoUri(loadMongoConfig(), username, pass, game.dbName) };
                save(credentialPath, credentials);
                game.username = username; game.phase = 'provisioning'; save(statePath, state);
            }
            const credential = credentials[game.campaignId];
            game.username = credential.username;
            if (!/^agcap_[a-z0-9_]+$/.test(credential.username)) throw new Error('unsafe temporary username');
            const existing = await db.command({ usersInfo: credential.username });
            if (!existing.users?.length) {
                await db.command({ createUser: credential.username, pwd: decodeURIComponent(new URL(credential.mongoUri).password), roles: [{ role: 'readWrite', db: game.dbName }] });
            } else if (existing.users[0].roles.length !== 1 || existing.users[0].roles[0].role !== 'readWrite' || existing.users[0].roles[0].db !== game.dbName) throw new Error('temporary user scope mismatch');
            const probe = new MongoClient(credential.mongoUri, { maxPoolSize: 1, serverSelectionTimeoutMS: 15000 });
            try { await probe.connect(); await probe.db(game.dbName).command({ ping: 1 }); }
            catch { throw new Error(`scoped credential probe failed: ${game.gameId}`); }
            finally { await probe.close(); }
            const control = db.collection<TaskRecord>('capture_queue');
            const ids = [...Array.from({ length: 2 }, (_, i) => `canary:${i + 1}`), ...Array.from({ length: 20 }, (_, i) => `worker:${i + 1}`)];
            await control.bulkWrite(ids.map(id => ({ updateOne: { filter: { _id: id }, update: { $setOnInsert: { queueId: state.queueId, campaignId: game.campaignId, status: 'pending' } }, upsert: true } })));
            const records = await control.find({}).toArray();
            if (records.length !== 22 || records.some(r => r.queueId !== state.queueId || r.campaignId !== game.campaignId || r.status !== 'pending')) throw new Error('unexpected initial task state');
            game.phase = 'ready'; save(statePath, state);
            console.log(JSON.stringify({ action: 'game-prepared', gameId: game.gameId, baseline: game.baseline }));
        }
    } finally { await client.close(); }
    await dispatch(state, credentials);
}
const stage = stagingName;
// 有界并发工具：本机到 Mongo 的链路往返是主要成本，串行会把总耗时线性叠加
// （2026-09-11 实测：44 个游戏全串行的 status 稳定耗时 265~348 秒）。
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        for (;;) {
            const index = cursor++;
            if (index >= items.length) return;
            results[index] = await fn(items[index]);
        }
    });
    await Promise.all(runners);
    return results;
}
async function gameStatus(client: MongoClient, state: State, game: RollingGameState) {
    const db = client.db(game.dbName);
    const formal = await inspectTarget(client, game);
    const records = await db.collection<TaskRecord>('capture_queue').find({}).toArray();
    const summary = records.length ? workerSummary(records, state.queueId, game.campaignId) : null;
    let staging = 0, invalid = 0;
    const stagingNames = formal.collections.filter(name => name.startsWith(`simulate_gh_${game.dbName}_${game.campaignId}_worker_`));
    const stagingCounts = await mapLimit(stagingNames, 6, async (name) => {
        const collection = db.collection(name);
        const [total, missing] = await Promise.all([
            collection.countDocuments({}),
            collection.countDocuments({ 'rtp.0': { $exists: false } }),
        ]);
        return { total, missing };
    });
    for (const counts of stagingCounts) { staging += counts.total; invalid += counts.missing; }
    return { gameId: game.gameId, dbName: game.dbName, phase: game.phase, formal: formal.total, rtp: formal.tagged, invalid: formal.invalid, staging, stagingInvalid: invalid, workers: summary, reason: game.reason, acceptedTotal: game.acceptedTotal };
}
async function status() {
    const state = load(); const client = await mongo();
    try {
        const games = await mapLimit(state.games, 6, (game) => gameStatus(client, state, game));
        let workflowState = null;
        if (state.runId) {
            const response = await githubClient().get(`${repository}/actions/runs/${state.runId}`);
            const jobs = await githubClient().get(`${repository}/actions/runs/${state.runId}/jobs`, { params: { per_page: 100 } });
            workflowState = { status: response.data.status, conclusion: response.data.conclusion, nodes: jobs.data.jobs.map((j: any) => ({ name: j.name, status: j.status, conclusion: j.conclusion, runnerId: j.runner_id, startedAt: j.started_at })) };
        }
        console.log(JSON.stringify({ queueId: state.queueId, phase: state.phase, runId: state.runId, workflow: workflowState, games }));
    } finally { await client.close(); }
}
async function validateRows(db: Db, game: RollingGameState, i: number) {
    const collection = db.collection(stage(game, i));
    let count = 0;
    for await (const row of collection.find({})) {
        const data = row.data;
        if (!Array.isArray(row.rtp) || !row.rtp.length || data?.captureSource !== AG_CAPTURE_SOURCE || data.captureVersion !== AG_CAPTURE_VERSION || data.captureCampaignId !== game.campaignId || data.captureWorkerIndex !== i || !Number.isInteger(data.roundSchemaVersion) || data.roundSchemaVersion < 3) throw new Error(`invalid staging provenance: ${game.gameId} worker ${i}`);
        validateReplaySequence(data);
        if (!new Decimal(row.bet).isPositive() || !new Decimal(row.mul).isFinite() || new Decimal(row.bet).mul(row.mul).sub(data.roundWin).abs().gt('0.0000001')) throw new Error(`invalid replay amount: ${game.gameId} worker ${i}`);
        count++;
    }
    return count;
}
async function cleanupGame(client: MongoClient, state: State, game: RollingGameState, credentials: Credentials) {
    const db = client.db(game.dbName);
    if (await liveLeases(db)) throw new Error('active lease during cleanup');
    const counts = await inspectTarget(client, game);
    if (counts.total !== game.acceptedTotal || counts.invalid) throw new Error('merged count changed before cleanup');
    const allowed = new Set(['handshake', 'capture_locks', 'capture_queue', ...Array.from({ length: 20 }, (_, i) => stage(game, i + 1)), stage(game, 1, 'canary'), stage(game, 2, 'canary')]);
    const preserved = game.preservedCollections || [];
    if (preserved.some(n => !isPreservedCollection(game.gameId, n))) throw new Error('invalid preserved collection');
    if (counts.collections.some(n => n !== 'simulate' && !allowed.has(n) && !preserved.includes(n))) throw new Error('unknown collection blocks cleanup');
    for (const name of counts.collections) if (allowed.has(name)) await db.collection(name).drop();
    if (!game.username || !/^agcap_[a-z0-9_]+$/.test(game.username)) throw new Error('unsafe cleanup username');
    const user = await db.command({ usersInfo: game.username });
    if (user.users?.length) await db.command({ dropUser: game.username });
    delete credentials[game.campaignId]; save(credentialPath, credentials);
    game.phase = 'complete'; save(statePath, state);
}
async function mergeGame(client: MongoClient, state: State, game: RollingGameState, credentials: Credentials) {
    if (game.phase === 'merged') { await cleanupGame(client, state, game, credentials); return; }
    const db = client.db(game.dbName);
    const records = await db.collection<TaskRecord>('capture_queue').find({}).toArray();
    const summary = workerSummary(records, state.queueId, game.campaignId);
    if (summary.pending || summary.running || await liveLeases(db)) return;
    const counts = [];
    for (let i = 1; i <= 20; i++) counts.push(await validateRows(db, game, i));
    const decision = mergeDecision(game, records, state.queueId, counts, await liveLeases(db));
    if (!decision.acceptable) {
        game.phase = 'blocked'; game.reason = `有效 ${decision.total} 条，低于 300000；保留数据等待续跑或协议诊断`;
        save(statePath, state); return;
    }
    const target = db.collection('simulate');
    const baseline = await target.countDocuments({ 'data.captureCampaignId': { $ne: game.campaignId } });
    if (baseline !== game.baseline) throw new Error('formal baseline changed before merge');
    if (game.acceptedTotal !== undefined && game.acceptedTotal !== decision.total) throw new Error('merge journal total changed');
    game.acceptedTotal = decision.total; game.phase = 'merging'; save(statePath, state);
    save(path.join(directory, `${game.campaignId}-merge-evidence.json`), { queueId: state.queueId, campaignId: game.campaignId, baseline, counts, selected: decision.selected, acceptedTotal: decision.total, records, at: new Date().toISOString() });
    await mergeSelectedRows(db, game, decision.selected, decision.total);
    const final = await inspectTarget(client, game);
    if (final.total !== decision.total || final.invalid || await target.countDocuments({ 'data.captureCampaignId': game.campaignId }) !== decision.total - baseline) throw new Error('merged count mismatch; staging retained');
    game.phase = 'merged'; save(statePath, state);
    await cleanupGame(client, state, game, credentials);
    console.log(JSON.stringify({ action: 'game-merged', gameId: game.gameId, total: decision.total, workers: summary }));
}
async function reconcile() {
    const state = load();
    if (state.phase === 'preparing' || state.phase === 'dispatching') throw new Error('queue dispatch not confirmed');
    const credentials: Credentials = fs.existsSync(credentialPath) ? read(credentialPath) : {};
    const client = await mongo();
    try {
        await settleEndedNodes(client, state);
        for (const game of state.games) {
            if (['complete', 'blocked'].includes(game.phase)) continue;
            try { await mergeGame(client, state, game, credentials); }
            catch (error) { console.error(JSON.stringify({ gameId: game.gameId, error: safeMessage(error) })); }
        }
        if (state.games.every(g => ['complete', 'blocked'].includes(g.phase))) {
            const run = state.runId ? (await githubClient().get(`${repository}/actions/runs/${state.runId}`)).data : null;
            if (run?.status === 'completed') {
                await deleteRepositorySecret(githubClient(), secret);
                state.phase = state.games.every(g => g.phase === 'complete') ? 'complete' : 'paused';
                save(statePath, state);
            }
        }
    } finally { await client.close(); }
}

async function settleEndedNodes(client: MongoClient, state: State) {
    if (!state.runId) return;
    const response = await githubClient().get(`${repository}/actions/runs/${state.runId}/jobs`, { params: { per_page: 100 } });
    const ended = new Map<number, string>();
    for (const job of response.data.jobs || []) {
        const match = /^滚动通道 (\d+)$/.exec(job.name);
        if (match && job.status === 'completed') ended.set(Number(match[1]), job.conclusion);
    }
    if (!ended.size) return;
    for (const game of state.games.filter(g => g.phase === 'ready')) {
        const db = client.db(game.dbName); const control = db.collection<TaskRecord>('capture_queue');
        for (const record of await control.find({ queueId: state.queueId, campaignId: game.campaignId }).toArray()) {
            let lane: number | undefined;
            if (record.status === 'running') {
                const match = new RegExp(`^${state.runId}:(\\d+):`).exec(record.owner || '');
                if (match) lane = Number(match[1]);
            } else if (record.status === 'pending' && record._id.startsWith('worker:')) {
                const candidate = Number(record._id.slice(7));
                // 正常到时退出的通道留 pending 给下批续接；异常退出才封存其未开始份额。
                if (ended.has(candidate) && ended.get(candidate) !== 'success') lane = candidate;
            }
            if (!lane || !ended.has(lane)) continue;
            const [kind, index] = record._id.split(':');
            const live = await db.collection('capture_locks').countDocuments({ _id: `gh_${game.campaignId}_${kind}_${index}` as any, expiresAt: { $gt: new Date() } });
            if (live) continue;
            await control.updateOne({ _id: record._id, queueId: state.queueId, campaignId: game.campaignId, status: record.status, ...(record.owner ? { owner: record.owner } : {}) }, { $set: { status: record.status === 'running' ? 'failed' : 'blocked', exitCode: 79, finishedAt: new Date(), reason: 'owning GitHub node ended; no live capture lease' } });
        }
    }
}
async function resume() {
    const state = load();
    if (!state.runId || !['running', 'paused'].includes(state.phase)) throw new Error('queue is not resumable');
    const run = (await githubClient().get(`${repository}/actions/runs/${state.runId}`)).data;
    if (run.status !== 'completed') throw new Error('rolling workflow is still active');
    await assertNoRuns();
    const client = await mongo();
    try {
        for (const game of state.games.filter(g => g.phase === 'ready')) {
            const db = client.db(game.dbName);
            if (!canResetInterruptedTasks(run.status, await liveLeases(db))) throw new Error('active lease blocks task recovery');
            await db.collection('capture_queue').updateMany(
                { queueId: state.queueId, campaignId: game.campaignId, status: { $in: ['running', 'failed', 'blocked'] } },
                { $set: { status: 'pending' }, $unset: { owner: '', exitCode: '', reason: '', finishedAt: '' } },
            );
        }
    } finally { await client.close(); }
    await dispatch(state, read<Credentials>(credentialPath));
}
function safeMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, '[MongoDB credential redacted]');
}
async function main() {
    const command = process.argv[2];
    if (command === 'prepare') { console.log(JSON.stringify(await preview())); return; }
    if (command === 'status') { await status(); return; }
    const release = acquireQueueLock(directory);
    try {
        if (command === 'start') await start();
        else if (command === 'reconcile') await reconcile();
        else if (command === 'resume') await resume();
        else throw new Error('usage: rolling-controller <prepare|start|status|reconcile|resume>');
    } finally { release(); }
}
if (require.main === module) main().catch(error => { console.error(safeMessage(error)); process.exitCode = 1; });
