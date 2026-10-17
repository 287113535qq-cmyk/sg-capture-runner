"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachOwn32536NativeReelManagerDATA = attachOwn32536NativeReelManagerDATA;
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = require("node:vm");
const source = JSON.parse((0, node_fs_1.readFileSync)(new URL('../Gorilla-own-native-ReelManager-DATA/own32536-native-ReelManager-private.json', require('node:url').pathToFileURL(__filename)), 'utf8'));
function attachOwn32536NativeReelManagerDATA({ nativeManager, originalSessionScope, nativeReelstripData, nativeGameConfig }) {
    nativeReelstripData.assertCurrent();
    (0, strict_1.default)(nativeReelstripData.originalSessionScope === originalSessionScope && nativeReelstripData.retainedSDKSourceSHA256 === source.retainedSDKSourceSHA256);
    const count = nativeGameConfig.reels.reels;
    (0, strict_1.default)(Number.isSafeInteger(count) && count > 0, 'Actual native reel model count required');
    const current = () => nativeReelstripData.assertCurrent();
    // These view endpoints retain native strip references. They do not supply symbol IDs, wins or next/end decisions.
    const views = Array.from({ length: count }, () => ({ strip: undefined, setReelStrip(strip) { (0, strict_1.default)(Array.isArray(strip), 'Actual selected native strip required'); this.strip = strip; } }));
    nativeManager.reelsArray = views;
    nativeManager.reelStrips = [];
    const context = (0, node_vm_1.createContext)({});
    for (const row of source.rows) {
        const fn = (0, node_vm_1.runInContext)('(' + row.source + ')', context, { timeout: 1000 });
        nativeManager[row.name] = (...args) => { current(); return Reflect.apply(fn, nativeManager, args); };
    }
    for (const set of nativeReelstripData.nativeReelstripSets)
        nativeManager.addReelstripSet(set);
    nativeManager.enableSymbolPass = () => { };
    nativeManager.getSymbolID = () => undefined; // Optional display lookup; no fabricated protocol symbol.
    return Object.freeze({ nativeManager, nativeViews: views, assertCurrent: current, sourceRequests: 0, productionAdmission: false });
}
