"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.own32536OriginalAGManifestConfigContract = own32536OriginalAGManifestConfigContract;
exports.bindOwn32536OriginalAGNativeInitDATA = bindOwn32536OriginalAGNativeInitDATA;
// Same original SG module owns transport/envelope/frame lifetime. Only own protocol DATA is registered here.
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = require("node:vm");
const own32536_config_original_AG_manifest_DATA_v2_private_cjs_1 = require("./own32536-config-original-AG-manifest-DATA-v2-private.cjs");
const own32536_native_Init_account_with_native_FreeRounds_v3_private_cjs_1 = require("./own32536-native-Init-account-with-native-FreeRounds-v3-private.cjs");
const read = rel => JSON.parse((0, node_fs_1.readFileSync)(new URL('../' + rel, require('node:url').pathToFileURL(__filename)), 'utf8'));
const configDATA = read('Gorilla-own-native-config-merge-DATA/own32536-native-config-merge-private.json');
const currencyDATA = read('Gorilla-own-native-Currency-DATA/own32536-native-Currency-private.json');
const trimDATA = read('Gorilla-own-native-Currency-DATA/own32536-native-currency-trim-private.json');
(0, strict_1.default)(currencyDATA.retainedSDKSourceSHA256 === configDATA.retainedSDKSourceSHA256);
function own32536OriginalAGManifestConfigContract() {
    return Object.freeze({ kind: 'own-release-manifest-protocol-DATA-v1', gameId: '32536', language: configDATA.originalGdmLanguage, ownSDKFileSHA256: configDATA.retainedSDKSourceSHA256, manifestSHA256: configDATA.manifestInputSHA256 });
}
function bindOwn32536OriginalAGNativeInitDATA({ sgSessionExports }) {
    (0, strict_1.default)(sgSessionExports && typeof sgSessionExports.bindOwnClassicGdmInitDataFactory === 'function' && typeof sgSessionExports.readOwnClassicGdmInitData === 'function', 'Same actual original SG module exports required');
    return sgSessionExports.bindOwnClassicGdmInitDataFactory('32536', (session, source) => {
        const frame = source.read(session);
        (0, strict_1.default)(source.has(frame) && frame.sessionScope === session, 'Actual original Init frame required');
        const configRecord = (0, own32536_config_original_AG_manifest_DATA_v2_private_cjs_1.createOwn32536NativeManifestConfigFromOriginalAGDATA)({ originalSessionScope: session, originalFactoryInitSource: source });
        (0, strict_1.default)(configRecord.originalInitFrame === frame, 'Own native config changed its original Init source');
        const observations = [];
        // Native observations retain their actual values; they neither choose a wager nor add validation equations.
        const metrics = Object.freeze({ setFROptions: value => observations.push({ event: 'setFROptions', value }), setCurrencyCode: value => observations.push({ event: 'setCurrencyCode', value }), takeBet: value => observations.push({ event: 'takeBet', value }), addWin: value => observations.push({ event: 'addWin', value }) });
        const context = (0, node_vm_1.createContext)({ METRICS: metrics, NOVA: { config: configRecord.config, languageCode: configDATA.originalGdmLanguage } });
        (0, node_vm_1.runInContext)('var ' + trimDATA.regexBindingSource + ';', context);
        context.$ = { trim: (0, node_vm_1.runInContext)('(' + trimDATA.source + ')', context, { timeout: 1000 }) };
        const Currency = (0, node_vm_1.runInContext)('(' + currencyDATA.row.source + ')', context, { timeout: 1000 });
        const currency = Reflect.construct(Currency, []);
        const native = (0, own32536_native_Init_account_with_native_FreeRounds_v3_private_cjs_1.initializeOwn32536NativeAccountWithNativeFreeRounds)({ originalSessionScope: session, nativeInitPayload: frame.step.responsePayload, actualNativeConfig: configRecord.config, actualCurrency: currency, actualMetrics: metrics });
        if (frame.game.sg.requestParams?.BPL !== undefined)
            native.selectOriginalCapturePerLine(frame.game.sg.requestParams.BPL);
        (0, strict_1.default)(native.account.getBalance() === Number(frame.decoded.AB), 'Native and original Init account changed');
        (0, strict_1.default)(native.account.getTotalBetAmount() === frame.game.sg.betRaw, 'Original AG selected wager does not match the current native account');
        const current = () => { (0, strict_1.default)(source.has(frame) && source.read(session) === frame, 'Original Init scope revoked'); return native; };
        return Object.freeze({ kind: 'own32536-original-AG-native-Init-model-DATA-only', gameId: '32536', originalSessionScope: session, originalFactoryInitFrame: frame,
            nativeInitAccount: native, nativeFreeRounds: native.nativeFreeRounds, nativeCurrency: currency, nativeConfigRecord: configRecord, nativeMetrics: metrics, nativeMetricObservations: observations,
            assertCurrent() { current(); }, snapshot() { return current().snapshot(); },
            originalTransportEnvelopeAndRawWireOwnedBySGModule: true, browserWrapperResponseFabricated: false, nativeNextEndGraphReady: false,
            sourceRequests: 0, providerACKClaimed: false, productionAdmission: false, independentFinalCredit: 0 });
    });
}
