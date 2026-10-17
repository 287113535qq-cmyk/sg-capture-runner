"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeOwn32536NativeAccountWithNativeFreeRounds = initializeOwn32536NativeAccountWithNativeFreeRounds;
// Own Gorilla native Init/Account DATA. The caller must first validate the original
// transport/envelope. This module does not certify transport, mint sessions or send.
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = require("node:vm");
const read = name => JSON.parse((0, node_fs_1.readFileSync)(new URL('../' + name, require('node:url').pathToFileURL(__filename)), 'utf8'));
const accountDATA = read('classic-Gorilla-own-account-init-DATA/own32536-Account-Init-and-config-private.json');
const parserDATA = read('classic-Gorilla-native-parser-DATA/own32536-parser-and-account-setup-private.json');
const dependencies = read('classic-Gorilla-parser-dependencies-DATA/own32536-native-parser-dependencies-private.json');
(0, strict_1.default)(accountDATA.gameId === '32536' && parserDATA.gameId === '32536' && dependencies.gameId === '32536');
(0, strict_1.default)(accountDATA.retainedSDKSourceSHA256 === parserDATA.retainedSDKSourceSHA256 && parserDATA.retainedSDKSourceSHA256 === dependencies.retainedSDKSourceSHA256);
const required = (o, k) => { (0, strict_1.default)(o && Object.hasOwn(o, k) && o[k] !== undefined, 'Actual native input missing: ' + k); return o[k]; };
const finite = (n, label) => { (0, strict_1.default)(typeof n === 'number' && Number.isFinite(n), 'Actual finite ' + label + ' required'); return n; };
const ref = (x, label) => { (0, strict_1.default)(x && typeof x === 'object', label + ' required'); return x; };
function initializeOwn32536NativeAccountWithNativeFreeRounds({ originalSessionScope, nativeInitPayload, actualNativeConfig, actualCurrency, actualMetrics }) {
    ref(originalSessionScope, 'original session scope');
    (0, strict_1.default)(typeof nativeInitPayload === 'string');
    const config = ref(actualNativeConfig, 'actual merged native config');
    const game = ref(required(config, 'game'), 'actual game config');
    (0, strict_1.default)([0, 1, 2].includes(required(game, 'type')));
    const ante = ref(required(game, 'anteBet'), 'actual ante config');
    finite(required(ante, 'betAdjustment'), 'bet adjustment');
    finite(required(ante, 'superBetDefault'), 'native superbet default');
    const currency = ref(actualCurrency, 'actual currency'), metrics = ref(actualMetrics, 'actual metrics');
    (0, strict_1.default)(typeof currency.config === 'function' && typeof metrics.setFROptions === 'function', 'Actual original native Init consumers required');
    const self = { featureData: {} }, NOVA = { config, currency }, ENUM = { winSequence: { PAYLINE: 0, PAYWAY: 1, JJ: 2 }, XC_NULL: -1 };
    const context = (0, node_vm_1.createContext)({ self, NOVA, ENUM, METRICS: metrics });
    const native = (source) => (0, node_vm_1.runInContext)('(' + source + ')', context, { timeout: 1000 });
    const ownFreeDATA = read('Gorilla-nine-own-feature-protocol-DATA/own32536-feature-controllers-and-effects-private.json').rows.find(row => row.name === 'FreeRoundsBase');
    (0, strict_1.default)(ownFreeDATA);
    const free = Reflect.construct(native(ownFreeDATA.source), []);
    self.freeRounds = free;
    // Rendering sinks only. All promotional state/getters remain the untouched own native constructor.
    free.roundNumberMeter = { snapTo() { } };
    free.totalWinMeter = { snapTo() { }, rollTo() { } };
    const parser = native(parserDATA.parser.source);
    for (const row of dependencies.functions)
        self[row.name] = native(row.source);
    // Preserve the original wire ordering, including the original FGT/FID decoder order.
    const fields = new Map();
    for (const pair of nativeInitPayload.split('&')) {
        const at = pair.indexOf('=');
        if (at < 1)
            continue;
        fields.set(pair.slice(0, at), pair.slice(at + 1));
    }
    (0, strict_1.default)(fields.get('MSGID') === 'INIT', 'Actual original INIT response required');
    for (const key of ['AB', 'BD', 'BDD', 'CUR'])
        (0, strict_1.default)(fields.has(key) && fields.get(key) !== '', 'Actual Init field missing: ' + key);
    const response = Reflect.apply(parser, self, [nativeInitPayload.split('&')]);
    (0, strict_1.default)(!response.inRecovery, 'Own normal Init recovery path is not mapped');
    // A fresh connection cannot adopt a feature or promotional round already in progress.
    (0, strict_1.default)(!response.inFreeGames && !(response.numberFreeGames > 0) && !response.pickFeatureTrigger && !(response.freeGameTrigger > 0), 'Own normal Init has a pending feature');
    (0, strict_1.default)(!response.freeRounds.inFreeRounds && !(response.freeRounds.roundsRemaining > 0), 'Own normal Init promotional round is not mapped');
    finite(required(response, 'balance'), 'Init balance');
    const bets = required(response, 'betDefaults'), defaultBet = finite(required(response, 'betCurrentBetDefault'), 'Init default wager');
    (0, strict_1.default)(Array.isArray(bets) && bets.length > 0 && bets.every(n => typeof n === 'number' && Number.isFinite(n) && n > 0) && bets.includes(defaultBet), 'Actual native Init wager menu/default required');
    // Native Account stores an absent optional ABM as undefined; no ante choice or zero is invented.
    if (response.anteBetMultiples !== undefined)
        (0, strict_1.default)(Array.isArray(response.anteBetMultiples) && response.anteBetMultiples.every(n => typeof n === 'number' && Number.isFinite(n)), 'Actual native ante menu malformed');
    if (game.type === 1) {
        finite(required(required(config, 'payways'), 'activeReels'), 'active reels');
        (0, strict_1.default)(Array.isArray(response.payWayReelMultiplier), 'Actual Init RBM required');
    }
    else
        finite(required(required(config, 'lines'), 'activeLines'), 'active lines');
    const Account = native(accountDATA.functions.find(x => x.name === 'Account').source);
    self.account = Reflect.construct(Account, [free]);
    for (const row of parserDATA.accountSetup)
        (0, node_vm_1.runInContext)(row.source, context, { timeout: 1000 });
    self.serverResponse = response;
    const Init = native(accountDATA.functions.find(x => x.name === 'InitState').source), state = Reflect.construct(Init, ['INIT']);
    const exit = Reflect.apply(state.handleEvent, state, ['MSG', nativeInitPayload]);
    (0, strict_1.default)(exit === 0, 'Own normal Init did not complete');
    finite(self.account.getBalance(), 'native account balance');
    finite(self.account.getTotalBetAmount(), 'native current wager');
    const snapshot = () => Object.freeze({ balance: self.account.getBalance(), betPerLine: self.account.getCurrentBetPerLine(), activeLines: self.account.getNumPaylinesSelected(), activeReels: self.account.getNumReelsSelected(), superbet: self.account.superbet, betAdjustment: self.account.betAdjustment, totalBet: self.account.getTotalBetAmount() });
    return Object.freeze({ gameId: '32536', originalSessionScope, account: self.account, decodedNativeResponse: response,
        originalPayload: nativeInitPayload, nativeConfig: config, nativeInitExitCode: exit, nativeFreeRounds: free, nativeFreeRoundsSourceSHA256: ownFreeDATA.fragmentSHA256, nativeFreeRoundsAndParserShareRealm: true,
        selectOriginalCapturePerLine(value) { finite(value, 'original selected wager'); (0, strict_1.default)(bets.includes(value), 'Original selected wager not in actual Init menu'); self.account.setCurrentBetAmount(value); return snapshot(); },
        snapshot, sourceRequests: 0, providerACKClaimed: false, productionAdmission: false,
        originalFactorySuccessfulEnvelopeAssociationStillRequired: true });
}
