// Generated from the unchanged AG source snapshot. Run node scripts/build-ag-rolling-core.mjs --check.
import assert from 'node:assert/strict';import test from 'node:test';
import {taskId,validateRollingPayload,childEnvironment,runLane,LANE_BUDGET_MINUTES,sanitizeOutput,
 quotas,mergeDecision,workerSummary,canResetInterruptedTasks,stagingName} from './ag-core.mjs';
{
    const game = (id) => ({ gameId: id, dbName: `ag_${id}`, campaignId: `campaign-${id}`,
        baseline: 200000, mongoUri: ['mongodb://', 'agcap_fixture', ':', 'fixture', '@localhost/', `ag_${id}?authSource=ag_${id}`].join('') });
    const payload = { version: 1, queueId: 'queue-test', games: [game('A'), game('B')] };
    const manifest = payload.games.map((g) => ({ ...g, name: g.gameId, serviceDir: g.gameId }));
    test('payload rejects wrong bindings, credentials, duplicates and unsafe baselines', () => {
        assert.equal(validateRollingPayload(payload, manifest), payload);
        for (const mutate of [
            (p) => { p.games[0].dbName = 'ag_B'; },
            (p) => { p.games[0].mongoUri = p.games[0].mongoUri.replace('authSource=ag_A', 'authSource=admin'); },
            (p) => { p.games[0].mongoUri = p.games[0].mongoUri.replace('agcap_fixture', 'admin'); },
            (p) => { p.games[0].baseline = 300000; },
            (p) => { p.games.push(p.games[0]); },
            (p) => { p.queueId = '../unsafe'; },
        ]) {
            const copy = JSON.parse(JSON.stringify(payload));
            mutate(copy);
            assert.throws(() => validateRollingPayload(copy, manifest));
        }
        const nearTarget = JSON.parse(JSON.stringify(payload));
        nearTarget.games[0].baseline = 299999;
        assert.equal(validateRollingPayload(nearTarget, manifest).games[0].baseline, 299999);
        assert.throws(() => taskId('worker', 21));
        assert.throws(() => taskId('canary', 3));
    });
    test('child environment contains only current credential and fixed capture limits', () => {
        const env = childEnvironment(game('A'), 'worker', 2, 5000, 'run:2:worker:2', {
            PATH: 'runtime', AG_ROLLING_PAYLOAD: JSON.stringify(payload), MONGO_URI: 'old', CAPTURE_CLEAR: '1',
            NODE_OPTIONS: '--bad', SPIN_LIMIT: '999', TOKEN: 'other-game',
        });
        assert.equal(env.MONGO_URI, game('A').mongoUri);
        assert.equal(env.CONCURRENT_PER_GAME, '8');
        assert.equal(env.SPIN_LIMIT, '5000');
        for (const key of ['AG_ROLLING_PAYLOAD', 'CAPTURE_CLEAR', 'NODE_OPTIONS', 'TOKEN'])
            assert.equal(env[key], undefined);
        const canary = childEnvironment(game('A'), 'canary', 1, 10, 'owner', {});
        assert.equal(canary.CAPTURE_CAMPAIGN_ID, 'campaign-A-canary');
        assert.equal(canary.AG_SIMULATE_COLLECTION, 'simulate_gh_ag_A_campaign-A_canary_1');
        assert.equal(canary.CONCURRENT_PER_GAME, '1');
        assert.equal(sanitizeOutput(`error ${game('A').mongoUri}`), 'error [REDACTED_MONGO_URI]');
    });
    function stores(canaries = 'success') {
        const all = new Map();
        for (const g of payload.games) {
            const rows = new Map();
            for (let i = 1; i <= 20; i++)
                rows.set(`worker:${i}`, { _id: `worker:${i}`, status: 'pending' });
            for (let i = 1; i <= 2; i++)
                rows.set(`canary:${i}`, { _id: `canary:${i}`, status: canaries });
            all.set(g.gameId, rows);
        }
        const connect = async (g) => {
            const rows = all.get(g.gameId);
            return {
                read: async (id) => ({ ...rows.get(id) }),
                claim: async (id, owner) => {
                    const row = rows.get(id);
                    if (row.status !== 'pending')
                        return false;
                    row.status = 'running';
                    row.owner = owner;
                    return true;
                },
                finish: async (id, owner, status) => {
                    const row = rows.get(id);
                    assert.equal(row.owner, owner);
                    assert.equal(row.status, 'running');
                    row.status = status;
                },
                verify: async () => { }, close: async () => { },
            };
        };
        return { all, connect };
    }
    const pause = () => new Promise((resolve) => setImmediate(resolve));
    test('fast lane enters B while slow lane still runs A; failed shard continues to B', async () => {
        const { all, connect } = stores();
        let release;
        const slow = new Promise((resolve) => { release = resolve; });
        const observed = [];
        const deps = { connect, now: () => 0, pause, log: () => { },
            run: async (g, kind, index) => {
                observed.push(`${g.gameId}:${index}`);
                if (g.gameId === 'A' && index === 1)
                    await slow;
                if (g.gameId === 'B' && index === 2) {
                    assert.equal(all.get('A').get('worker:1').status, 'running');
                    release();
                }
                return g.gameId === 'A' && index === 2 ? 78 : 0;
            } };
        await Promise.all([runLane(payload, 1, 'run', deps), runLane(payload, 2, 'run', deps)]);
        assert.equal(all.get('A').get('worker:2').status, 'failed');
        assert.equal(all.get('B').get('worker:2').status, 'success');
        assert.ok(observed.indexOf('B:2') < observed.indexOf('B:1'));
    });
    test('twenty lanes atomically share exactly two canaries per game before workers', async () => {
        const { all, connect } = stores('pending');
        const calls = new Map();
        const active = new Set();
        await Promise.all(Array.from({ length: 20 }, (_, n) => runLane(payload, n + 1, 'run', {
            connect, now: () => 0, pause, log: () => { },
            run: async (g, kind, index, quota, owner) => {
                const lane = Number(owner.split(':')[1]);
                assert.ok(!active.has(lane));
                active.add(lane);
                const key = `${g.gameId}:${kind}:${index}`;
                calls.set(key, (calls.get(key) || 0) + 1);
                if (kind === 'worker')
                    for (const i of [1, 2])
                        assert.equal(all.get(g.gameId).get(`canary:${i}`).status, 'success');
                else
                    assert.equal(quota, 10);
                await pause();
                active.delete(lane);
                return 0;
            },
        })));
        assert.equal(calls.size, 44);
        for (const count of calls.values())
            assert.equal(count, 1);
    });
    test('failed canary blocks formal shards while lanes continue to next game', async () => {
        const { all, connect } = stores('pending');
        await Promise.all([1, 2, 3].map((lane) => runLane(payload, lane, 'run', {
            connect, now: () => 0, pause, log: () => { }, run: async (g, kind) => {
                if (g.gameId === 'A') {
                    assert.equal(kind, 'canary');
                    return 78;
                }
                return 0;
            },
        })));
        for (const lane of [1, 2, 3]) {
            assert.equal(all.get('A').get(`worker:${lane}`).status, 'blocked');
            assert.equal(all.get('B').get(`worker:${lane}`).status, 'success');
        }
    });
    test('soft cutoff leaves next game pending and never steals a running shard', async () => {
        const { all, connect } = stores();
        let now = 0;
        await runLane(payload, 1, 'run', { connect, now: () => now, pause, log: () => { },
            run: async () => { now = (LANE_BUDGET_MINUTES + 1) * 60_000; return 0; } });
        assert.equal(all.get('B').get('worker:1').status, 'pending');
        all.get('A').get('worker:2').status = 'running';
        await runLane({ ...payload, games: [game('A')] }, 2, 'run', { connect, now: () => 0, pause, log: () => { },
            run: async () => { assert.fail('running shard was stolen'); } });
    });
    test('connection failure is isolated and produces failed lane outcome after B', async () => {
        const { all, connect } = stores();
        const logs = [];
        const healthy = await runLane(payload, 1, 'run', {
            connect: async (g) => { if (g.gameId === 'A')
                throw new Error(game('A').mongoUri); return connect(g); },
            now: () => 0, pause, log: (line) => logs.push(line), run: async () => 0,
        });
        assert.equal(healthy, false);
        assert.equal(all.get('A').get('worker:1').status, 'pending');
        assert.equal(all.get('B').get('worker:1').status, 'success');
        assert.ok(logs.every((line) => !line.includes('mongodb')));
    });
    test('verification failure marks failed and advances without retry', async () => {
        const { all, connect } = stores();
        const calls = [];
        await runLane(payload, 1, 'run', {
            connect: async (g) => ({ ...await connect(g), verify: async () => { if (g.gameId === 'A')
                    throw new Error('invalid staging'); } }),
            now: () => 0, pause, log: () => { }, run: async (g) => { calls.push(g.gameId); return 0; },
        });
        assert.deepEqual(calls, ['A', 'B']);
        assert.equal(all.get('A').get('worker:1').status, 'failed');
        assert.equal(all.get('B').get('worker:1').status, 'success');
    });
    test('uncertain terminal write retains running until controller resolves and B still runs', async () => {
        const { all, connect } = stores();
        let childActive = false;
        const healthy = await runLane(payload, 1, 'run', {
            connect: async (g) => {
                const store = await connect(g);
                return { ...store, finish: async (...args) => {
                        assert.equal(childActive, false);
                        if (g.gameId === 'A')
                            throw new Error('write uncertain');
                        await store.finish(...args);
                    }, close: async () => { if (g.gameId === 'A')
                        throw new Error('close failed'); } };
            },
            now: () => 0, pause, log: () => { }, run: async () => { childActive = true; await pause(); childActive = false; return 0; },
        });
        assert.equal(healthy, false);
        assert.equal(all.get('A').get('worker:1').status, 'running');
        assert.equal(all.get('B').get('worker:1').status, 'success');
    });
    test('cutoff while waiting for canary preserves all unstarted tasks', async () => {
        const { all, connect } = stores('running');
        let now = 0;
        let calls = 0;
        await runLane(payload, 1, 'run', { connect, now: () => now,
            pause: async () => { now = LANE_BUDGET_MINUTES * 60_000; }, log: () => { }, run: async () => { calls++; return 0; } });
        assert.equal(calls, 0);
        for (const id of ['A', 'B'])
            assert.equal(all.get(id).get('worker:1').status, 'pending');
    });
}
{
    const game = { gameId: 'play-test', dbName: 'ag_Test', campaignId: 'ag_Test-queue', baseline: 3, phase: 'ready' };
    const tasks = () => Array.from({ length: 20 }, (_, i) => ({ _id: `worker:${i + 1}`, queueId: 'queue', campaignId: game.campaignId, status: 'success' }));
    test('20 successful workers reach exact target', () => {
        const result = mergeDecision(game, tasks(), 'queue', quotas(3), 0);
        assert.equal(result.total, 300000);
        assert.equal(result.acceptable, true);
    });
    test('another game can be running while this game independently merges', () => {
        const other = tasks().map(t => ({ ...t, campaignId: 'other', status: 'running' }));
        assert.equal(workerSummary(other, 'queue', 'other').running, 20);
        assert.equal(mergeDecision(game, tasks(), 'queue', quotas(3), 0).acceptable, true);
    });
    test('live worker or lease blocks merge even when enough data exists', () => {
        const rows = tasks();
        rows[19].status = 'running';
        assert.throws(() => mergeDecision(game, rows, 'queue', quotas(3), 0), /active/);
        assert.throws(() => mergeDecision(game, tasks(), 'queue', quotas(3), 1), /active/);
    });
    test('failed shard data is retained but only the exact target is acceptable', () => {
        const rows = tasks();
        rows[19].status = 'failed';
        const counts = quotas(3);
        counts[19] = 2000;
        const partial = mergeDecision(game, rows, 'queue', counts, 0);
        assert.equal(partial.total, 287001);
        assert.equal(partial.acceptable, false);
        rows[18].status = 'failed';
        rows[17].status = 'failed';
        counts[18] = counts[17] = 0;
        assert.equal(mergeDecision(game, rows, 'queue', counts, 0).acceptable, false);
    });
    test('any baseline below 300000 receives an exact top-up quota', () => {
        assert.equal(quotas(299999).reduce((sum, value) => sum + value, 0), 1);
        assert.throws(() => quotas(300000), /baseline/);
    });
    test('mixed campaign, duplicate workers, false success, overage fail closed', () => {
        const rows = tasks();
        rows[0].campaignId = 'wrong';
        assert.throws(() => mergeDecision(game, rows, 'queue', quotas(3), 0), /identity/);
        const duplicate = tasks();
        duplicate[19] = duplicate[0];
        assert.throws(() => workerSummary(duplicate, 'queue', game.campaignId), /incomplete/);
        const counts = quotas(3);
        counts[0]--;
        assert.throws(() => mergeDecision(game, tasks(), 'queue', counts, 0), /below/);
        counts[0] += 9;
        assert.throws(() => mergeDecision(game, tasks(), 'queue', counts, 0), /quota/);
    });
    test('only ended workflow without live leases permits resetting interrupted running task', () => {
        assert.equal(canResetInterruptedTasks('in_progress', 0), false);
        assert.equal(canResetInterruptedTasks('completed', 1), false);
        assert.equal(canResetInterruptedTasks('completed', 0), true);
    });
    function mergeFixture() {
        const baseline = Array.from({ length: 3 }, (_, i) => ({ _id: `old-${i}`, rtp: [0], data: { captureCampaignId: 'old' } }));
        const target = new Map(baseline.map(row => [row._id, row]));
        const source = new Map(Array.from({ length: 20 }, (_, i) => [stagingName(game, i + 1), [{ _id: `new-${i}`, rtp: [0], data: { captureCampaignId: game.campaignId, captureWorkerIndex: i + 1, value: i } }]]));
        let mergeCalls = 0;
        let failAt = 0;
        const db = { collection(name) {
                if (name === 'simulate')
                    return { async countDocuments(filter) {
                            return [...target.values()].filter(row => {
                                if (filter['rtp.0'])
                                    return !row.rtp?.length;
                                const campaign = filter['data.captureCampaignId'];
                                return !campaign || (typeof campaign === 'string' ? row.data.captureCampaignId === campaign : row.data.captureCampaignId !== campaign.$ne);
                            }).length;
                        } };
                return { aggregate(pipeline) {
                        return { async toArray() {
                                const rows = source.get(name);
                                if (pipeline.some(p => p.$lookup))
                                    return rows.filter(r => target.has(r._id)
                                        && (target.get(r._id).data.captureCampaignId !== game.campaignId
                                            || target.get(r._id).data.captureWorkerIndex !== Number(name.match(/_(\d+)$/)?.[1])));
                                mergeCalls++;
                                if (mergeCalls === failAt)
                                    throw new Error('injected merge interruption');
                                for (const row of rows)
                                    if (!target.has(row._id))
                                        target.set(row._id, structuredClone(row));
                                return [];
                            } };
                    } };
            } };
        return { db, target, source, interruptAt: (n) => { failAt = n; }, calls: () => mergeCalls };
    }
}
