import fs from 'fs';
import path from 'path';
import { Collection, Db, Document, MongoClient } from 'mongodb';
import { MONGO_URI } from '../config';
import { mongoClientOptions } from '../src/ag.mongo';
import { AG_CAPTURE_SOURCE, AG_CAPTURE_VERSION } from '../src/ag.version';
import { loadGameTargets, resolveGameTarget } from './game-target';
import { capturePlatform,gameManifestPath,safeDatabaseName } from '../src/ag.platform';

export const TARGET_COLLECTION = 'simulate';
export const DEFAULT_TARGET_TOTAL = 300_000;
export const DEFAULT_WORKER_COUNT = 20;
export const MIN_BRANCH_SAMPLES = 100;

export function missingBranchSamples(counts: Record<number, number>, optionCount: number): number[] {
    if (!Number.isInteger(optionCount) || optionCount < 0 || optionCount > 100) {
        throw new Error('invalid option count for branch audit');
    }
    return Array.from({ length: optionCount }, (_, index) => index + 1)
        .filter(index => (counts[index] || 0) < MIN_BRANCH_SAMPLES);
}

function positiveInteger(value: unknown, label: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${label} must be a positive integer`);
    }
    return parsed;
}

export function normalizeRunId(value: unknown): string {
    const normalized = String(value || '').trim();
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(normalized)) {
        throw new Error('invalid campaign run id');
    }
    return normalized;
}

export function normalizeAgDatabaseName(value: unknown,platform=capturePlatform()): string {
    const normalized = String(value || '').trim();
    if (!safeDatabaseName(normalized,platform)) {
        throw new Error('invalid AG database name');
    }
    return normalized;
}

export function splitQuota(total: number, workers: number): number[] {
    if (!Number.isInteger(total) || total < 0) throw new Error('total must be a non-negative integer');
    const normalizedWorkers = positiveInteger(workers, 'workers');
    const base = Math.floor(total / normalizedWorkers);
    const remainder = total % normalizedWorkers;
    return Array.from(
        { length: normalizedWorkers },
        (_, index) => base + (index < remainder ? 1 : 0),
    );
}

export function stagingCollectionName(
    dbName: string,
    runId: string,
    workerIndex: number,
    kind: 'worker' | 'canary',
    platform=capturePlatform(),
): string {
    const normalizedDbName = normalizeAgDatabaseName(dbName,platform);
    const normalizedRunId = normalizeRunId(runId);
    const normalizedIndex = positiveInteger(workerIndex, 'worker index');
    return `simulate_gh_${normalizedDbName}_${normalizedRunId}_${kind}_${normalizedIndex}`;
}

export function buildWorkerMatrix(existing: number, target: number, workers: number) {
    if (!Number.isInteger(existing) || existing < 0) throw new Error('existing must be a non-negative integer');
    if (!Number.isInteger(target) || target < existing) {
        throw new Error(`target ${target} is below existing valid count ${existing}`);
    }
    return {
        include: splitQuota(target - existing, workers).map((quota, index) => ({
            index: index + 1,
            quota,
        })),
    };
}

export function validateStagingCounts(
    total: number,
    valid: number,
    expected: number,
    allowedOverage = 0,
): number {
    for (const [label, value] of Object.entries({ total, valid, expected, allowedOverage })) {
        if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
    }
    if (valid !== total) throw new Error(`staging contains ${total - valid} invalid documents`);
    const excess = total - expected;
    if (excess < 0 || excess > allowedOverage) {
        throw new Error(`staging expected=${expected} total=${total} allowedOverage=${allowedOverage}`);
    }
    return excess;
}

const validRtpFilter: Document = { 'rtp.0': { $exists: true } };

function expectedStagingFilter(campaignId: string, workerIndex: number): Document {
    return {
        ...validRtpFilter,
        'data.captureSource': AG_CAPTURE_SOURCE,
        'data.captureVersion': AG_CAPTURE_VERSION,
        'data.captureCampaignId': campaignId,
        'data.captureWorkerIndex': workerIndex,
    };
}

async function countTargetBaseline(collection: Collection): Promise<number> {
    // 正式库的旧 RTP 标签可能被外部业务客户端清空；补拉只核验新增份额，保留旧数据原状。
    return collection.countDocuments({});
}

async function assertStaging(
    collection: Collection,
    campaignId: string,
    workerIndex: number,
    expected: number,
    allowedOverage = 0,
): Promise<void> {
    const [total, valid] = await Promise.all([
        collection.countDocuments({}),
        collection.countDocuments(expectedStagingFilter(campaignId, workerIndex)),
    ]);
    const excess = validateStagingCounts(total, valid, expected, allowedOverage);
    if (excess > 0) {
        const extras = await collection
            .find({}, { projection: { _id: 1 } })
            .sort({ _id: -1 })
            .limit(excess)
            .toArray();
        const result = await collection.deleteMany({ _id: { $in: extras.map((row) => row._id) } });
        if (result.deletedCount !== excess) {
            throw new Error(`${collection.collectionName} failed to trim ${excess} excess documents`);
        }
    }
}

function appendGitHubOutput(name: string, value: string): void {
    const outputPath = String(process.env.GITHUB_OUTPUT || '').trim();
    if (outputPath) {
        fs.appendFileSync(outputPath, `${name}=${value}\n`, 'utf8');
    }
}

async function prepare(db: Db): Promise<void> {
    const target = positiveInteger(process.env.TARGET_TOTAL || DEFAULT_TARGET_TOTAL, 'TARGET_TOTAL');
    const workers = positiveInteger(process.env.WORKER_COUNT || DEFAULT_WORKER_COUNT, 'WORKER_COUNT');
    const existing = await countTargetBaseline(db.collection(TARGET_COLLECTION));
    const matrix = buildWorkerMatrix(existing, target, workers);
    const matrixJson = JSON.stringify(matrix);
    appendGitHubOutput('matrix', matrixJson);
    appendGitHubOutput('existing', String(existing));
    console.log(`[prepare] existing=${existing} target=${target} missing=${target - existing} workers=${workers}`);
    if (!process.env.GITHUB_OUTPUT) console.log(matrixJson);
}

async function verifyCanary(db: Db, dbName: string): Promise<void> {
    const runId = normalizeRunId(process.env.CAMPAIGN_RUN_ID);
    const workerIndex = positiveInteger(process.env.CAPTURE_WORKER_INDEX, 'CAPTURE_WORKER_INDEX');
    const expected = positiveInteger(process.env.CANARY_TARGET || 10, 'CANARY_TARGET');
    const collection = db.collection(stagingCollectionName(dbName, runId, workerIndex, 'canary'));
    await assertStaging(collection, `${runId}-canary`, workerIndex, expected);
    await collection.drop();
    console.log(`[canary] worker=${workerIndex} verified=${expected} collection-dropped=true`);
}

async function finalize(db: Db, dbName: string): Promise<void> {
    const runId = normalizeRunId(process.env.CAMPAIGN_RUN_ID);
    const target = positiveInteger(process.env.TARGET_TOTAL || DEFAULT_TARGET_TOTAL, 'TARGET_TOTAL');
    const workers = positiveInteger(process.env.WORKER_COUNT || DEFAULT_WORKER_COUNT, 'WORKER_COUNT');
    const allowedOverage = Number(process.env.STAGING_OVERAGE_LIMIT || 0);
    if (!Number.isInteger(allowedOverage) || allowedOverage < 0) {
        throw new Error('STAGING_OVERAGE_LIMIT must be a non-negative integer');
    }
    const expectedExisting = Number(process.env.EXPECTED_EXISTING);
    if (!Number.isInteger(expectedExisting) || expectedExisting < 0) {
        throw new Error('EXPECTED_EXISTING must be a non-negative integer');
    }

    const targetCollection = db.collection(TARGET_COLLECTION);
    await countTargetBaseline(targetCollection);
    const baseline = await targetCollection.countDocuments({
        'data.captureCampaignId': { $ne: runId },
    });
    if (baseline !== expectedExisting) {
        throw new Error(`target baseline changed: expected=${expectedExisting} actual=${baseline}`);
    }

    const quotas = splitQuota(target - expectedExisting, workers);
    for (let index = 1; index <= workers; index += 1) {
        const staging = db.collection(stagingCollectionName(dbName, runId, index, 'worker'));
        await assertStaging(staging, runId, index, quotas[index - 1], allowedOverage);
    }

    // 只有完整覆盖已发现的可选分支，才能把本轮专项样本合并进正式库。
    const formalOptionRows = await targetCollection.aggregate<{ _id: null; max: number }>([
        { $match: { 'data.freeChoiceOptionCount': { $gt: 1 } } },
        { $group: { _id: null, max: { $max: '$data.freeChoiceOptionCount' } } },
    ], { allowDiskUse: true }).toArray();
    let optionCount = Number(formalOptionRows[0]?.max || 0);
    const branchCounts: Record<number, number> = {};
    const formalChoices = await targetCollection.aggregate<{ _id: number; count: number }>([
        { $match: { 'data.captureVersion': AG_CAPTURE_VERSION, 'data.freeChoiceOptionIndex': { $gt: 0 } } },
        { $group: { _id: '$data.freeChoiceOptionIndex', count: { $sum: 1 } } },
    ], { allowDiskUse: true }).toArray();
    for (const row of formalChoices) branchCounts[Number(row._id)] = Number(row.count || 0);
    for (let index = 1; index <= workers; index += 1) {
        const staging = db.collection(stagingCollectionName(dbName, runId, index, 'worker'));
        const rows = await staging.aggregate<{ _id: number; count: number; max: number }>([
            { $match: expectedStagingFilter(runId, index) },
            { $match: { 'data.freeChoiceOptionIndex': { $gt: 0 } } },
            { $group: { _id: '$data.freeChoiceOptionIndex', count: { $sum: 1 }, max: { $max: '$data.freeChoiceOptionCount' } } },
        ], { allowDiskUse: true }).toArray();
        for (const row of rows) {
            const choice = Number(row._id);
            if (Number.isInteger(choice) && choice > 0) branchCounts[choice] = (branchCounts[choice] || 0) + Number(row.count || 0);
            optionCount = Math.max(optionCount, Number(row.max) || 0);
        }
    }
    if (optionCount > 1) {
        const missing = missingBranchSamples(branchCounts, optionCount);
        if (missing.length) throw new Error(`branch coverage incomplete: choices ${missing.join(',')} below ${MIN_BRANCH_SAMPLES} samples; staging retained`);
    }
    if (['ag_TripleSupremeXtremeGrandProsperity', 'ag_TripleSupremeXtremeHeartOfTheSea'].includes(dbName)) {
        const expectedActions = ['PICK_FREE_SPINS', 'PICK_GOLD_COIN', 'PICK'];
        const capturedActions = new Set<string>();
        for (let index = 1; index <= workers; index += 1) {
            const staging = db.collection(stagingCollectionName(dbName, runId, index, 'worker'));
            const actions = await staging.distinct('data.roundTrigger.NextActionInfo.nextAction', expectedStagingFilter(runId, index));
            for (const action of actions) capturedActions.add(String(action));
        }
        const missing = expectedActions.filter(action => !capturedActions.has(action));
        if (missing.length) throw new Error(`Triple Supreme free-type coverage incomplete: ${missing.join(',')} missing; staging retained`);
    }

    for (let index = 1; index <= workers; index += 1) {
        const staging = db.collection(stagingCollectionName(dbName, runId, index, 'worker'));
        await staging.aggregate([
            { $match: expectedStagingFilter(runId, index) },
            {
                $merge: {
                    into: TARGET_COLLECTION,
                    on: '_id',
                    whenMatched: 'keepExisting',
                    whenNotMatched: 'insert',
                },
            },
        ], { allowDiskUse: true }).toArray();
    }

    const [finalTotal, campaignTotal] = await Promise.all([
        targetCollection.countDocuments({}),
        targetCollection.countDocuments({ 'data.captureCampaignId': runId }),
    ]);
    if (finalTotal !== target || campaignTotal !== target - expectedExisting) {
        throw new Error(`final count mismatch: total=${finalTotal} campaign=${campaignTotal} target=${target}`);
    }

    for (let index = 1; index <= workers; index += 1) {
        await db.collection(stagingCollectionName(dbName, runId, index, 'worker')).drop();
    }
    console.log(`[finalize] total=${finalTotal} campaign=${campaignTotal} staging-dropped=${workers}`);
}

async function main(): Promise<void> {
    const mode = String(process.argv[2] || process.env.MODE || '').trim();
    const manifestPath = gameManifestPath();
    const targetGame = resolveGameTarget(
        loadGameTargets(manifestPath),
        String(process.env.TARGET_GAME_ID || '').trim(),
        String(process.env.TARGET_DB || '').trim(),
    );
    const targetDbName = normalizeAgDatabaseName(targetGame.dbName);
    if (mode === 'validate-target') {
        console.log(`[target] game=${targetGame.gameId} database=${targetDbName}`);
        return;
    }
    if (!MONGO_URI) throw new Error('MONGO_URI is required');
    const client = new MongoClient(MONGO_URI, mongoClientOptions());
    await client.connect();
    try {
        const db = client.db(targetDbName);
        if (mode === 'prepare') await prepare(db);
        else if (mode === 'verify-canary') await verifyCanary(db, targetDbName);
        else if (mode === 'finalize') await finalize(db, targetDbName);
        else throw new Error(`unsupported campaign mode: ${mode}`);
    } finally {
        await client.close();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    });
}
