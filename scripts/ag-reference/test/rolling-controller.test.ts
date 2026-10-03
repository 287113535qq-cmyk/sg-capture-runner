import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquireQueueLock } from '../scripts/public-controller';
import { isPreservedCollection } from '../scripts/rolling-controller';
import { quotas, mergeDecision, workerSummary, canResetInterruptedTasks, mergeSelectedRows, stagingName, RollingGameState, TaskRecord } from '../scripts/rolling-controller-lib';
const game: RollingGameState = { gameId: 'play-test', dbName: 'ag_Test', campaignId: 'ag_Test-queue', baseline: 3, phase: 'ready' };
const tasks = (): TaskRecord[] => Array.from({ length: 20 }, (_, i) => ({ _id: `worker:${i + 1}`, queueId: 'queue', campaignId: game.campaignId, status: 'success' }));
test('only Coin Trio preserves its business display state collection', () => {
    assert.equal(isPreservedCollection('play-coin-trio-fortune-trails', 'display_state'), true);
    assert.equal(isPreservedCollection('play-other', 'display_state'), false);
    assert.equal(isPreservedCollection('play-other', 'simulate_backup_20260922'), true);
});
test('20 successful workers reach exact target', () => {
    const result = mergeDecision(game, tasks(), 'queue', quotas(3), 0);
    assert.equal(result.total, 300000); assert.equal(result.acceptable, true);
});
test('another game can be running while this game independently merges', () => {
    const other = tasks().map(t => ({ ...t, campaignId: 'other', status: 'running' as const }));
    assert.equal(workerSummary(other, 'queue', 'other').running, 20);
    assert.equal(mergeDecision(game, tasks(), 'queue', quotas(3), 0).acceptable, true);
});
test('live worker or lease blocks merge even when enough data exists', () => {
    const rows = tasks(); rows[19].status = 'running';
    assert.throws(() => mergeDecision(game, rows, 'queue', quotas(3), 0), /active/);
    assert.throws(() => mergeDecision(game, tasks(), 'queue', quotas(3), 1), /active/);
});
test('failed shard data is retained but only the exact target is acceptable', () => {
    const rows = tasks(); rows[19].status = 'failed';
    const counts = quotas(3); counts[19] = 2000;
    const partial = mergeDecision(game, rows, 'queue', counts, 0);
    assert.equal(partial.total, 287001); assert.equal(partial.acceptable, false);
    rows[18].status = 'failed'; rows[17].status = 'failed'; counts[18] = counts[17] = 0;
    assert.equal(mergeDecision(game, rows, 'queue', counts, 0).acceptable, false);
});
test('any baseline below 300000 receives an exact top-up quota', () => {
    assert.equal(quotas(299999).reduce((sum, value) => sum + value, 0), 1);
    assert.throws(() => quotas(300000), /baseline/);
});
test('mixed campaign, duplicate workers, false success, overage fail closed', () => {
    const rows = tasks(); rows[0].campaignId = 'wrong';
    assert.throws(() => mergeDecision(game, rows, 'queue', quotas(3), 0), /identity/);
    const duplicate = tasks(); duplicate[19] = duplicate[0];
    assert.throws(() => workerSummary(duplicate, 'queue', game.campaignId), /incomplete/);
    const counts = quotas(3); counts[0]--;
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
    const target = new Map<string, any>(baseline.map(row => [row._id, row]));
    const source = new Map(Array.from({ length: 20 }, (_, i) => [stagingName(game, i + 1), [{ _id: `new-${i}`, rtp: [0], data: { captureCampaignId: game.campaignId, captureWorkerIndex: i + 1, value: i } }]]));
    let mergeCalls = 0; let failAt = 0;
    const db: any = { collection(name: string) {
        if (name === 'simulate') return { async countDocuments(filter: any) {
            return [...target.values()].filter(row => {
                if (filter['rtp.0']) return !row.rtp?.length;
                const campaign = filter['data.captureCampaignId'];
                return !campaign || (typeof campaign === 'string' ? row.data.captureCampaignId === campaign : row.data.captureCampaignId !== campaign.$ne);
            }).length;
        } };
        return { aggregate(pipeline: any[]) { return { async toArray() {
            const rows = source.get(name)!;
            if (pipeline.some(p => p.$lookup)) return rows.filter(r => target.has(r._id)
                && (target.get(r._id).data.captureCampaignId !== game.campaignId
                    || target.get(r._id).data.captureWorkerIndex !== Number(name.match(/_(\d+)$/)?.[1])));
            mergeCalls++;
            if (mergeCalls === failAt) throw new Error('injected merge interruption');
            for (const row of rows) if (!target.has(row._id)) target.set(row._id, structuredClone(row));
            return [];
        } }; } };
    } };
    return { db, target, source, interruptAt: (n: number) => { failAt = n; }, calls: () => mergeCalls };
}
test('interrupted partial merge re-enters without duplicate rows or dropping staging', async () => {
    const fixture = mergeFixture(); fixture.interruptAt(6);
    await assert.rejects(mergeSelectedRows(fixture.db, game, Array(20).fill(1), 23), /interruption/);
    assert.equal(fixture.target.size, 8); assert.equal(fixture.source.size, 20);
    fixture.interruptAt(0);
    await mergeSelectedRows(fixture.db, game, Array(20).fill(1), 23);
    assert.equal(fixture.target.size, 23); assert.equal(fixture.source.size, 20);
    await mergeSelectedRows(fixture.db, game, Array(20).fill(1), 23);
    assert.equal(fixture.target.size, 23);
});
test('business-cleared RTP tags on historical rows do not block validated staging merge', async () => {
    const fixture = mergeFixture();
    fixture.target.get('old-0').rtp = [];
    await mergeSelectedRows(fixture.db, game, Array(20).fill(1), 23);
    assert.equal(fixture.target.size, 23);
});
test('same-campaign rows tolerate business mutation while unrelated same-id collision still blocks', async () => {
    const fixture = mergeFixture(); fixture.interruptAt(2);
    await assert.rejects(mergeSelectedRows(fixture.db, game, Array(20).fill(1), 23));
    fixture.target.get('new-0').data.value = 999;
    fixture.interruptAt(0);
    await mergeSelectedRows(fixture.db, game, Array(20).fill(1), 23);
    const collision = mergeFixture();
    collision.target.delete('old-0');
    collision.target.set('new-0', {...structuredClone(collision.source.get(stagingName(game, 1))![0]), data:{captureCampaignId:'other'}});
    await assert.rejects(mergeSelectedRows(collision.db, game, Array(20).fill(1), 23), /content conflict/);
    assert.equal(collision.source.size, 20);
});
test('single-game and rolling commands use exclusive shared lock', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-queue-lock-'));
    const release = acquireQueueLock(directory);
    try { assert.throws(() => acquireQueueLock(directory), /EEXIST/); }
    finally { release(); }
    const secondRelease = acquireQueueLock(directory); secondRelease();
    fs.rmdirSync(directory);
});
