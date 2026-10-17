"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOwn32536NativeLineCallbacksDATA = createOwn32536NativeLineCallbacksDATA;
// Exact native WinManager -> WinSequence -> payline callback path; line drawing remains a display sink.
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = require("node:vm");
const data = JSON.parse((0, node_fs_1.readFileSync)(new URL('../Gorilla-own-native-line-callback-DATA/own32536-native-line-callbacks-private.json', require('node:url').pathToFileURL(__filename)), 'utf8'));
const row = name => { const result = data.rows.find(r => r.name === name); (0, strict_1.default)(result); return result.source; };
function createOwn32536NativeLineCallbacksDATA({ nativeConfig, nativeEnums, nativeReelManager, nativeTweenMax, nativeSound, createLineDisplay, createContainerDisplay }) {
    (0, strict_1.default)(nativeConfig.game.type === nativeEnums.winSequence.PAYLINE, 'Own payline callback dependency required');
    (0, strict_1.default)(Array.isArray(nativeConfig.lines.lines) && Number.isSafeInteger(nativeConfig.game.reels.reels), 'Actual own native line/reel configuration required');
    const noop = () => { }, environment = { NOVA: { config: nativeConfig }, ENUM: nativeEnums, TweenMax: nativeTweenMax, SOUND: nativeSound, console };
    const context = (0, node_vm_1.createContext)(environment), compile = source => (0, node_vm_1.runInContext)('(' + source + ')', context, { timeout: 1000 });
    const factory = compile(`function(input){${data.initializationSource}
  reelConfig=input.config.game.reels;lineConfig=input.config.lines;linesContainer=input.container;linesMask=input.mask;lines=input.lines;
  this.showLine=input.display;this.showLines=input.display;this.resetLinesMask=input.display;this.startWin=input.display;
  this.processWinSegments=(${row('Payline.processWinSegments')});this.setWins=(${row('Payline.setWins')});this.speedFlash=(${row('Payline.speedFlash')});this.reset=(${row('Payline.reset')});
 }`);
    const lineObject = Reflect.construct(factory, [{ config: nativeConfig, container: createContainerDisplay(), mask: createContainerDisplay(), lines: nativeConfig.lines.lines.map(() => createLineDisplay()), display: noop }]);
    const sequence = { type: nativeConfig.game.type, winSequenceObject: lineObject };
    sequence.strumLines = compile(row('WinSequence.strumLines'));
    sequence.setWins = compile(row('WinSequence.setWins'));
    const managerContext = (0, node_vm_1.createContext)({ ...environment, reelManager: nativeReelManager, winSequence: sequence, numReels: nativeConfig.game.reels.reels, serverResponceWins: undefined, winsArray: undefined, winCombinations: undefined, totalWin: undefined, fiveOfKind: undefined });
    const manager = {};
    managerContext.self = manager;
    manager.setWinCombinations = (0, node_vm_1.runInContext)('(' + row('WinManager.setWinCombinations') + ')', managerContext, { timeout: 1000 });
    manager.strumLines = (0, node_vm_1.runInContext)('(' + row('WinManager.strumLines') + ')', managerContext, { timeout: 1000 });
    return Object.freeze({ setWinCombinations: wins => Reflect.apply(manager.setWinCombinations, manager, [wins]), strumLines: callback => Reflect.apply(manager.strumLines, manager, [callback]), reset: () => Reflect.apply(lineObject.reset, lineObject, []), nativeSourceSHA256: data.retainedSDKSourceSHA256, sourceRequests: 0, productionAdmission: false });
}
