"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOwn32536NativeManifestConfigFromOriginalAGDATA = createOwn32536NativeManifestConfigFromOriginalAGDATA;
// Own manifest config is explicit protocol DATA selected by the original AG game contract.
// This producer does not run a browser wrapper or synthesize its response.
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = require("node:vm");
const base = new URL('../Gorilla-own-native-config-merge-DATA/', require('node:url').pathToFileURL(__filename));
const data = JSON.parse((0, node_fs_1.readFileSync)(new URL('own32536-native-config-merge-private.json', base), 'utf8'));
const row = name => { const found = data.rows.find(r => r.name === name); (0, strict_1.default)(found); return found; };
function createOwn32536NativeManifestConfigFromOriginalAGDATA({ originalSessionScope, originalFactoryInitSource }) {
    (0, strict_1.default)(originalSessionScope && originalFactoryInitSource && typeof originalFactoryInitSource.read === 'function' && typeof originalFactoryInitSource.has === 'function', 'Actual original Init source required');
    const frame = originalFactoryInitSource.read(originalSessionScope);
    (0, strict_1.default)(originalFactoryInitSource.has(frame) && frame.sessionScope === originalSessionScope, 'Actual original Init scope revoked');
    const game = frame.game, contract = game?.sg?.ownNativeManifestConfig;
    (0, strict_1.default)(game?.gameId === '32536' && game.sg.ownGDMContract?.ownSDKFileSHA256 === data.retainedSDKSourceSHA256, 'Own original game/SDK scope changed');
    (0, strict_1.default)(contract?.kind === 'own-release-manifest-protocol-DATA-v1' && contract.gameId === '32536' && contract.manifestSHA256 === data.manifestInputSHA256 && contract.ownSDKFileSHA256 === data.retainedSDKSourceSHA256, 'Explicit own AG manifest DATA contract required');
    (0, strict_1.default)(contract.language === data.originalGdmLanguage && frame.requestBody.includes('<lang>' + contract.language + '</lang>'), 'Actual original GDM language changed');
    // This explicit original-AG protocol DATA contract selects the own manifest release.
    // No browser wrapper executes in this factory and no GET_CONFIG_FILE response is fabricated.
    (0, strict_1.default)(!Object.hasOwn(contract, 'actualWrapperExternalConfigValue'), 'An AG manifest contract is not a browser wrapper response');
    const bodies = data.inputs.map((item, index) => { (0, strict_1.default)(item.manifestIndex === index && item.relative === data.manifest.config[index], 'Own manifest config order changed'); return (0, node_fs_1.readFileSync)(new URL(item.inputFile, base), 'utf8'); });
    const warnings = [], context = (0, node_vm_1.createContext)({ console: { warn: message => warnings.push(String(message)) } });
    // Original jQuery lexical bindings used by these selected native functions, in their own realm.
    (0, node_vm_1.runInContext)('var n=[],i=Object.getPrototypeOf,l={},c=l.toString,f=l.hasOwnProperty,p=f.toString,d=p.call(Object),w={},$=w,NOVA={};', context);
    for (const name of ['jqueryIsFunction', 'jqueryIsPlainObject', 'jqueryExtend', 'jqueryExtendExt', 'stripComments', 'stripBars', 'loadConfig']) {
        context[name] = (0, node_vm_1.runInContext)('(' + row(name).source + ')', context, { timeout: 1000 });
    }
    (0, node_vm_1.runInContext)('var g=jqueryIsFunction;w.isFunction=g;w.isArray=Array.isArray;w.isPlainObject=jqueryIsPlainObject;w.extend=jqueryExtend;w.extendext=jqueryExtendExt;w.parseJSON=JSON.parse;var defaultConfig={};', context);
    (0, strict_1.default)(data.configInitializer.source === 'this.config={}');
    (0, node_vm_1.runInContext)('(function(){' + data.configInitializer.source + ';}).call(NOVA);', context);
    let completed = 0, fetches = 0;
    context.self = { manifest: data.manifest, fetchConfigs(id, callback) { (0, strict_1.default)(id === 'config' && fetches++ === 0, 'Own one native config load required'); Reflect.apply(callback, undefined, [bodies, data.manifest.config.findIndex(s => s.includes('language'))]); } };
    Reflect.apply(context.loadConfig, context.self, ['config', () => { completed++; }]);
    (0, strict_1.default)(completed === 1 && fetches === 1 && warnings.length === 0, 'Own native config loader did not fully parse all inputs');
    (0, strict_1.default)(originalFactoryInitSource.has(frame), 'Original Init scope revoked during native config merge');
    return Object.freeze({ gameId: '32536', sessionScope: originalSessionScope, originalInitFrame: frame, originalAGManifestContract: contract, config: context.NOVA.config,
        nativeConfigInitializer: data.configInitializer, manifestInputCount: bodies.length, ownConfigInputRecords: data.inputs,
        ownNativeLoaderFragmentSHA256: row('loadConfig').fragmentSHA256, sourceRequests: 0, providerACKClaimed: false, productionAdmission: false,
        originalSuccessfulInitSourceFrameAssociated: true, actualProviderACKStillUnproved: true });
}
