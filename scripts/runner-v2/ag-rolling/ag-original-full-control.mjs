import { workerSummary, mergeDecision, canResetInterruptedTasks } from './ag-core.mjs';
export function createOriginalAgFullControl(dependencies) {
    const { fs, credentialPath, read, mongo, load, statePath, save, path, directory, repository, secret, githubClient, deleteRepositorySecret, cleanupGame, liveLeases, validateRows, mergeSelectedRows, inspectTarget, safeMessage, console, assertNoRuns, dispatch } = dependencies;
    async function mergeGame(client, state, game, credentials) {
        if (game.phase === 'merged') {
            await cleanupGame(client, state, game, credentials);
            return;
        }
        const db = client.db(game.dbName);
        const records = await db.collection('capture_queue').find({}).toArray();
        const summary = workerSummary(records, state.queueId, game.campaignId);
        if (summary.pending || summary.running || await liveLeases(db))
            return;
        const counts = [];
        for (let i = 1; i <= 20; i++)
            counts.push(await validateRows(db, game, i));
        const decision = mergeDecision(game, records, state.queueId, counts, await liveLeases(db));
        if (!decision.acceptable) {
            game.phase = 'blocked';
            game.reason = `有效 ${decision.total} 条，低于 300000；保留数据等待续跑或协议诊断`;
            save(statePath, state);
            return;
        }
        const target = db.collection('simulate');
        const baseline = await target.countDocuments({ 'data.captureCampaignId': { $ne: game.campaignId } });
        if (baseline !== game.baseline)
            throw new Error('formal baseline changed before merge');
        if (game.acceptedTotal !== undefined && game.acceptedTotal !== decision.total)
            throw new Error('merge journal total changed');
        game.acceptedTotal = decision.total;
        game.phase = 'merging';
        save(statePath, state);
        save(path.join(directory, `${game.campaignId}-merge-evidence.json`), { queueId: state.queueId, campaignId: game.campaignId, baseline, counts, selected: decision.selected, acceptedTotal: decision.total, records, at: new Date().toISOString() });
        await mergeSelectedRows(db, game, decision.selected, decision.total);
        const final = await inspectTarget(client, game);
        if (final.total !== decision.total || final.invalid || await target.countDocuments({ 'data.captureCampaignId': game.campaignId }) !== decision.total - baseline)
            throw new Error('merged count mismatch; staging retained');
        game.phase = 'merged';
        save(statePath, state);
        await cleanupGame(client, state, game, credentials);
        console.log(JSON.stringify({ action: 'game-merged', gameId: game.gameId, total: decision.total, workers: summary }));
    }
    async function reconcile() {
        const state = load();
        if (state.phase === 'preparing' || state.phase === 'dispatching')
            throw new Error('queue dispatch not confirmed');
        const credentials = fs.existsSync(credentialPath) ? read(credentialPath) : {};
        const client = await mongo();
        try {
            await settleEndedNodes(client, state);
            for (const game of state.games) {
                if (['complete', 'blocked'].includes(game.phase))
                    continue;
                try {
                    await mergeGame(client, state, game, credentials);
                }
                catch (error) {
                    console.error(JSON.stringify({ gameId: game.gameId, error: safeMessage(error) }));
                }
            }
            if (state.games.every(g => ['complete', 'blocked'].includes(g.phase))) {
                const run = state.runId ? (await githubClient().get(`${repository}/actions/runs/${state.runId}`)).data : null;
                if (run?.status === 'completed') {
                    await deleteRepositorySecret(githubClient(), secret);
                    state.phase = state.games.every(g => g.phase === 'complete') ? 'complete' : 'paused';
                    save(statePath, state);
                }
            }
        }
        finally {
            await client.close();
        }
    }
    async function settleEndedNodes(client, state) {
        if (!state.runId)
            return;
        const response = await githubClient().get(`${repository}/actions/runs/${state.runId}/jobs`, { params: { per_page: 100 } });
        const ended = new Map();
        for (const job of response.data.jobs || []) {
            const match = /^滚动通道 (\d+)$/.exec(job.name);
            if (match && job.status === 'completed')
                ended.set(Number(match[1]), job.conclusion);
        }
        if (!ended.size)
            return;
        for (const game of state.games.filter(g => g.phase === 'ready')) {
            const db = client.db(game.dbName);
            const control = db.collection('capture_queue');
            for (const record of await control.find({ queueId: state.queueId, campaignId: game.campaignId }).toArray()) {
                let lane;
                if (record.status === 'running') {
                    const match = new RegExp(`^${state.runId}:(\\d+):`).exec(record.owner || '');
                    if (match)
                        lane = Number(match[1]);
                }
                else if (record.status === 'pending' && record._id.startsWith('worker:')) {
                    const candidate = Number(record._id.slice(7));
                    // 正常到时退出的通道留 pending 给下批续接；异常退出才封存其未开始份额。
                    if (ended.has(candidate) && ended.get(candidate) !== 'success')
                        lane = candidate;
                }
                if (!lane || !ended.has(lane))
                    continue;
                const [kind, index] = record._id.split(':');
                const live = await db.collection('capture_locks').countDocuments({ _id: `gh_${game.campaignId}_${kind}_${index}`, expiresAt: { $gt: new Date() } });
                if (live)
                    continue;
                await control.updateOne({ _id: record._id, queueId: state.queueId, campaignId: game.campaignId, status: record.status, ...(record.owner ? { owner: record.owner } : {}) }, { $set: { status: record.status === 'running' ? 'failed' : 'blocked', exitCode: 79, finishedAt: new Date(), reason: 'owning GitHub node ended; no live capture lease' } });
            }
        }
    }
    async function resume() {
        const state = load();
        if (!state.runId || !['running', 'paused'].includes(state.phase))
            throw new Error('queue is not resumable');
        const run = (await githubClient().get(`${repository}/actions/runs/${state.runId}`)).data;
        if (run.status !== 'completed')
            throw new Error('rolling workflow is still active');
        await assertNoRuns();
        const client = await mongo();
        try {
            for (const game of state.games.filter(g => g.phase === 'ready')) {
                const db = client.db(game.dbName);
                if (!canResetInterruptedTasks(run.status, await liveLeases(db)))
                    throw new Error('active lease blocks task recovery');
                await db.collection('capture_queue').updateMany({ queueId: state.queueId, campaignId: game.campaignId, status: { $in: ['running', 'failed', 'blocked'] } }, { $set: { status: 'pending' }, $unset: { owner: '', exitCode: '', reason: '', finishedAt: '' } });
            }
        }
        finally {
            await client.close();
        }
        await dispatch(state, read(credentialPath));
    }
    return { mergeGame, reconcile, settleEndedNodes, resume };
}
