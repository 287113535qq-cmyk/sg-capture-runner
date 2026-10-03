// Generated from the unchanged AG source snapshot. Run node scripts/build-ag-rolling-core.mjs --check.
function positiveInteger(value, label) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${label} must be a positive integer`);
    }
    return parsed;
}
export function normalizeRunId(value) {
    const normalized = String(value || '').trim();
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(normalized)) {
        throw new Error('invalid campaign run id');
    }
    return normalized;
}
export function normalizeAgDatabaseName(value) {
    const normalized = String(value || '').trim();
    if (!/^ag_[A-Za-z0-9]+$/.test(normalized)) {
        throw new Error('invalid AG database name');
    }
    return normalized;
}
export function splitQuota(total, workers) {
    if (!Number.isInteger(total) || total < 0)
        throw new Error('total must be a non-negative integer');
    const normalizedWorkers = positiveInteger(workers, 'workers');
    const base = Math.floor(total / normalizedWorkers);
    const remainder = total % normalizedWorkers;
    return Array.from({ length: normalizedWorkers }, (_, index) => base + (index < remainder ? 1 : 0));
}
export function stagingCollectionName(dbName, runId, workerIndex, kind) {
    const normalizedDbName = normalizeAgDatabaseName(dbName);
    const normalizedRunId = normalizeRunId(runId);
    const normalizedIndex = positiveInteger(workerIndex, 'worker index');
    return `simulate_gh_${normalizedDbName}_${normalizedRunId}_${kind}_${normalizedIndex}`;
}
export function validateStagingCounts(total, valid, expected, allowedOverage = 0) {
    for (const [label, value] of Object.entries({ total, valid, expected, allowedOverage })) {
        if (!Number.isInteger(value) || value < 0)
            throw new Error(`${label} must be a non-negative integer`);
    }
    if (valid !== total)
        throw new Error(`staging contains ${total - valid} invalid documents`);
    const excess = total - expected;
    if (excess < 0 || excess > allowedOverage) {
        throw new Error(`staging expected=${expected} total=${total} allowedOverage=${allowedOverage}`);
    }
    return excess;
}
const SAFE_AG_DATABASE = /^ag_[A-Za-z0-9]+$/;
export function resolveGameTarget(games, gameId, dbName) {
    const game = games.find((item) => item.gameId === gameId);
    if (!game)
        throw new Error('unknown game id');
    if (!SAFE_AG_DATABASE.test(game.dbName) || !SAFE_AG_DATABASE.test(dbName)) {
        throw new Error('unsafe AG database name');
    }
    if (game.dbName !== dbName)
        throw new Error('database mismatch');
    return game;
}
export const LANES = 20;
export const TARGET = 300_000;
const safeId = /^[A-Za-z0-9._-]{1,100}$/;
export function taskId(kind, index) {
    if (!['worker', 'canary'].includes(kind) || !Number.isInteger(index)
        || index < 1 || index > (kind === 'worker' ? LANES : 2))
        throw new Error('invalid rolling task');
    return `${kind}:${index}`;
}
export function validateRollingPayload(value, manifest) {
    const payload = value;
    if (payload?.version !== 1 || typeof payload.queueId !== 'string' || !safeId.test(payload.queueId)
        || !Array.isArray(payload.games) || !payload.games.length || payload.games.length > manifest.length) {
        throw new Error('invalid rolling payload');
    }
    const ids = new Set();
    const databases = new Set();
    const campaigns = new Set();
    for (const game of payload.games) {
        if (!game || typeof game.gameId !== 'string' || typeof game.dbName !== 'string'
            || typeof game.campaignId !== 'string' || !safeId.test(game.campaignId)
            || !Number.isInteger(game.baseline) || game.baseline < 0 || game.baseline >= TARGET
            || typeof game.mongoUri !== 'string')
            throw new Error('invalid rolling game');
        resolveGameTarget(manifest, game.gameId, game.dbName);
        if (ids.has(game.gameId) || databases.has(game.dbName) || campaigns.has(game.campaignId)) {
            throw new Error('duplicate rolling game or campaign');
        }
        ids.add(game.gameId);
        databases.add(game.dbName);
        campaigns.add(game.campaignId);
        // 不在验证异常中输出原 URI；凭据必须只授权对应游戏库。
        try {
            const uri = new URL(game.mongoUri);
            const authSources = [...uri.searchParams].filter(([key]) => key.toLowerCase() === 'authsource');
            if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol)
                || !/^agcap_[A-Za-z0-9_-]+$/.test(decodeURIComponent(uri.username)) || !uri.password
                || !uri.hostname || uri.hash || decodeURIComponent(uri.pathname) !== `/${game.dbName}`
                || authSources.length !== 1 || authSources[0][0] !== 'authSource'
                || authSources[0][1] !== game.dbName)
                throw new Error();
        }
        catch {
            throw new Error('invalid scoped Mongo credential');
        }
    }
    return payload;
}
export const LANE_BUDGET_MINUTES = 340;
export const LANE_BUDGET_MS = LANE_BUDGET_MINUTES * 60_000;
export function childEnvironment(game, kind, index, quota, owner, inherited = process.env) {
    // 仅继承运行时环境，禁止把整个队列 Secret、旧采集参数或其他游戏凭据传入子进程。
    const env = {};
    for (const key of ['PATH', 'Path', 'HOME', 'USERPROFILE', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'CI']) {
        if (inherited[key] !== undefined)
            env[key] = inherited[key];
    }
    return { ...env, MONGO_URI: game.mongoUri, ONLY_GAME: game.gameId, TEST_RTP: '1',
        FREE_CHOICE_PER_OPTION: '0', SPIN_DELAY_MS: '200', RETRY_ATTEMPTS: '5', RETRY_DELAY_MS: '2000',
        LOG_INTERVAL: '250', CAPTURE_CAMPAIGN_ID: `${game.campaignId}${kind === 'canary' ? '-canary' : ''}`,
        CAPTURE_WORKER_INDEX: String(index), CAPTURE_OWNER_ID: owner,
        CAPTURE_LEASE_ID: `gh_${game.campaignId}_${kind}_${index}`,
        AG_SIMULATE_COLLECTION: stagingCollectionName(game.dbName, game.campaignId, index, kind),
        SPIN_LIMIT: String(quota), CONCURRENT_PER_GAME: kind === 'canary' ? '1' : '8' };
}
export async function runLane(payload, lane, runId, deps) {
    taskId('worker', lane);
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(runId))
        throw new Error('invalid workflow run id');
    const deadline = deps.now() + LANE_BUDGET_MS;
    let healthy = true;
    for (const game of payload.games) {
        if (deps.now() >= deadline)
            break;
        let store;
        const worker = taskId('worker', lane);
        const owner = (kind, index) => `${runId}:${lane}:${kind}:${index}`;
        const execute = async (kind, index, quota) => {
            let code = 1;
            try {
                code = await deps.run(game, kind, index, quota, owner(kind, index));
                if (code === 0)
                    await store.verify(kind, index, quota);
            }
            catch {
                code = 1;
            }
            await store.finish(taskId(kind, index), owner(kind, index), code === 0 ? 'success' : 'failed', code);
            deps.log(`game=${game.gameId} lane=${lane} task=${kind}:${index} exit=${code}`);
        };
        try {
            store = await deps.connect(game, payload.queueId);
            if ((await store.read(worker)).status !== 'pending')
                continue;
            let ready = false;
            while (deps.now() < deadline) {
                const records = await Promise.all([store.read('canary:1'), store.read('canary:2')]);
                if (records.some((r) => r.status === 'failed' || r.status === 'blocked'))
                    break;
                if (records.every((r) => r.status === 'success')) {
                    ready = true;
                    break;
                }
                let claimed = false;
                for (let index = 1; index <= 2; index++) {
                    if (records[index - 1].status === 'pending'
                        && await store.claim(taskId('canary', index), owner('canary', index))) {
                        await execute('canary', index, 10);
                        claimed = true;
                        break;
                    }
                }
                if (!claimed)
                    await deps.pause();
            }
            if (deps.now() >= deadline)
                break;
            if (!await store.claim(worker, owner('worker', lane)))
                continue;
            if (!ready)
                await store.finish(worker, owner('worker', lane), 'blocked', 1);
            else
                await execute('worker', lane, splitQuota(TARGET - game.baseline, LANES)[lane - 1]);
        }
        catch {
            // Mongo 写入结果不确定时不猜测终态；控制器等待 job 结束及租约消失后处理。
            healthy = false;
            deps.log(`game=${game.gameId} lane=${lane} storage-error; task state requires controller review`);
        }
        finally {
            try {
                await store?.close();
            }
            catch {
                healthy = false;
                deps.log(`game=${game.gameId} lane=${lane} storage-close-error`);
            }
        }
    }
    return healthy;
}
export function sanitizeOutput(value) {
    return value.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[REDACTED_MONGO_URI]');
}
export const ROLLING_WORKERS = 20;
export const ROLLING_TARGET = 300000;
export function quotas(baseline) {
    if (!Number.isSafeInteger(baseline) || baseline < 0 || baseline >= ROLLING_TARGET) {
        throw new Error('invalid rolling baseline');
    }
    const total = ROLLING_TARGET - baseline;
    return Array.from({ length: ROLLING_WORKERS }, (_, i) => Math.floor(total / ROLLING_WORKERS) + (i < total % ROLLING_WORKERS ? 1 : 0));
}
export function workerSummary(records, queueId, campaignId) {
    const workers = records.filter(r => /^worker:/.test(r._id));
    if (workers.length !== ROLLING_WORKERS || new Set(workers.map(r => r._id)).size !== ROLLING_WORKERS)
        throw new Error('incomplete rolling workers');
    const result = { pending: 0, running: 0, success: 0, failed: 0, blocked: 0 };
    for (let i = 1; i <= ROLLING_WORKERS; i++) {
        const row = workers.find(r => r._id === `worker:${i}`);
        if (!row || row.queueId !== queueId || row.campaignId !== campaignId || !Object.hasOwnProperty.call(result, row.status))
            throw new Error('rolling worker identity mismatch');
        result[row.status]++;
    }
    return result;
}
export function mergeDecision(game, records, queueId, counts, liveLeases) {
    const summary = workerSummary(records, queueId, game.campaignId);
    if (summary.pending || summary.running || liveLeases)
        throw new Error('game still has active or pending workers');
    const limits = quotas(game.baseline);
    if (counts.length !== ROLLING_WORKERS)
        throw new Error('incomplete staging counts');
    const selected = counts.map((count, i) => {
        if (!Number.isSafeInteger(count) || count < 0 || count > limits[i] + 7)
            throw new Error('invalid staging quota');
        const task = records.find(r => r._id === `worker:${i + 1}`);
        if (task.status === 'success' && count < limits[i])
            throw new Error('successful worker is below quota');
        return Math.min(count, limits[i]);
    });
    const total = game.baseline + selected.reduce((a, b) => a + b, 0);
    return { selected, total, acceptable: total === ROLLING_TARGET, summary };
}
export function canResetInterruptedTasks(workflowStatus, liveLeases) {
    return workflowStatus === 'completed' && liveLeases === 0;
}
export function stagingName(game, index, kind = 'worker') {
    return `simulate_gh_${game.dbName}_${game.campaignId}_${kind}_${index}`;
}
