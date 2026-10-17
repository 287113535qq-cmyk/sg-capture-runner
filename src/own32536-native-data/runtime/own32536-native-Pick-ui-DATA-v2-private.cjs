"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachOwn32536NativePickUIDATA = attachOwn32536NativePickUIDATA;
// Own Island/NovaButton source chooses a legal native button; drawing endpoints do not choose protocol state or money.
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = require("node:vm");
const read = rel => JSON.parse((0, node_fs_1.readFileSync)(new URL('../' + rel, require('node:url').pathToFileURL(__filename)), 'utf8'));
const ui = read('Gorilla-own-native-Pick-ui-DATA/own32536-native-Pick-ui-private.json'), buttons = read('Gorilla-own-native-Pick-button-DATA/own32536-native-Pick-button-private.json');
(0, strict_1.default)(ui.retainedSDKSourceSHA256 === buttons.retainedSDKSourceSHA256);
const noop = () => { };
function attachOwn32536NativePickUIDATA({ nativeEnvironment: e, nativeContext: context, nativeModel: model, nativeController: controller, scheduleNativeCallback: later, assertCurrent }) {
    const compile = source => (0, node_vm_1.runInContext)('(' + source + ')', context, { timeout: 1000 }), row = name => { const r = ui.rows.find(r => r.name === name); (0, strict_1.default)(r); return r; };
    const roots = new Map(), ownedButtons = new WeakSet(), realButtons = [], islandInfos = [], attempted = new WeakSet(), selections = [];
    function display() {
        const children = [], handlers = new Map();
        const d = { visible: true, alpha: 1, x: 0, y: 0, width: 1, height: 1, children, parent: null, scale: { x: 1, y: 1, set(x, y = x) { this.x = x; this.y = y; } }, anchor: { set: noop }, position: { set(x, y) { d.x = x; d.y = y; } },
            addChild(child) { (0, strict_1.default)(child && typeof child === 'object'); if (child.parent)
                child.parent.removeChild(child); children.push(child); child.parent = this; return child; },
            addChildAt(child, index) { this.addChild(child); children.splice(children.indexOf(child), 1); children.splice(index, 0, child); return child; }, removeChild(child) { const at = children.indexOf(child); if (at >= 0)
                children.splice(at, 1); if (child?.parent === this)
                child.parent = null; return child; }, removeChildAt(index) { return this.removeChild(children[index]); }, removeChildren() { for (const child of children.splice(0))
                child.parent = null; }, getChildAt(index) { (0, strict_1.default)(children[index], 'Actual native display child missing'); return children[index]; },
            on(event, callback) { (0, strict_1.default)(typeof callback === 'function'); handlers.set(event, callback); return this; }, emit(event, value) { (0, strict_1.default)(handlers.has(event)); return handlers.get(event)(value); },
            setPositionXY(x, y) { this.x = x; this.y = y; }, setPosition({ x, y }) { this.x = x; this.y = y; }, destroy() { if (this.parent)
                this.parent.removeChild(this); this.removeChildren(); }, refreshText: noop, updateTexture: noop, gotoAndStop: noop, gotoAndPlay: noop, animate: noop, finishAnim: noop, setValue: noop, snapTo: noop, show: noop, hide: noop, rollup: noop, setTuneDelay: noop, resetTuneDelay: noop, addKeyListener: noop, addTestListener: noop };
        return d;
    }
    const Timeline = e.TimelineMax;
    e.TimelineMax = function (...args) { const timeline = Reflect.construct(Timeline, args); timeline.to = noop; return timeline; };
    e.NovaDisplayObject = e.NovaContainer = e.NovaTextBox = e.NovaMovieClip = function () { Object.assign(this, display()); };
    e.NovaTexture = { fromFrame: () => ({}) };
    e.calcHitPolygon = () => ({});
    e.PIXI = { BLEND_MODES: { ADD: 1 }, DEG_TO_RAD: Math.PI / 180 };
    e.Linear = { easeNone: undefined };
    e.Power2 = { easeInOut: undefined, easeIn: undefined };
    const nativeButton = compile(buttons.rows[0].source);
    nativeButton.prototype.createFooTextures = () => [{}]; // Drawing-only transparent texture, never an index/win/next selector.
    e.NovaButton = function (...args) { const b = Reflect.construct(nativeButton, args); ownedButtons.add(b); realButtons.push(b); return b; };
    e.NOVA.buttonEvent = (callback, value) => { (0, strict_1.default)(typeof callback === 'function'); callback(value); };
    e.NOVA.getSprite = () => display();
    e.NOVA.getContainer = name => { if (!roots.has(name))
        roots.set(name, display()); return roots.get(name); };
    e.NOVA.addToContainer = (name, child) => e.NOVA.getContainer(name).addChild(child);
    e.NOVA.removeFromContainer = (name, child) => e.NOVA.getContainer(name).removeChild(child);
    e.NOVA.isHD = () => true;
    e.NOVA.isWebGL = false;
    // Native loaders here complete presentation only. No provider body, protocol ACK or network response is made.
    e.DynamicLoader = function (refs) { (0, strict_1.default)(Array.isArray(refs) && refs.every(ref => typeof ref === 'string')); this.complete = noop; };
    e.NOVA.dynamicLoad = (loader, callback) => { (0, strict_1.default)(loader && typeof loader.complete === 'function' && typeof callback === 'function'); later(0, callback); };
    e.IslandGlyphSet = function () { Object.assign(this, display()); };
    const infoCtor = compile(row('IslandInfo').source);
    e.IslandInfo = function (...args) { const info = Reflect.construct(infoCtor, args); islandInfos.push(info); return info; };
    e.panelGfx = new Array(9);
    e.levelLoaded = false;
    e.rezString = '_hd';
    e.loader = {};
    for (const name of ['initPanelGFX', 'getPanelGFX', 'loadAssets'])
        controller[name] = compile(row(name).source);
    const PickFeature = compile(row('PickFeature').source), PickSummary = compile(row('PickSummaryAnim').source), Island = compile(row('Island_main').source);
    e.pickFeature = Reflect.construct(PickFeature, []);
    e.pickSummaryAnim = Reflect.construct(PickSummary, []);
    e.pickSummaryAnim.init(model.fireEvent);
    e.island_main = controller.island_main = Reflect.construct(Island, []);
    controller.initPanelGFX();
    controller.featureTransition = { play: noop };
    controller.tweenHelper = { reelsTween: noop };
    controller.operator = 'default';
    Object.assign(controller.gorillaAnims, { playPresent: noop, show: noop });
    Object.assign(e.gameSound, { playAmbientPickScreen: noop });
    Object.assign(model.ui, { setPaylineActiveLines: noop, toggleFeaturePageVisibility: noop, showSpinGroup: noop });
    controller.backgroundAnims = { backgroundManager: { getCurrentBGObjectInfo: () => undefined }, changeBG(id) {
            const env = (0, node_vm_1.createContext)({ ...e, bgIds: [id] }), post = (0, node_vm_1.runInContext)('(' + row('postBGChange').source + ')', env, { timeout: 1000 });
            later(0, () => Reflect.apply(post, { startAnimation: noop }, [0]));
        } };
    function click(button) { assertCurrent(); (0, strict_1.default)(ownedButtons.has(button) && button.enabled === true && button.interactive === true, 'Actual enabled native button required'); button.emit('mousedown', {}); button.emit('mouseup', {}); }
    return Object.freeze({
        advanceShellControl() {
            assertCurrent();
            if (controller.features.FID !== 9)
                return false;
            const button = realButtons.find(button => button.cfg?.key === 'closePanel' && button.enabled === true && typeof button.buttonUpAction === 'function');
            if (!button)
                return false;
            click(button);
            return true;
        },
        advanceLegalSelection() {
            assertCurrent();
            if (model.stateNames[model.currentState] !== 'FEATURE_PRE_PICK' || !e.island_main.initialized)
                return false;
            const info = islandInfos.find(info => !attempted.has(info) && info.displayObject?.btnRef?.enabled === true);
            if (!info)
                return false;
            attempted.add(info);
            click(info.displayObject.btnRef);
            const play = realButtons.find(button => button.novaName === 'PlayBtn'), foreground = roots.get('GAME_FOREGROUND');
            if (play?.parent?.parent === foreground) {
                if (play.enabled) {
                    (0, strict_1.default)(e.island_main.selectedFeature === info);
                    selections.push({ nativeFeatureId: info.featureId, nativeIslandButton: info.displayObject.btnRef, nativePlayButton: play });
                    click(play);
                }
                else {
                    const close = play.parent.children.find(button => ownedButtons.has(button) && button !== play);
                    (0, strict_1.default)(close, 'Native disabled island needs actual close control');
                    click(close);
                }
            }
            return true;
        },
        close() { for (const button of realButtons)
            button.enable(false); },
        readSelections() { return selections.slice(); },
        sourceOnly: true, productionAdmission: false
    });
}
