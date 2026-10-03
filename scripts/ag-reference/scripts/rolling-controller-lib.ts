import { Db } from 'mongodb';
export const ROLLING_WORKERS = 20;
export const ROLLING_TARGET = 300000;
export interface RollingGameState {
    gameId: string; dbName: string; campaignId: string; baseline: number;
    phase: 'pending' | 'provisioning' | 'ready' | 'merging' | 'merged' | 'complete' | 'blocked';
    username?: string; acceptedTotal?: number; reason?: string;
    preservedCollections?: string[];
}
export interface RollingState {
    version: 1; queueId: string; runId: number | null;
    phase: 'preparing' | 'dispatching' | 'running' | 'paused' | 'complete';
    games: RollingGameState[]; startedAt: string; publicSha: string;
}
export interface TaskRecord {
    _id: string; queueId: string; campaignId: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'blocked';
    owner?: string; exitCode?: number;
}
export function quotas(baseline: number): number[] {
    if (!Number.isSafeInteger(baseline) || baseline < 0 || baseline >= ROLLING_TARGET) {
        throw new Error('invalid rolling baseline');
    }
    const total = ROLLING_TARGET - baseline;
    return Array.from({ length: ROLLING_WORKERS }, (_, i) => Math.floor(total / ROLLING_WORKERS) + (i < total % ROLLING_WORKERS ? 1 : 0));
}
export function workerSummary(records: TaskRecord[], queueId: string, campaignId: string) {
    const workers = records.filter(r => /^worker:/.test(r._id));
    if (workers.length !== ROLLING_WORKERS || new Set(workers.map(r => r._id)).size !== ROLLING_WORKERS) throw new Error('incomplete rolling workers');
    const result = { pending: 0, running: 0, success: 0, failed: 0, blocked: 0 };
    for (let i = 1; i <= ROLLING_WORKERS; i++) {
        const row = workers.find(r => r._id === `worker:${i}`);
        if (!row || row.queueId !== queueId || row.campaignId !== campaignId || !Object.hasOwnProperty.call(result, row.status)) throw new Error('rolling worker identity mismatch');
        result[row.status]++;
    }
    return result;
}
export function mergeDecision(game: RollingGameState, records: TaskRecord[], queueId: string, counts: number[], liveLeases: number) {
    const summary = workerSummary(records, queueId, game.campaignId);
    if (summary.pending || summary.running || liveLeases) throw new Error('game still has active or pending workers');
    const limits = quotas(game.baseline);
    if (counts.length !== ROLLING_WORKERS) throw new Error('incomplete staging counts');
    const selected = counts.map((count, i) => {
        if (!Number.isSafeInteger(count) || count < 0 || count > limits[i] + 7) throw new Error('invalid staging quota');
        const task = records.find(r => r._id === `worker:${i + 1}`)!;
        if (task.status === 'success' && count < limits[i]) throw new Error('successful worker is below quota');
        return Math.min(count, limits[i]);
    });
    const total = game.baseline + selected.reduce((a, b) => a + b, 0);
    return { selected, total, acceptable: total === ROLLING_TARGET, summary };
}
export function canResetInterruptedTasks(workflowStatus: string, liveLeases: number): boolean {
    return workflowStatus === 'completed' && liveLeases === 0;
}

export function stagingName(game: RollingGameState, index: number, kind = 'worker') {
    return `simulate_gh_${game.dbName}_${game.campaignId}_${kind}_${index}`;
}

/** 重入前逐份比对同_id内容，避免 keepExisting 隐藏内容冲突。 */
export async function mergeSelectedRows(db: Db, game: RollingGameState, selected: number[], total: number) {
    const target = db.collection('simulate');
    const baseline = await target.countDocuments({ 'data.captureCampaignId': { $ne: game.campaignId } });
    if (baseline !== game.baseline) throw new Error('formal baseline changed before merge');
    for (let i = 1; i <= 20; i++) {
        const limit = selected[i - 1];
        if (!limit) continue;
        const conflicts = await db.collection(stagingName(game, i)).aggregate([
            { $sort: { _id: 1 } }, { $limit: limit }, { $replaceWith: { source: '$$ROOT' } },
            { $lookup: { from: 'simulate', localField: 'source._id', foreignField: '_id', as: 'existing' } },
            { $match: { 'existing.0': { $exists: true }, $or: [
                { 'existing.0.data.captureCampaignId': { $ne: game.campaignId } },
                { 'existing.0.data.captureWorkerIndex': { $ne: i } },
            ] } },
            { $limit: 1 }, { $project: { _id: '$source._id' } },
        ]).toArray();
        if (conflicts.length) throw new Error('same-id merge content conflict; staging retained');
    }
    for (let i = 1; i <= 20; i++) {
        if (!selected[i - 1]) continue;
        await db.collection(stagingName(game, i)).aggregate([
            { $sort: { _id: 1 } }, { $limit: selected[i - 1] },
            { $merge: { into: 'simulate', on: '_id', whenMatched: 'keepExisting', whenNotMatched: 'insert' } },
        ], { allowDiskUse: true }).toArray();
    }
    if (await target.countDocuments({}) !== total || await target.countDocuments({ 'data.captureCampaignId': game.campaignId }) !== total - baseline) throw new Error('merged count mismatch; staging retained');
}
