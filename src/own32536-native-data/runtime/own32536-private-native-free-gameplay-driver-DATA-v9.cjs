"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindOwn32536PrivateNativeFreeGameplayDATA = bindOwn32536PrivateNativeFreeGameplayDATA;
// Actual source state machine returns the only permissible next request; the original SG transport remains its sole sender.
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const own_classic_paid_native_DATA_v2_private_cjs_1 = require("./own-classic-paid-native-DATA-v2-private.cjs");
const own32536_native_round_machine_DATA_v9_private_cjs_1 = require("./own32536-native-round-machine-DATA-v9-private.cjs");
const own32536_original_native_Reelstrip_DATA_private_cjs_1 = require("./own32536-original-native-Reelstrip-DATA-private.cjs");
const read = s => JSON.parse((0, node_fs_1.readFileSync)(new URL('../' + s, require('node:url').pathToFileURL(__filename)), 'utf8'));
const enumDATA = read('Gorilla-own-native-state-and-callback-flow-DATA/own32536-native-flow-enums-private.json');
const enums = Object.fromEntries(enumDATA.rows.map(r => [r.name, new Function('return(' + r.source + ');')()]));
enums.RUN_DEFAULT_ENTER = -1;
const uid = read('classic-two-paid-caller-DATA/32536-paid-caller-private.json').uidConfig.value;
function bindOwn32536PrivateNativeFreeGameplayDATA({ sgSessionExports: sg }) {
    return sg.bindOwnClassicGdmGameplayDataFactory('32536', (session, init) => {
        (0, strict_1.default)(sg.readOwnClassicGdmInitData(session) === init && init.gameId === '32536');
        const reels = (0, own32536_original_native_Reelstrip_DATA_private_cjs_1.readOwn32536OriginalNativeReelstripDATA)({ sgSessionExports: sg, originalSessionScope: session });
        let phase = 'idle', round, paid, machine, result, selected, currentResponse = init.nativeInitAccount.decodedNativeResponse, slotGSD = '';
        const controller = { betGSD: '' }, native = init.nativeInitAccount, account = native.account;
        const current = () => { (0, strict_1.default)(phase !== 'closed', 'Own native driver closed'); init.assertCurrent(); (0, strict_1.default)(sg.readOwnClassicGdmInitData(session) === init); };
        const readonly = new Proxy(account, { get(target, key) { if (key === 'takeBet' || key === 'clearWin')
                return () => { }; const v = Reflect.get(target, key, target); return typeof v === 'function' ? v.bind(target) : v; } });
        const select = (acct, scope) => (0, own_classic_paid_native_DATA_v2_private_cjs_1.buildOwnClassicPaidRequestDATA)({ gameId: '32536', originalSessionScope: session, originalRoundScope: scope, nativeInitAccount: acct === account ? native : { ...native, account: acct }, actualNativeGameConfig: native.nativeConfig.game, actualNativeFreeRounds: init.nativeFreeRounds, actualNativeEnums: enums, nativeDebug: { debugScreen: {} }, nativeRoundActive: false, nativeSlotBetGSD: slotGSD, nativeGameController: controller, actualNativeUIDConfig: uid, nativeDecodedResponse: currentResponse });
        const wire = r => ({ event: r.event, parameters: { GN: init.originalFactoryInitFrame.game.sg.runtimeSlug, ...Object.fromEntries(Object.entries(r.parameters).map(([k, v]) => [k, String(v)])) } });
        return Object.freeze({ kind: 'own32536-private-native-free-flow-v2',
            getInitialRequest() { current(); (0, strict_1.default)(phase === 'idle'); return wire(select(readonly, {})); },
            getExactFollowUpRequest(action) { current(); (0, strict_1.default)(action === (selected?.event === 'FREE_GAME' ? 'FREE_SPIN' : 'FEATURE') && phase === 'waiting-follow-up', 'Actual own native free next state required'); (0, strict_1.default)(selected === machine.readSelectedNativeRequest()); return wire(selected); },
            beforeSend(event, parameters) {
                current();
                if (phase === 'idle') {
                    const plan = wire(select(readonly, {}));
                    strict_1.default.deepEqual({ event, parameters }, plan, 'Actual paid request differs from native DATA');
                    (0, strict_1.default)(account.canBet());
                    round = {};
                    phase = 'preparing';
                    paid = select(account, round);
                    strict_1.default.deepEqual(wire(paid), plan);
                    slotGSD = paid.parameters.GSD ?? slotGSD;
                    machine = (0, own32536_native_round_machine_DATA_v9_private_cjs_1.createOwn32536NativeRoundMachineDATA)({ originalSessionScope: session, originalRoundScope: round, originalNativeInitData: init, originalPaidRequestReceipt: paid, originalNativeReelstripData: reels, maxLocalOperations: 153600 });
                }
                else {
                    (0, strict_1.default)(phase === 'waiting-follow-up' && selected === machine.readSelectedNativeRequest(), 'Actual native follow-up owner required');
                    strict_1.default.deepEqual({ event, parameters }, wire(selected), 'Native exact follow-up DATA changed');
                    machine.acceptSelectedNativeRequest(selected);
                    selected = undefined;
                }
                phase = 'awaiting-response';
                return { roundScope: round, isInitialPaid: event === 'BET' };
            },
            consume(source) {
                current();
                (0, strict_1.default)(phase === 'awaiting-response');
                result = machine.consumeOriginalSuccess(source);
                currentResponse = result.decodedNativeResponse;
                if (result.pendingNativeRequest) {
                    (0, strict_1.default)(!result.nativeRoundCloseObserved && result.nativeRoundActiveAfter);
                    selected = result.pendingNativeRequest;
                    phase = 'waiting-follow-up';
                }
                else {
                    (0, strict_1.default)(result.nativeRoundCloseObserved && result.nativeResultShownObserved && !result.nativeRoundActiveAfter, 'Actual native complete round signals required');
                    phase = 'response-consumed';
                }
                return result;
            },
            acceptClosedRound() { current(); (0, strict_1.default)(phase === 'response-consumed' && result.nativeRoundCloseObserved); machine.close(); phase = 'idle'; round = paid = machine = result = selected = undefined; },
            close() { try {
                machine?.close();
            }
            finally {
                phase = 'closed';
                round = paid = machine = result = selected = undefined;
            } }
        });
    });
}
