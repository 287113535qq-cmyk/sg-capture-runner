"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOwn32536NativeRoundMachineDATA = createOwn32536NativeRoundMachineDATA;
// Private source-bound state machine. It emits native request DATA only; the original SG connection owns wire dispatch.
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = require("node:vm");
const own32536_native_line_callback_DATA_private_cjs_1 = require("./own32536-native-line-callback-DATA-private.cjs");
const own32536_native_ReelManager_DATA_private_cjs_1 = require("./own32536-native-ReelManager-DATA-private.cjs");
const own32536_native_Pick_ui_DATA_v2_private_cjs_1 = require("./own32536-native-Pick-ui-DATA-v2-private.cjs");
const read = rel => JSON.parse((0, node_fs_1.readFileSync)(new URL('../' + rel, require('node:url').pathToFileURL(__filename)), 'utf8'));
const common = read('Gorilla-own-native-state-and-callback-flow-DATA/own32536-native-state-and-callback-flow-private.json');
const previous = read('classic-two-exact-next-DATA/32536-native-next-DATA-private.json');
const paid = read('classic-two-paid-caller-DATA/32536-paid-caller-private.json');
const nativeEnums = read('Gorilla-own-native-state-and-callback-flow-DATA/own32536-native-flow-enums-private.json');
const eventDATA = read('Gorilla-own-native-free-event-producers-DATA/own32536-native-free-event-producers-private.json');
const tables = read('classic-two-native-next-state-table-DATA-private.json').find(r => r.gameId === '32536');
const parser = read('classic-Gorilla-native-parser-DATA/own32536-parser-and-account-setup-private.json');
const parserDependencies = read('classic-Gorilla-parser-dependencies-DATA/own32536-native-parser-dependencies-private.json');
const features = read('Gorilla-nine-own-feature-protocol-DATA/own32536-feature-controllers-and-effects-private.json');
const hooks = read('classic-two-own-game-hooks-DATA-v2/32536-own-game-hooks-private.json');
(0, strict_1.default)(common.retainedSDKSourceSHA256 === features.retainedSDKSourceSHA256 && features.retainedSDKSourceSHA256 === eventDATA.retainedSDKSourceSHA256);
const shellDATA = read('Gorilla-own-native-Shell-intro-DATA/own32536-native-Shell-intro-private.json');
const shellMoney = read('Gorilla-native-financial-effects-DATA/own32536-initial-shell-money-private.json');
(0, strict_1.default)(shellDATA.retainedSDKSourceSHA256 === features.retainedSDKSourceSHA256);
const noop = () => { };
function view() { return { visible: false, alpha: 1, scale: { set: noop }, anchor: { set: noop }, setPositionXY: noop, setPosition: noop, addChild: noop, removeChild: noop, removeChildren: noop, destroy: noop, refreshText: noop, setValue: noop, snapTo: noop, show: noop, hide: noop, rollup: noop, setTuneDelay: noop, resetTuneDelay: noop }; }
function createOwn32536NativeRoundMachineDATA({ originalSessionScope: session, originalRoundScope: round, originalNativeInitData: init, originalPaidRequestReceipt: paidReceipt, originalNativeReelstripData, maxLocalOperations = 256 }) {
    init.assertCurrent();
    (0, strict_1.default)(init.gameId === '32536' && init.originalSessionScope === session && paidReceipt.originalSessionScope === session && paidReceipt.originalRoundScope === round && paidReceipt.nativeRoundOpened === true, 'Actual native Init and paid round owner required');
    (0, strict_1.default)(Number.isSafeInteger(maxLocalOperations) && maxLocalOperations > 0);
    const account = init.nativeInitAccount.account, free = init.nativeFreeRounds, config = init.nativeInitAccount.nativeConfig;
    (0, strict_1.default)(paidReceipt.account === account && !free.isInFreeRounds(), 'Unmapped promotional native branch');
    let operations = 0, closed = false, pending, currentFrame, sourceOwner, activeNativeRequest = 'BET', message, localTime = 0, timerOrdinal = 0;
    const nativeButtons = [];
    const consumed = new WeakSet(), signals = [], events = [], transitions = [], timers = [], presentations = [], requests = [];
    const current = () => { (0, strict_1.default)(!closed, 'Native round machine closed'); init.assertCurrent(); };
    const tick = () => { current(); (0, strict_1.default)(++operations <= maxLocalOperations, 'Native local operation budget reached'); };
    const later = (delay, callback, args, scope) => { (0, strict_1.default)(typeof callback === 'function', 'Actual native callback required'); (0, strict_1.default)(Number.isFinite(delay) && delay >= 0, 'Actual native delay required'); timers.push({ callback, args: args ?? [], scope, at: localTime + delay, ordinal: ++timerOrdinal }); };
    const winMeter = view(), balanceMeter = view();
    winMeter.getValue = () => account.getWin();
    const model = { account, freeRounds: free, featureData: {}, serverResponse: init.nativeInitAccount.decodedNativeResponse, states: {}, roundActive: true, resultShown: false, returnFromFreeGames: false, returnFromGamble: false, inRecovery: false, bReportTotalWin: false, freeGameIdleSpinDelay: config.game.freeGamesAutoplayDelay,
        ui: { setWin: noop, setRound: noop, autoplay: { inAutoplay: false }, setGameUIDisable: noop, showLowBalanceDialogs: () => false, canSpinAutoplay: noop, cancelAutoplay: noop, canContinue: noop, canQuickStop: noop, disableAutoplay: noop, pauseAutoplay: noop, updateUI: noop },
        metersManager: { winMeter, balanceMeter }, messageBar: { displayWinText: noop, showLeftText: noop, showRightText: noop, setRightText: noop, setRightValue: noop, idle: noop, hideIdle: noop }, api_notify: noop, debugUI: { setDebugString: noop }, stateNames: {} };
    const controller = { slotGame: model, initialized: true, initialMSGStore: null, features: null, currentFeatureID: 0, betGSD: '', setWhizbyAssets: noop, swapFGandFStxt: noop, addFGmeterDelay: noop, checkSoundLoadedFG: noop, checkSoundLoadedBG: noop, checkSoundLoadedPK: noop, checkFeatureTriggers: noop,
        gorillaAnims: { playIdle: noop, onBasePostSpin: noop, onFGPostSpin: noop, playCheers: noop, playThumbsup: noop, playClapB: noop }, scatterChecker: { setStops: noop }, featurePanel: { show: noop, hide: noop }, panelBackground: view() };
    const NOVA = { config, debug: { debugScreen: {} }, paused: false, isLandscape: () => true, getContainer: () => view(), getSprite: () => view(), addToContainer: noop, removeFromContainer: noop,
        startMsg(event) { (0, strict_1.default)(!message && !pending, 'Multiple native request DATA intents'); message = { event, parameters: {} }; },
        addToMsg(key, value) { (0, strict_1.default)(message && !Object.hasOwn(message.parameters, key) && value !== undefined, 'Actual native message value required'); message.parameters[key] = value; },
        sendMsg() { (0, strict_1.default)(['FREE_GAME', 'FEATURE_START', 'FEATURE_PICK', 'FEATURE_END'].includes(message?.event), 'Unmapped native request caller'); pending = Object.freeze({ event: message.event, parameters: Object.freeze({ ...message.parameters }), sessionScope: session, roundScope: round }); requests.push(pending); message = undefined; } };
    const metrics = { ...init.nativeMetrics, addSpin: (...value) => events.push({ nativeMetric: 'addSpin', value }), startFPS: noop, stopFPS: noop };
    const animate = (target, duration, properties) => { (0, strict_1.default)(target && typeof target === 'object' && Number.isFinite(duration) && duration >= 0, 'Actual native local animation target required'); if (properties.onComplete !== undefined) {
        (0, strict_1.default)(typeof properties.onComplete === 'function');
        later(duration, properties.onComplete, properties.onCompleteParams, properties.onCompleteScope);
    } };
    const env = { self: model, game: controller, NOVA, METRICS: metrics, ENUM: { ...eventDATA.constants }, bDontStopAutoplay: false, lowBalanceShown: false, lastWin: undefined, quickStopFired: false, timeSpinStarted: undefined, lastExitCode: -1, wingate: { reset: noop }, reelgate: { reset: noop }, wrapperAPI: (...args) => signals.push(args), TweenMax: { delayedCall: later, to: animate }, TweenLite: { delayedCall: later, to: animate } };
    const core = (0, node_vm_1.createContext)(env), compile = (source, context = core) => (0, node_vm_1.runInContext)('(' + source + ')', context, { timeout: 1000 });
    for (const row of nativeEnums.rows)
        env.ENUM[row.name] = compile(row.source);
    env.ENUM.reelManagerGameState = compile(eventDATA.reelManagerGameStateSource);
    model.nextStateTable = compile(tables.nextStateTableSource);
    for (const row of parserDependencies.functions)
        model[row.name] = compile(row.source);
    model.parseNative = compile(parser.parser.source);
    for (const name of ['fireEvent', 'winCompleted', 'allReelsStopped'])
        model[name] = compile(eventDATA.rows.find(r => r.name === name).source);
    model.getCurrentState = () => model.currentState;
    model.resetWinGate = () => env.wingate.reset();
    model.winManager = { stopWin: noop, stopCelebration: noop, startWinSequenceOnly: noop, setWinCombinations: noop, getWinLevel: () => ({}), preStartWin: () => undefined,
        startWin() { presentations.push({ kind: 'native-win-completion', callback: model.winCompleted }); return {}; },
        strumLines() { throw Error('Native LotsOfLines line callback producer not connected'); } };
    model.reelManager = { setReelstrips: noop, storeStopsLocally: noop, stopAllSRSslotAnimations: noop, hideEffectsLayerSlots: noop, startSpin: noop, setReelManagerGameState: noop, setStops: noop, quickStop: noop,
        stopReels() { presentations.push({ kind: 'native-reel-completion', callback: model.allReelsStopped }); } };
    const reels = (0, own32536_native_ReelManager_DATA_private_cjs_1.attachOwn32536NativeReelManagerDATA)({ nativeManager: model.reelManager, originalSessionScope: session, nativeReelstripData: originalNativeReelstripData, nativeGameConfig: config.game });
    env.TweenMax.fromTo = (target, duration, from, to) => animate(target, duration, to);
    env.TweenMax.killDelayedCallsTo = callback => { if (typeof callback === 'function')
        for (let i = timers.length - 1; i >= 0; i--)
            if (timers[i].callback === callback)
                timers.splice(i, 1); };
    env.TweenMax.killTweensOf = env.TweenMax.killDelayedCallsTo;
    const lineCallbacks = (0, own32536_native_line_callback_DATA_private_cjs_1.createOwn32536NativeLineCallbacksDATA)({ nativeConfig: config, nativeEnums: env.ENUM, nativeReelManager: model.reelManager, nativeTweenMax: env.TweenMax, nativeSound: { play: noop }, createLineDisplay: () => ({ ...view(), setSegmentsActived: noop }), createContainerDisplay: view });
    model.winManager.setWinCombinations = lineCallbacks.setWinCombinations;
    model.winManager.strumLines = lineCallbacks.strumLines;
    model.winManager.stopWin = lineCallbacks.reset;
    const stateNames = ['BaseIdleState', 'BaseSpinningStartState', 'BaseSpinningState', 'BaseSpinningStopState', 'BasePostSpinState', 'BaseWinState', 'FreeGameIntroState', 'FreeGameIdleState', 'FreeGamePreSpinState', 'FreeGameSpinningStartState', 'FreeGameSpinningState', 'FreeGameSpinningStopState', 'FreeGamePostSpinState', 'FreeGameWinState', 'FreeGameSummaryState', 'FeatureIntroState', 'FeatureStartState', 'FeaturePrePickState', 'FeaturePickState', 'FeaturePostPickState', 'FeatureEndState', 'FeatureSummaryState'];
    const all = [...common.rows, ...previous.functions, ...paid.functions];
    for (const name of stateNames) {
        const row = all.find(r => r.name === name);
        (0, strict_1.default)(row, 'Own native state missing ' + name);
        const key = name.replace(/State$/, '').replace(/^FreeGame/, 'Freegame').replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase(), id = env.ENUM.gameState[key];
        (0, strict_1.default)(Number.isInteger(id), 'Native state id missing ' + name);
        model.states[id] = Reflect.construct(compile(row.source), [id]);
        model.stateNames[id] = key;
    }
    const panel = callbackName => ({ init(callback) { (0, strict_1.default)(callback === controller[callbackName], 'Own native panel callback reference changed'); this.callback = callback; }, show(visible) { if (visible) {
            (0, strict_1.default)(typeof this.callback === 'function');
            presentations.push({ kind: callbackName, callback: this.callback });
        } } });
    const gameEnv = { ...env, self: controller, game: controller, introPanel: undefined, summaryPanel: undefined, backgroundAnims: { tintBackground: noop }, gameSound: { playFreeGamesIntro: noop, playSummaryFreeGames: () => 0, stopSummaryFreeGames: noop, fadeTo50AmbientFreeGame: noop, playRetriggerFreeGame: noop }, gameDebug: { showLSL: noop }, triggerMsgTimelineTweenTop: { restart: noop }, textBonusIslands: view(), gsdData: model.serverResponse.gsd };
    gameEnv.SOUND = { play: noop };
    gameEnv.NovaContainer = function () { Object.assign(this, view()); };
    gameEnv.NovaTextBox = function () { Object.assign(this, view()); };
    gameEnv.Waterfall_Whizzby = function () { Object.assign(this, { init: noop, reset: noop, playSplash: noop, stopSplash: noop, play: noop, stop: noop, update: noop }); };
    // These endpoints only receive drawing/animation operations. Raw stops, clone strips, symbols and prizes remain native source values.
    model.winManager.hideLinesContainer = noop;
    model.reelManager.getSlotMapCoordinate = model.reelManager.getSlotMapCoordinateCenter = () => Object.freeze({ x: 0, y: 0 });
    for (const reel of reels.nativeViews) {
        reel.setReelStripFromClone = function (strip) { (0, strict_1.default)(Array.isArray(strip), 'Actual native clone strip required'); this.strip = strip; };
        reel.setStop = function (stop) { (0, strict_1.default)(Number.isFinite(stop), 'Actual native shell stop required'); this.stop = stop; };
        reel.startMotion = reel.stopMotion = reel.changeStopDelay = noop;
        reel.setSymbol = function (row, id) { (0, strict_1.default)(Number.isFinite(row) && Number.isFinite(id), 'Actual native symbol placement required'); };
    }
    const reelContext = (0, node_vm_1.createContext)({});
    for (const name of ['setCloneReelStrip', 'changeStopDelays', 'stopSpin', 'setSymbol']) {
        const row = shellDATA.rows.find(r => r.name === name);
        model.reelManager[name] = (0, node_vm_1.runInContext)('(' + row.source + ')', reelContext, { timeout: 1000 });
    }
    controller.shellCollectAnims = { playByTriggerId: noop };
    controller.shellRespins = { bannerBlank: view(), bannerIntroTxt: view(), container: view(), show: noop, setItemsByTriggerId: noop };
    gameEnv.ShellHoldAnimation = function () { this.init = this.reset = this.addAnimation = this.moveTo = noop; };
    NOVA.getGameBounds = () => ({});
    gameEnv.Power0 = { easeNone: undefined };
    gameEnv.NovaButton = function (options) { Object.assign(this, view()); this.nativeOptions = options; this.enabled = false; this.enable = function (value) { (0, strict_1.default)(typeof value === 'boolean'); this.enabled = value; }; nativeButtons.push(this); };
    gameEnv.TimelineMax = function () { const callbacks = []; this.kill = () => { callbacks.length = 0; }; this.fromTo = () => { }; this.add = callback => { (0, strict_1.default)(typeof callback === 'function'); callbacks.push(callback); }; this.play = () => { for (const callback of callbacks.splice(0))
        later(0, callback); }; };
    const gameContext = (0, node_vm_1.createContext)(gameEnv);
    controller.fixFirstSheelsTotalWin = compile(shellMoney.functions[0].source, gameContext);
    for (const name of ['introPanelClose', 'summaryPanelClose'])
        controller[name] = compile(eventDATA.rows.find(r => r.name === name).source, gameContext);
    const ordinaryIntro = panel('introPanelClose'), IntroPanel = compile(shellDATA.rows.find(r => r.name === 'IntroPanel').source, gameContext), shellIntro = Reflect.construct(IntroPanel, []);
    gameEnv.introPanel = { init(callback) { return controller.features.FID === 9 ? shellIntro.init(callback) : ordinaryIntro.init(callback); }, show(visible) { return controller.features.FID === 9 ? shellIntro.show(visible) : ordinaryIntro.show(visible); } };
    gameEnv.summaryPanel = panel('summaryPanelClose');
    for (const name of ['freeGameIntroChoreography', 'freeGameSummaryChoreography', 'featuresCallback', 'winSymbolChoreography'])
        controller[name] = compile(common.rows.find(r => r.name === name).source, gameContext);
    for (const row of features.rows.filter(r => r.name.startsWith('Feature')))
        gameEnv[row.name] = compile(row.source, gameContext);
    controller.features = Reflect.construct(gameEnv.Features, []);
    controller.features.canInitFeature = true;
    controller.pickSelect = compile(hooks.functions.find(r => r.target === 'this.pickSelect').source, gameContext);
    controller.pickFeatureStart = compile(common.rows.find(r => r.name === 'pickFeatureStart').source, gameContext);
    const pickUI = (0, own32536_native_Pick_ui_DATA_v2_private_cjs_1.attachOwn32536NativePickUIDATA)({ nativeEnvironment: gameEnv, nativeContext: gameContext, nativeModel: model, nativeController: controller, scheduleNativeCallback: later, assertCurrent: current });
    // Draw-only controllers never emit network/native protocol completion, alter win/stake, or supply source fields.
    gameEnv.ExpandingWilds = function () { Object.assign(this, view(), { init: noop, reset: noop, forceRemoveExpand: noop, hideSymbols: noop, play: noop, stopExpandAnim: noop, update: noop }); };
    gameEnv.MysteryTransform = function () { Object.assign(this, { init: noop, reset: noop, kill: noop, addAnimation: noop }); };
    gameEnv.RoamerObject = gameEnv.TaggedReveal = gameEnv.BonusSymbolEffect = function () { Object.assign(this, view(), { init: noop, play: noop, stop: noop }); };
    gameEnv.Back = { easeIn: { config: () => undefined }, easeOut: { config: () => undefined } };
    Object.assign(controller.gorillaAnims, { playExpandingWild: noop, playThrownet: noop, playFootStompA: noop, playFootStompB: noop });
    model.reelManager.showSlotEffectLayer = noop;
    model.reelManager.getAllSymbolCoords = () => [];
    model.winManager.winSymbolCheck = () => false;
    for (const reel of reels.nativeViews)
        reel.setSymbol = function (row, id) { this.renderedSymbols ?? (this.renderedSymbols = new Map()); this.renderedSymbols.set(row, id); };
    const ownEnter = compile(hooks.functions.find(r => r.target.includes('api_enter')).source, gameContext), ownEvent = compile(hooks.functions.find(r => r.target.includes('api_handleEvent')).source, gameContext);
    model.api_enter = state => { tick(); (0, strict_1.default)(state && model.states[state.id] === state, 'Unmapped native state selected'); transitions.push(model.stateNames[state.id]); return Reflect.apply(ownEnter, controller, [state]); };
    model.api_handleEvent = (state, event, param) => { tick(); (0, strict_1.default)(state && model.states[state.id] === state, 'Unmapped current native state'); events.push({ state: state.id, event }); return Reflect.apply(ownEvent, controller, [state, event, param]); };
    model.currentState = env.ENUM.gameState.BASE_SPINNING_START;
    function drain() {
        while (!pending) {
            if (timers.length) {
                timers.sort((a, b) => a.at - b.at || a.ordinal - b.ordinal);
                const timer = timers.shift();
                localTime = timer.at;
                tick();
                Reflect.apply(timer.callback, timer.scope, timer.args);
                continue;
            }
            if (presentations.length) {
                const item = presentations.shift();
                tick();
                Reflect.apply(item.callback, undefined, []);
                continue;
            }
            if (pickUI.advanceShellControl()) {
                tick();
                continue;
            }
            if (pickUI.advanceLegalSelection()) {
                tick();
                continue;
            }
            break;
        }
    }
    return Object.freeze({
        consumeOriginalSuccess(source) {
            try {
                current();
                (0, strict_1.default)(typeof source.read === 'function' && typeof source.has === 'function');
                const frame = source.read(session, round);
                (0, strict_1.default)(source.has(frame) && frame.sessionScope === session && frame.roundScope === round && !consumed.has(frame), 'Current own round response owner required');
                (0, strict_1.default)(frame.step.msgId === activeNativeRequest, 'Actual native request/ACK association changed');
                (0, strict_1.default)(!pending, 'Native pending request has not been dispatched');
                consumed.add(frame);
                sourceOwner = source;
                currentFrame = frame;
                const payload = frame.step.responsePayload;
                (0, strict_1.default)(typeof payload === 'string');
                const fields = new Map();
                for (const pair of payload.split('&')) {
                    const at = pair.indexOf('=');
                    if (at < 1)
                        continue;
                    fields.set(pair.slice(0, at), pair.slice(at + 1));
                }
                (0, strict_1.default)(fields.get('MSGID') === activeNativeRequest && fields.has('B') && fields.has('TW'), 'Actual native successful financial payload required');
                const response = Reflect.apply(model.parseNative, model, [payload.split('&')]);
                (0, strict_1.default)(!response.inRecovery, 'Native recovery continuation not mapped');
                // Actual native FEATURE states/Island buttons select the request, without observed-combination gates.
                const fid = typeof response.featureId === 'string' ? parseInt(response.featureId.split('|')[0]) : 0;
                // Shell9 uses its actual own IntroPanel and native initial stop/account restoration callbacks.
                if (activeNativeRequest === 'FREE_GAME')
                    (0, strict_1.default)(fields.has('CW') && Number.isFinite(response.currentWin), 'Native free financial current win required');
                model.serverResponse = response;
                gameEnv.gsdData = response.gsd;
                Reflect.apply(model.fireEvent, model, ['MSG', payload]);
                drain();
                current();
                (0, strict_1.default)(source.has(frame), 'Own current response revoked during local callbacks');
                const roundClose = signals.some(x => x[0] === 'ROUND' && x[1] === 0), shown = signals.some(x => x[0] === 'RESULT_SHOWN');
                return Object.freeze({ gameId: '32536', originalResponseFrame: frame, decodedNativeResponse: response, nativeSlotGameModel: model, nativeGameController: controller, nativeAccountBalance: account.getBalance(), nativeAccountWin: account.getWin(), nativeRoundCloseObserved: roundClose, nativeResultShownObserved: shown, nativeRoundActiveAfter: model.roundActive, pendingNativeRequest: pending, nativeState: model.stateNames[model.currentState], rawNativeSignals: signals.slice(), nativeTransitions: transitions.slice(), nativeEvents: events.slice(), sourceRequests: 0, providerACKClaimed: false, productionAdmission: false });
            }
            catch (error) {
                closed = true;
                pending = undefined;
                timers.length = presentations.length = 0;
                throw error;
            }
        },
        readSelectedNativeRequest() { current(); (0, strict_1.default)(pending && sourceOwner?.has(currentFrame), 'Current own native next request required'); return pending; },
        acceptSelectedNativeRequest(request) { current(); (0, strict_1.default)(request === pending && sourceOwner?.has(currentFrame), 'Native request DATA owner changed'); activeNativeRequest = request.event; pending = undefined; },
        close() { try {
            if (!closed && !model.roundActive && model.resultShown)
                controller.features.close();
        }
        finally {
            closed = true;
            pending = undefined;
            timers.length = presentations.length = 0;
            for (const button of nativeButtons)
                button.enabled = false;
            pickUI.close();
        } },
        sourceOnly: true, productionAdmission: false
    });
}
