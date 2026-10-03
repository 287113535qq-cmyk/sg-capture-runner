// Generated from the unchanged AG source snapshot. Run node scripts/build-ag-rolling-core.mjs --check.
export function createAGCaptureRuntime(dependencies) {
    const { fs, RoxorCometDSession, captureAGRound, AGDiscardedRoundError, AGInitialSpinResponseError, isInitialSpinRuntimeError, console } = dependencies;
    function completionRate(task) {
        if (task.target <= 0) {
            return 1;
        }
        return Math.min((task.current + task.inFlight) / task.target, 1);
    }
    function refreshTask(task) {
        task.missing = Math.max(task.target - task.current, 0);
    }
    function refreshTotals(state) {
        state.totalTarget = state.tasks.reduce((sum, task) => sum + task.target, 0);
        state.totalMissing = state.tasks.reduce((sum, task) => sum + Math.max(task.target - task.current, 0), 0);
    }
    function compareTasks(left, right) {
        const leftRate = completionRate(left);
        const rightRate = completionRate(right);
        if (leftRate !== rightRate) {
            return leftRate - rightRate;
        }
        if (left.current !== right.current) {
            return left.current - right.current;
        }
        if (left.target !== right.target) {
            return left.target - right.target;
        }
        if (left.kind !== right.kind) {
            return left.kind === 'base' ? -1 : 1;
        }
        return left.optionIndex - right.optionIndex;
    }
    function applyGameShard(games, shardIndex, shardTotal) {
        if (!Number.isFinite(shardTotal) || shardTotal <= 1) {
            return games;
        }
        if (!Number.isFinite(shardIndex) || shardIndex < 1 || shardIndex > shardTotal) {
            throw new Error(`invalid shard index ${shardIndex}/${shardTotal}`);
        }
        return games.filter((_, index) => index % shardTotal === shardIndex - 1);
    }
    function buildCaptureState(counts, limits) {
        const tasks = [];
        const spinTarget = Math.max(0, limits.spinLimit);
        const choiceTarget = Math.max(0, limits.freeChoicePerOption);
        if ((limits.featureTarget || 0) > 0) {
            const current = counts.feature || 0;
            tasks.push({ key: 'feature', kind: 'feature', optionIndex: 0, target: limits.featureTarget, current,
                missing: Math.max(limits.featureTarget - current, 0), inFlight: 0 });
        }
        if (spinTarget > 0) {
            tasks.push({
                key: 'base',
                kind: 'base',
                optionIndex: 0,
                target: spinTarget,
                current: Math.max(0, counts.base || 0),
                missing: Math.max(spinTarget - (counts.base || 0), 0),
                inFlight: 0,
            });
        }
        if (choiceTarget > 0) {
            for (let optionIndex = 1; optionIndex <= Math.max(0, counts.optionCount || 0); optionIndex += 1) {
                const current = Math.max(0, counts.freeChoiceOptions[optionIndex] || 0);
                tasks.push({
                    key: `choice:${optionIndex}`,
                    kind: 'choice',
                    optionIndex,
                    target: choiceTarget,
                    current,
                    missing: Math.max(choiceTarget - current, 0),
                    inFlight: 0,
                });
            }
        }
        const state = {
            tasks,
            optionCount: Math.max(0, counts.optionCount || 0),
            // 一条选择回合可以同时计入整体样本和选项样本；这里统计配额进度，而不是物理文档数。
            totalCurrent: tasks.reduce((sum, task) => sum + task.current, 0),
            totalTarget: 0,
            totalMissing: 0,
        };
        refreshTotals(state);
        return state;
    }
    function ensureChoiceTasks(state, optionCount, freeChoicePerOption) {
        const target = Math.max(0, freeChoicePerOption);
        if (target <= 0 || optionCount <= state.optionCount) {
            return;
        }
        for (let optionIndex = state.optionCount + 1; optionIndex <= optionCount; optionIndex += 1) {
            state.tasks.push({
                key: `choice:${optionIndex}`,
                kind: 'choice',
                optionIndex,
                target,
                current: 0,
                missing: target,
                inFlight: 0,
            });
        }
        state.optionCount = optionCount;
        refreshTotals(state);
    }
    function selectNextTask(state, predicate = () => true) {
        const candidates = state.tasks.filter((task) => predicate(task) && task.current + task.inFlight < task.target);
        if (!candidates.length) {
            return null;
        }
        candidates.sort(compareTasks);
        const task = candidates[0];
        task.inFlight += 1;
        return task;
    }
    function selectNextChoiceTask(state, optionIndexes) {
        const allowed = new Set(optionIndexes.filter((value) => Number.isFinite(value) && value > 0));
        return selectNextTask(state, (task) => task.kind === 'choice' && allowed.has(task.optionIndex));
    }
    function markTaskSuccess(state, task) {
        task.inFlight = Math.max(0, task.inFlight - 1);
        task.current += 1;
        refreshTask(task);
        state.totalCurrent += 1;
        refreshTotals(state);
    }
    function markTaskFailure(state, task) {
        task.inFlight = Math.max(0, task.inFlight - 1);
        refreshTask(task);
        refreshTotals(state);
    }
    function getTaskByKey(state, key) {
        return state.tasks.find((task) => task.key === key) || null;
    }
    function recordTaskSuccessByKey(state, key) {
        const task = getTaskByKey(state, key);
        if (!task || task.current >= task.target) {
            return null;
        }
        task.current += 1;
        refreshTask(task);
        state.totalCurrent += 1;
        refreshTotals(state);
        return task;
    }
    function isCaptureComplete(state) {
        return state.tasks.every((task) => task.current >= task.target);
    }
    function getOptionHits(state, includeInflight = false) {
        const hits = {};
        for (const task of state.tasks) {
            if (task.kind !== 'choice') {
                continue;
            }
            hits[task.optionIndex] = task.current + (includeInflight ? task.inFlight : 0);
        }
        return hits;
    }
    class AGChoiceBalancer {
        hits;
        pending = {};
        constructor(existingHits) {
            this.hits = { ...existingHits };
        }
        reserve(optionIndexes) {
            const indexes = [...new Set(optionIndexes.filter(index => Number.isInteger(index) && index > 0))];
            if (!indexes.length)
                return null;
            indexes.sort((a, b) => (this.hits[a] || 0) + (this.pending[a] || 0)
                - (this.hits[b] || 0) - (this.pending[b] || 0) || a - b);
            const selected = indexes[0];
            this.pending[selected] = (this.pending[selected] || 0) + 1;
            return selected;
        }
        complete(index, stored) {
            this.pending[index] = Math.max(0, (this.pending[index] || 0) - 1);
            if (stored)
                this.hits[index] = (this.hits[index] || 0) + 1;
        }
        snapshot() {
            return { ...this.hits };
        }
    }
    function saveHandshakeConfig(file, data) {
        if (!file) {
            throw new Error('找不到生成的 AG 服务握手配置路径');
        }
        const temporary = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(data)}\n`);
        fs.renameSync(temporary, file);
    }
    function sleep(ms, shutdownSignal) {
        if (ms <= 0 || shutdownSignal?.aborted) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const timer = setTimeout(done, ms);
            function done() {
                clearTimeout(timer);
                shutdownSignal?.removeEventListener('abort', done);
                resolve();
            }
            shutdownSignal?.addEventListener('abort', done, { once: true });
        });
    }
    function isDeterministicCaptureError(error) {
        if (error instanceof AGDiscardedRoundError || isInitialSpinRuntimeError(error) || error instanceof AGInitialSpinResponseError)
            return false;
        const message = error instanceof Error ? error.message : String(error);
        return /unsupported AG nextAction|MalformedRequest|RuntimeError|missing supported next action|AG integrity:|no selectable option|exceeded \d+ follow-up steps|protocol negotiation failed|协议协商失败/i.test(message);
    }
    function getDbName(game) {
        return game.dbName || game.serviceDir || 'db_ag';
    }
    function formatState(state) {
        const parts = state.tasks.map((task) => {
            if (task.kind !== 'choice') {
                return `${task.key}=${task.current}/${task.target}`;
            }
            return `choice${task.optionIndex}=${task.current}/${task.target}`;
        });
        return parts.join(' ');
    }
    function getCaptureSampleGroups(round, state) {
        const groups = [];
        const featureTask = getTaskByKey(state, 'feature');
        if (round.isFeature && featureTask && featureTask.current < featureTask.target)
            groups.push('feature');
        const events = new Set((round.data.roundEvents || []).map((event) => event.toLowerCase()));
        for (const task of state.tasks) {
            if (task.key.startsWith('event:') && events.has(task.key.slice(6)) && task.current < task.target)
                groups.push(task.key);
        }
        const baseTask = getTaskByKey(state, 'base');
        if (baseTask && baseTask.current + baseTask.inFlight < baseTask.target) {
            groups.push('base');
        }
        if (round.optionIndex > 0) {
            const choiceTask = getTaskByKey(state, `choice:${round.optionIndex}`);
            if (choiceTask && choiceTask.current < choiceTask.target) {
                groups.push(`choice:${round.optionIndex}`);
            }
        }
        return groups;
    }
    class AGGameRunner {
        game;
        options;
        state;
        choiceBalancer;
        playedRounds = 0;
        handshakeSaved = false;
        liveSessions = new Set();
        leaseTimer = null;
        leaseLost = false;
        leaseAcquired = false;
        workerErrors = [];
        constructor(game, options) {
            this.game = game;
            this.options = options;
        }
        get dbName() {
            return getDbName(this.game);
        }
        reachedRoundLimit() {
            return this.options.maxRoundsPerGame > 0 && this.playedRounds >= this.options.maxRoundsPerGame;
        }
        isShuttingDown() {
            return this.options.shutdownSignal?.aborted === true;
        }
        shouldStop() {
            return this.isShuttingDown() || this.leaseLost || isCaptureComplete(this.state) || this.reachedRoundLimit();
        }
        async acquireLease() {
            const acquired = await this.options.store.tryAcquireGameLease(this.dbName, this.game.gameId, this.options.ownerId, this.options.gameLeaseMs);
            this.leaseAcquired = acquired;
            if (!acquired) {
                console.log(`[lock] skip ${this.game.gameId} db=${this.dbName} locked by another capture process`);
            }
            return acquired;
        }
        startLeaseRenewal() {
            const interval = Math.max(1000, this.options.gameLeaseRenewMs);
            this.leaseTimer = setInterval(() => {
                this.options.store
                    .renewGameLease(this.dbName, this.options.ownerId, this.options.gameLeaseMs)
                    .then((renewed) => {
                    if (!renewed) {
                        this.leaseLost = true;
                        console.warn(`[lock] lost ${this.game.gameId} db=${this.dbName}, stopping workers`);
                    }
                })
                    .catch((error) => {
                    this.leaseLost = true;
                    const message = error instanceof Error ? error.message : String(error);
                    console.warn(`[lock] renew failed ${this.game.gameId} db=${this.dbName}: ${message}`);
                });
            }, interval);
            this.leaseTimer.unref?.();
        }
        stopLeaseRenewal() {
            if (!this.leaseTimer) {
                return;
            }
            clearInterval(this.leaseTimer);
            this.leaseTimer = null;
        }
        async releaseLease() {
            this.stopLeaseRenewal();
            if (!this.leaseAcquired) {
                return;
            }
            try {
                await this.options.store.releaseGameLease(this.dbName, this.options.ownerId);
            }
            finally {
                this.leaseAcquired = false;
            }
        }
        async prepare() {
            if (this.options.shouldClear) {
                await this.options.store.clearGame(this.dbName);
                console.log(`[game] cleared ${this.game.gameId} db=${this.dbName}`);
            }
            const counts = await this.options.store.getCounts(this.dbName);
            const limits = { ...this.options.limits };
            let expectedEvents = [];
            if (this.options.validationSamples) {
                const requirements = await this.options.store.getValidationRequirements(this.dbName);
                counts.optionCount = Math.max(counts.optionCount, requirements.optionCount);
                limits.featureTarget = requirements.hasFeature ? this.options.validationSamples : 0;
                expectedEvents = requirements.events;
            }
            this.state = buildCaptureState(counts, limits);
            this.choiceBalancer = new AGChoiceBalancer(counts.balanceChoiceOptions || counts.freeChoiceOptions);
            for (const event of expectedEvents) {
                const current = counts.events?.[event] || 0;
                const target = 1; // 流程验收只需覆盖特殊事件；玩家选项仍各采 validationSamples 条。
                this.state.tasks.push({ key: 'event:' + event, kind: 'feature', optionIndex: 0, target, current,
                    missing: Math.max(target - current, 0), inFlight: 0 });
            }
            this.state.totalTarget = this.state.tasks.reduce((n, task) => n + task.target, 0);
            this.state.totalCurrent = this.state.tasks.reduce((n, task) => n + task.current, 0);
            console.log(`[game] ready ${this.game.gameId} db=${this.dbName} ${formatState(this.state)}`);
        }
        async openSession() {
            const session = new RoxorCometDSession(this.game);
            await session.connect();
            this.liveSessions.add(session);
            const handshake = session.getHandshakeData();
            if (handshake && !this.handshakeSaved) {
                saveHandshakeConfig(this.game.handshakeFile, handshake);
                this.handshakeSaved = true;
            }
            if (this.options.sessionReadyDelayMs > 0) {
                await sleep(this.options.sessionReadyDelayMs, this.options.shutdownSignal);
            }
            return session;
        }
        async resetSession(session) {
            if (!session) {
                return null;
            }
            try {
                session.close();
            }
            catch {
                // ignore close errors
            }
            this.liveSessions.delete(session);
            if (this.options.sessionRecycleDelayMs > 0) {
                await sleep(this.options.sessionRecycleDelayMs, this.options.shutdownSignal);
            }
            return null;
        }
        async ensureSession(session) {
            return session || this.openSession();
        }
        chooseAndReserveOption(pickOptions) {
            ensureChoiceTasks(this.state, pickOptions.length, this.options.limits.freeChoicePerOption);
            const optionIndexes = pickOptions
                .map((option) => Number(option.pickIndex))
                .filter((value) => Number.isFinite(value) && value > 0);
            const task = selectNextChoiceTask(this.state, optionIndexes);
            if (task) {
                return {
                    task,
                    option: pickOptions.find((option) => Number(option.pickIndex) === task.optionIndex) || null,
                    optionIndex: task.optionIndex,
                };
            }
            const optionIndex = this.choiceBalancer.reserve(optionIndexes) || 0;
            return {
                task: null,
                option: pickOptions.find(option => Number(option.pickIndex) === optionIndex) || null,
                optionIndex,
            };
        }
        async captureOnce(workerId, session) {
            let activeSession = session;
            let reservedChoice = null;
            let reservedOptionIndex = 0;
            for (let attempt = 0; attempt <= this.options.retryAttempts; attempt += 1) {
                try {
                    activeSession = await this.ensureSession(activeSession);
                    reservedChoice = null;
                    reservedOptionIndex = 0;
                    const round = await captureAGRound(activeSession, {
                        chooseOption: (pickOptions) => {
                            const picked = this.chooseAndReserveOption(pickOptions);
                            reservedChoice = picked.task;
                            reservedOptionIndex = picked.optionIndex;
                            return picked.option;
                        },
                    });
                    this.playedRounds += 1;
                    return { session: activeSession, round, reservedChoice, reservedOptionIndex };
                }
                catch (error) {
                    if (reservedOptionIndex)
                        this.choiceBalancer.complete(reservedOptionIndex, false);
                    if (reservedChoice) {
                        markTaskFailure(this.state, reservedChoice);
                        reservedChoice = null;
                    }
                    const normalized = error instanceof Error ? error : new Error(String(error));
                    activeSession = await this.resetSession(activeSession);
                    if (this.isShuttingDown()) {
                        return { session: activeSession, round: null, reservedChoice: null, reservedOptionIndex: 0, error: new Error('shutdown requested') };
                    }
                    // 协议错误会与功能触发强相关。换一局重试会悄悄丢掉该功能回合并造成样本偏差，必须立即阻断游戏。
                    if (isDeterministicCaptureError(normalized)) {
                        return { session: activeSession, round: null, reservedChoice: null, reservedOptionIndex: 0, error: normalized };
                    }
                    if (attempt < this.options.retryAttempts) {
                        console.warn(`[retry] ${this.game.gameId} worker=${workerId} retry=${attempt + 1}/${this.options.retryAttempts} reason=${normalized.message}`);
                        await sleep(this.options.retryDelayMs * Math.pow(2, attempt), this.options.shutdownSignal);
                        continue;
                    }
                    return { session: activeSession, round: null, reservedChoice: null, reservedOptionIndex: 0, error: normalized };
                }
            }
            return { session: activeSession, round: null, reservedChoice: null, reservedOptionIndex: 0, error: new Error('capture failed') };
        }
        async storeRound(round, reservedChoice, reservedOptionIndex) {
            const sampleGroups = getCaptureSampleGroups(round, this.state);
            if (sampleGroups.length === 0) {
                if (reservedOptionIndex)
                    this.choiceBalancer.complete(reservedOptionIndex, false);
                if (reservedChoice) {
                    markTaskFailure(this.state, reservedChoice);
                }
                return false;
            }
            round.data.captureSampleGroups = sampleGroups;
            await this.options.store.insertRound(this.dbName, round, this.game.rtpBuckets);
            if (reservedOptionIndex)
                this.choiceBalancer.complete(reservedOptionIndex, round.optionIndex === reservedOptionIndex);
            if (sampleGroups.includes('base')) {
                recordTaskSuccessByKey(this.state, 'base');
            }
            if (sampleGroups.includes('feature'))
                recordTaskSuccessByKey(this.state, 'feature');
            for (const key of sampleGroups.filter(key => key.startsWith('event:')))
                recordTaskSuccessByKey(this.state, key);
            const choiceKey = round.optionIndex > 0 ? `choice:${round.optionIndex}` : '';
            if (choiceKey && sampleGroups.includes(choiceKey)) {
                if (reservedChoice) {
                    markTaskSuccess(this.state, reservedChoice);
                }
                else {
                    recordTaskSuccessByKey(this.state, choiceKey);
                }
            }
            else if (reservedChoice) {
                markTaskFailure(this.state, reservedChoice);
            }
            return true;
        }
        logProgress(workerId, stored) {
            if (!stored) {
                return;
            }
            if (this.options.logInterval <= 0 || this.state.totalCurrent % this.options.logInterval !== 0) {
                return;
            }
            console.log(`[progress] ${this.game.gameId} worker=${workerId} total=${this.state.totalCurrent}/${this.state.totalTarget} ${formatState(this.state)}`);
        }
        async workerLoop(workerId) {
            let session = null;
            if (this.options.workerStartJitterMs > 0 && workerId > 1) {
                await sleep(this.options.workerStartJitterMs * (workerId - 1), this.options.shutdownSignal);
            }
            try {
                while (!this.shouldStop()) {
                    const result = await this.captureOnce(workerId, session);
                    session = result.session;
                    if (!result.round) {
                        if (this.isShuttingDown()) {
                            return;
                        }
                        console.warn(`[worker] ${this.game.gameId} worker=${workerId} stopped: ${result.error?.message || 'unknown error'}`);
                        this.workerErrors.push(result.error || new Error('unknown worker error'));
                        return;
                    }
                    const stored = await this.storeRound(result.round, result.reservedChoice, result.reservedOptionIndex);
                    this.logProgress(workerId, stored);
                    if (result.round.data?.requiresSessionReset
                        || (Number.isFinite(result.round.balance) && result.round.balance <= Math.max(result.round.bet, 0))) {
                        session = await this.resetSession(session);
                    }
                    if (this.options.spinDelayMs > 0) {
                        await sleep(this.options.spinDelayMs, this.options.shutdownSignal);
                    }
                }
            }
            finally {
                await this.resetSession(session);
            }
        }
        closeLiveSessionsNow() {
            for (const session of Array.from(this.liveSessions)) {
                try {
                    session.close();
                }
                catch {
                    // ignore close errors
                }
                this.liveSessions.delete(session);
            }
        }
        async closeAllSessions() {
            for (const session of Array.from(this.liveSessions)) {
                await this.resetSession(session);
            }
        }
        async run() {
            if (!this.game.backendId) {
                console.warn(`[skip] ${this.game.gameId} missing backendId`);
                return;
            }
            console.log(`[game] start ${this.game.gameId} (${this.game.name})`);
            const shutdownListener = () => this.closeLiveSessionsNow();
            try {
                if (!(await this.acquireLease())) {
                    return;
                }
                this.startLeaseRenewal();
                this.options.shutdownSignal?.addEventListener('abort', shutdownListener, { once: true });
                await this.prepare();
                // 即使旋转样本已满，也要刷新版本化握手配置。
                if (!this.isShuttingDown() && !this.leaseLost) {
                    await this.resetSession(await this.openSession());
                }
                if (this.shouldStop()) {
                    const reason = this.isShuttingDown() ? 'shutdown requested' : 'already complete';
                    console.log(`[game] skip ${this.game.gameId} ${reason} ${formatState(this.state)}`);
                    return;
                }
                const workerCount = Math.max(1, this.options.workersPerGame);
                await Promise.all(Array.from({ length: workerCount }, (_, index) => this.workerLoop(index + 1)));
                const suffix = this.reachedRoundLimit() ? ' round-limit' : '';
                if (isCaptureComplete(this.state)) {
                    console.log(`[game] done ${this.game.gameId} ${formatState(this.state)}`);
                }
                else if (this.workerErrors.length > 0) {
                    console.warn(`[game] incomplete ${this.game.gameId} worker-errors=${this.workerErrors.length} ${formatState(this.state)}`);
                }
                else {
                    console.log(`[game] stopped ${this.game.gameId}${suffix} ${formatState(this.state)}`);
                }
            }
            finally {
                this.options.shutdownSignal?.removeEventListener('abort', shutdownListener);
                await this.closeAllSessions();
                await this.releaseLease();
            }
        }
    }
    async function runAGScheduler(games, options) {
        if (!games.length) {
            console.log('[scheduler] no AG games to capture');
            return;
        }
        let nextIndex = 0;
        let shutdownLogged = false;
        const slots = Math.max(1, Math.min(options.concurrentGames, games.length));
        await Promise.all(Array.from({ length: slots }, async (_, slotIndex) => {
            for (;;) {
                if (options.shutdownSignal?.aborted) {
                    if (!shutdownLogged) {
                        shutdownLogged = true;
                        console.log('[scheduler] shutdown requested, no new AG games will be started');
                    }
                    return;
                }
                const index = nextIndex;
                nextIndex += 1;
                if (index >= games.length) {
                    return;
                }
                const game = games[index];
                console.log(`[scheduler] slot=${slotIndex + 1} game=${game.gameId}`);
                try {
                    await new AGGameRunner(game, options).run();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.error(`[scheduler] game ${game.gameId} failed: ${message}`);
                }
            }
        }));
    }
    return { runAGScheduler, AGGameRunner, buildCaptureState, isCaptureComplete };
}
