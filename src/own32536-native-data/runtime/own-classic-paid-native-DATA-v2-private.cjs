"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOwnClassicPaidRequestDATA = buildOwnClassicPaidRequestDATA;
// Selected own native BET callers only. The original AG remains the sole sender.
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = require("node:vm");
const load = (gid, name) => JSON.parse((0, node_fs_1.readFileSync)(new URL('../' + name + '/' + gid + (name === 'classic-two-paid-caller-DATA' ? '-paid-caller-private.json' : '-own-game-hooks-private.json'), require('node:url').pathToFileURL(__filename)), 'utf8'));
const required = (o, k) => { (0, strict_1.default)(o && Object.hasOwn(o, k) && o[k] !== undefined, 'Actual native input missing: ' + k); return o[k]; };
const noop = () => { };
function buildOwnClassicPaidRequestDATA({ gameId, originalSessionScope, originalRoundScope, nativeInitAccount, actualNativeGameConfig, actualNativeFreeRounds, actualNativeEnums, nativeDebug, nativeRoundActive, nativeLastWin, nativeSlotBetGSD, nativeGameController, actualNativeUIDConfig, nativeDecodedResponse }) {
    (0, strict_1.default)(['32536', '32727'].includes(gameId) && originalSessionScope && originalRoundScope);
    (0, strict_1.default)(nativeInitAccount.gameId === gameId && nativeInitAccount.originalSessionScope === originalSessionScope, 'Original initialized account scope changed');
    (0, strict_1.default)(typeof nativeRoundActive === 'boolean' && !nativeRoundActive, 'Original paid round must not already be active');
    // Prior display win is not a request or money admission gate.
    (0, strict_1.default)(typeof nativeSlotBetGSD === 'string' && nativeDebug && actualNativeEnums, 'Actual native request state required');
    const account = nativeInitAccount.account;
    (0, strict_1.default)(typeof account.takeBet === 'function');
    const data = load(gameId, 'classic-two-paid-caller-DATA'), hooks = load(gameId, 'classic-two-own-game-hooks-DATA-v2');
    (0, strict_1.default)(data.retainedSDKSourceSHA256 === hooks.retainedSourceSHA256, 'Own native source scope changed');
    const messages = [], signals = [];
    let current;
    const NOVA = { config: { game: actualNativeGameConfig }, debug: nativeDebug, startMsg(event) { (0, strict_1.default)(!current); current = { event, parameters: {} }; }, addToMsg(k, v) { (0, strict_1.default)(current && v !== undefined && !Object.hasOwn(current.parameters, k), 'Actual native parameter required'); current.parameters[k] = v; }, sendMsg() { (0, strict_1.default)(current); messages.push(current); } };
    const self = { account, freeRounds: actualNativeFreeRounds, roundActive: nativeRoundActive, betGSD: nativeSlotBetGSD,
        winManager: { stopWin: noop }, reelManager: { hideEffectsLayerSlots: noop, startSpin: noop },
        ui: { setRound: noop, autoplay: { inAutoplay: false }, canQuickStop: noop },
        metersManager: { balanceMeter: { setValue: noop, snapTo: noop }, winMeter: { isVisible: () => false, show: noop, snapTo: noop, setValue: noop, hide: noop } },
        messageBar: { displayWinText: noop, showLeftText: noop, hideIdle: noop, idle: noop } };
    const context = (0, node_vm_1.createContext)({ self, NOVA, ENUM: actualNativeEnums, wrapperAPI: (...args) => signals.push(args),
        METRICS: { addSpin: noop }, TweenMax: { killTweensOf: noop }, lastWin: nativeLastWin, lowBalanceShown: undefined, timeSpinStarted: undefined, console: { warn: noop } });
    const row = data.functions.find(x => x.name === 'BaseSpinningStartState');
    const ctor = (0, node_vm_1.runInContext)('(' + row.source + ')', context, { timeout: 1000 }), state = Reflect.construct(ctor, [required(actualNativeEnums.gameState, 'BASE_SPINNING_START')]);
    if (gameId === '32536') {
        (0, strict_1.default)(nativeGameController && typeof required(nativeGameController, 'betGSD') === 'string', 'Actual own controller request state required');
        required(nativeDecodedResponse, 'utc'); // Own decoder always creates utc; missing iso follows native Invalid Date branches.
        const uid = required(actualNativeUIDConfig, 'uid');
        required(uid, 'nj');
        const controller = nativeGameController;
        controller.slotGame = self;
        self.serverResponse = nativeDecodedResponse;
        NOVA.config.uid = uid;
        const own = (0, node_vm_1.createContext)({ self: controller, game: controller, NOVA, ENUM: actualNativeEnums, island_main: { updateInfoPage: noop }, console: { log: noop }, p1available: undefined, p2available: undefined });
        controller.checkPatchStatus = (0, node_vm_1.runInContext)('(' + data.functions.find(x => x.name === 'checkPatchStatus').source + ')', own, { timeout: 1000 });
        const hook = (0, node_vm_1.runInContext)('(' + hooks.functions.find(x => x.target === 'this.slotGame.api_enter').source + ')', own, { timeout: 1000 });
        (0, strict_1.default)(Reflect.apply(hook, controller, [state]) === actualNativeEnums.RUN_DEFAULT_ENTER, 'Own paid entry selected a different native path');
    }
    Reflect.apply(state.enter, state, []);
    (0, strict_1.default)(messages.length === 1 && messages[0].event === 'BET', 'Own native BET caller required');
    return Object.freeze({ gameId, originalSessionScope, originalRoundScope, event: 'BET', parameters: Object.freeze({ ...messages[0].parameters }), account,
        nativeRoundOpened: signals.some(x => x[0] === 'ROUND' && x[1] === 1), nativeAccountBalanceAfterSelection: account.getBalance(), sourceFragmentSHA256: row.fragmentSHA256,
        actualNativeRequestOriginalFactoryAssociationStillRequired: true, sourceRequests: 0, providerACKClaimed: false, productionAdmission: false });
}
