"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readOwn32536OriginalNativeReelstripDATA = readOwn32536OriginalNativeReelstripDATA;
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = require("node:vm");
const data = JSON.parse((0, node_fs_1.readFileSync)(new URL('../Gorilla-own-native-ReelstripParser-DATA/own32536-native-ReelstripParser-private.json', require('node:url').pathToFileURL(__filename)), 'utf8'));
const parsed = new WeakMap();
function readOwn32536OriginalNativeReelstripDATA({ sgSessionExports: sg, originalSessionScope: session }) {
    const init = sg.readOwnClassicGdmInitData(session);
    init.assertCurrent();
    (0, strict_1.default)(init.gameId === '32536' && init.originalSessionScope === session);
    const source = sg.readOwnClassicGdmReelstripSource(session), frame = source.read(session);
    (0, strict_1.default)(source.has(frame) && frame.sessionScope === session && frame.game === init.originalFactoryInitFrame.game && frame.step.msgId === 'REELSTRIP', 'Actual original REELSTRIP frame required');
    const prior = parsed.get(frame);
    if (prior) {
        prior.assertCurrent();
        return prior;
    }
    const context = (0, node_vm_1.createContext)({}), Parser = (0, node_vm_1.runInContext)('(' + data.row.source + ')', context, { timeout: 1000 }), parser = Reflect.construct(Parser, []);
    Reflect.apply(parser.processResponse, parser, [frame.step.responsePayload]);
    const sets = [];
    for (let i = 0; i < parser.getNumSets(); i++)
        sets.push(parser.getReelstripSet('RST_' + i));
    const current = () => { init.assertCurrent(); (0, strict_1.default)(source.has(frame) && source.read(session) === frame && sg.readOwnClassicGdmInitData(session) === init, 'Original REELSTRIP source revoked'); };
    const result = Object.freeze({ gameId: '32536', originalSessionScope: session, originalReelstripFrame: frame, originalNativeParser: parser, retainedSDKSourceSHA256: data.retainedSDKSourceSHA256, nativeReelstripSets: sets, assertCurrent: current, sourceRequests: 0, providerACKClaimed: false, productionAdmission: false });
    current();
    parsed.set(frame, result);
    return result;
}
