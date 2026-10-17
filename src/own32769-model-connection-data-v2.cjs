"use strict";
function hold(reason, missing = []) {
  const error = new Error("Own 32769 model DATA hold: " + reason);
  error.code = "OWN32769_MODEL_DATA_HOLD";
  error.reason = reason;
  error.missing = Object.freeze(missing.slice());
  return error;
}
function reference(value) {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function inspectOwn32769MainInputs(main, types) {
  const missing = [];
  const object = (value, name) => {
    if (!reference(value)) missing.push(name);
  };
  const method = (value, name, label) => {
    if (!reference(value) || typeof value[name] !== "function")
      missing.push(label + "." + name);
  };
  object(main, "originalMain");
  object(types, "nativeTypes");
  if (!reference(main) || !reference(types)) return Object.freeze(missing);
  for (const name of [
    "backgroundContainer", "slotContainer", "uiContainer", "gaffContainer",
    "featureContainer", "transitionContainer", "bigWinContainer",
    "baseBundle", "audioController", "translator", "currencyFormatter",
    "background", "orientationController", "metaData", "uiController",
    "partnerAdapter", "loader", "glsRequestor", "createjs_stage"
  ]) object(main[name], "Main." + name);
  if (typeof main.scalar !== "number" || !Number.isFinite(main.scalar))
    missing.push("Main.actualScalar");
  for (const name of [
    "initToPartnerAutoplay", "isHistoryReplay", "addStats", "createStats"
  ]) method(main, name, "Main");
  if (main.onInitResponse !== types.onInitResponse)
    missing.push("Main.sameNativeOnInitResponse");
  if (main.loadGame !== types.loadGame)
    missing.push("Main.sameNativeLoadGame");
  for (const name of ["getRequestObject", "configure", "getEvents"])
    method(main.glsRequestor, name, "Main.glsRequestor");
  method(main.currencyFormatter, "setData", "Main.currencyFormatter");
  method(main.partnerAdapter, "receivedGameLogicResponse", "Main.partnerAdapter");
  method(main.partnerAdapter, "hideProgressBar", "Main.partnerAdapter");
  const partnerFormatter = main.partnerAdapter &&
    main.partnerAdapter.logics && main.partnerAdapter.logics.currencyFormatter;
  method(
    partnerFormatter, "setFormatting",
    "Main.partnerAdapter.logics.currencyFormatter"
  );
  for (const name of [
    "setLogic", "topMeterUpdate", "setBetController",
    "onInitResponse", "showStagePreloader"
  ]) method(main.uiController, name, "Main.uiController");
  method(
    main.orientationController, "updateCanvasAndAssets",
    "Main.orientationController"
  );
  method(main.orientationController, "getEvents", "Main.orientationController");
  method(main.audioController, "getRef", "Main.audioController");
  method(main.metaData, "isGaffingEnabled", "Main.metaData");
  const ns = types.namespace;
  object(ns, "ownNativeNamespace");
  if (reference(ns)) {
    for (const name of ["SymbolAnimationsController", "BigWinController"])
      if (typeof ns[name] !== "function")
        missing.push("ownNamespace." + name);
    method(ns.SlotFactory, "createSlot", "ownNamespace.SlotFactory");
    method(ns.Utils, "createContainer", "ownNamespace.Utils");
    object(ns.Config, "ownNamespace.Config");
    for (const mode of ["PickBonusLS", "PickBonusPT"]) {
      object(ns[mode], "ownNamespace." + mode);
      for (const name of [
        "init", "getQueueLoader", "getPickBtns", "reset", "setIntroTxt"
      ]) method(ns[mode], name, "ownNamespace." + mode);
    }
  }
  object(types.glscomms, "actualNativeGLSModule");
  object(types.createjs, "actualCreateJSModule");
  object(types.TweenLite, "actualTweenLite");
  object(types.TweenMax, "actualTweenMax");
  return Object.freeze(missing);
}

const pickHooks = new WeakMap();
function observeOwn32769PickBinding({logic, nativeTypes, onBound}) {
  if (!reference(nativeTypes) || typeof nativeTypes.Logic !== "function" ||
      !(logic instanceof nativeTypes.Logic) || typeof onBound !== "function")
    throw hold("ACTUAL_NATIVE_LOGIC_AND_OBSERVER_REQUIRED");
  if (pickHooks.has(logic))
    throw hold("PICK_BINDING_OBSERVER_ALREADY_INSTALLED");
  const native = logic.setPickBonus;
  if (native !== nativeTypes.Logic.prototype.setPickBonus)
    throw hold("NATIVE_SET_PICK_METHOD_CHANGED");
  const previous = Object.getOwnPropertyDescriptor(logic, "setPickBonus");
  const wrapped = function (...args) {
    const value = Reflect.apply(native, this, args);
    const picker = args[0];
    if (this !== logic || !(picker instanceof nativeTypes.PickBonus) ||
        logic.pickBonus !== picker)
      throw hold("ORIGINAL_PICK_BINDING_CHANGED");
    // The native setPickBonus has returned. Bonus.pickLoaded has not yet
    // continued into playTransition/start/initPickScreen on this call stack.
    onBound(Object.freeze({
      logic, picker, requestor: logic.glsRequestor,
      nativeFunction: native, returnedValue: value
    }));
    return value;
  };
  Object.defineProperty(logic, "setPickBonus", {
    value: wrapped, writable: true, configurable: true, enumerable: false
  });
  pickHooks.set(logic, wrapped);
  return function remove() {
    if (logic.setPickBonus !== wrapped)
      throw hold("PICK_BINDING_OBSERVER_REPLACED");
    if (previous) Object.defineProperty(logic, "setPickBonus", previous);
    else delete logic.setPickBonus;
    pickHooks.delete(logic);
  };
}

function createOwn32769ModelConnectionData({
  sgSessionExports, nativeTypes, originalMainSource, onActualPickBound
}) {
  if (!reference(sgSessionExports) ||
      typeof sgSessionExports.readOwn32769ConsumedInitData !== "function")
    throw hold("SAME_ACTUAL_SG_MODULE_EXPORTS_REQUIRED");
  if (!reference(originalMainSource) ||
      typeof originalMainSource.read !== "function" ||
      typeof originalMainSource.has !== "function")
    throw hold("ACTUAL_ORIGINAL_MAIN_SOURCE_REQUIRED");
  if (typeof onActualPickBound !== "function")
    throw hold("ACTUAL_ROUND_OBSERVER_HANDOFF_REQUIRED");
  const attempts = new WeakMap();
  let activeInitialization;
  if (typeof nativeTypes.observeLogicConstruction !== "function")
    throw hold("NATIVE_LOGIC_CONSTRUCTION_BOUNDARY_REQUIRED");
  const removeConstructionObserver = nativeTypes.observeLogicConstruction(logic => {
    const active = activeInitialization;
    if (!active) return;
    const {session, initData, frame, attempt} = active;
    if (attempt.logic) throw hold("MULTIPLE_NATIVE_LOGIC_CONSTRUCTORS");
    attempt.logic = logic;
    attempt.removePickObserver = observeOwn32769PickBinding({
      logic, nativeTypes,
      onBound(binding) {
        if (readInit(session) !== initData ||
            !originalMainSource.has(frame) ||
            frame.requestor !== frame.main.glsRequestor)
          throw hold("ORIGINAL_SCOPE_REVOKED_BEFORE_PICK_BINDING");
        onActualPickBound(Object.freeze({
          sessionScope: session, initData, originalMainFrame: frame,
          main: frame.main, bonus: logic.bonus,
          betController: logic.bonus && logic.bonus.betController, ...binding
        }));
      }
    });
  });

  function readInit(session) {
    const value = sgSessionExports.readOwn32769ConsumedInitData(session);
    if (!value || value.kind !== "actual-normal-Init-protocol-DATA-only" ||
        value.sessionScope !== session || !reference(value.request) ||
        value.request.nativeGameId !== "20135")
      throw hold("CURRENT_OWN_NATIVE_INIT_REQUIRED");
    return value;
  }
  return Object.freeze({
    initialize(session) {
      if (!reference(session)) throw hold("ACTUAL_SESSION_REQUIRED");
      const initData = readInit(session);
      const frame = originalMainSource.read(session, initData);
      if (!originalMainSource.has(frame) ||
          frame.sessionScope !== session || frame.initData !== initData ||
          frame.nativeTypes !== nativeTypes)
        throw hold("ORIGINAL_MAIN_FRAME_NOT_CURRENT");
      const previous = attempts.get(session);
      if (previous) {
        if (previous.initData !== initData) throw hold("INIT_BINDING_CHANGED");
        if (previous.phase === "returned") {
          if (frame !== previous.frame ||
              !originalMainSource.has(previous.frame) ||
              frame.requestor !== previous.requestor ||
              frame.main.glsRequestor !== previous.requestor)
            throw hold("CURRENT_MAIN_FRAME_OR_REQUESTOR_CHANGED");
          return previous.result;
        }
        if (previous.phase === "failed") throw previous.error;
        throw hold("REENTRANT_MODEL_INITIALIZATION");
      }
      const main = frame.main;
      const missing = inspectOwn32769MainInputs(main, nativeTypes);
      if (missing.length) throw hold("ACTUAL_MAIN_INPUTS_MISSING", missing);
      if (frame.requestor !== main.glsRequestor)
        throw hold("ORIGINAL_MAIN_REQUESTOR_BINDING_CHANGED");
      if (initData.parsed.getPlatformData().getIsRecovering() !== false)
        throw hold("RECOVERY_MODEL_PATH_NOT_DELIVERED");
      if (main.isHistoryReplay() !== false)
        throw hold("HISTORY_MODEL_PATH_NOT_DELIVERED");
      if (main.logic !== undefined || main.slot !== undefined)
        throw hold("ORIGINAL_MAIN_ALREADY_INITIALIZED");

      if (activeInitialization)
        throw hold("REENTRANT_NATIVE_MAIN_INITIALIZATION");
      const attempt = {
        phase: "calling", initData, frame, requestor: main.glsRequestor
      };
      activeInitialization = {session, initData, frame, attempt};
      attempts.set(session, attempt);
      try {
        // Original currency formatting/configure -> loadGame order.
        // No Init request is sent by this connector.
        Reflect.apply(nativeTypes.onInitResponse, main, [initData.parsed]);
        if (readInit(session) !== initData || !originalMainSource.has(frame))
          throw hold("ORIGINAL_INIT_OR_MAIN_REVOKED_DURING_INITIALIZATION");
        const logic = main.logic;
        if (!(logic instanceof nativeTypes.Logic) ||
            !(logic.bonus instanceof nativeTypes.Bonus) ||
            !(logic.bonus.betController instanceof nativeTypes.BetController) ||
            logic.bonus.gameData !== initData.parsed.getGameData() ||
            logic.glsRequestor !== main.glsRequestor ||
            logic.slot !== main.slot)
          throw hold("NATIVE_MODEL_GRAPH_BINDING_CHANGED");
        if (attempt.logic !== logic ||
            typeof attempt.removePickObserver !== "function")
          throw hold("ORIGINAL_LOGIC_CONSTRUCTION_NOT_OBSERVED");
        const removePickObserver = attempt.removePickObserver;
        const result = Object.freeze({
          kind: "original-native-Main-model-connection-DATA-only",
          sessionScope: session, initData, originalMainFrame: frame,
          main, logic, bonus: logic.bonus,
          betController: logic.bonus.betController,
          slot: main.slot, requestor: main.glsRequestor,
          removePickObserver
        });
        attempt.phase = "returned";
        attempt.result = result;
        return result;
      } catch (error) {
        // Preserve all partial native side effects; do not rerun the call.
        attempt.phase = "failed";
        attempt.error = error;
        throw error;
      } finally {
        activeInitialization = undefined;
      }
    },
    disposeConstructionObserver: removeConstructionObserver
  });
}
module.exports = Object.freeze({
  inspectOwn32769MainInputs, observeOwn32769PickBinding,
  createOwn32769ModelConnectionData
});

