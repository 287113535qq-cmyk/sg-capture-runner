"use strict";

function installOwn32769NativeFreeFeaturePorts({
  ns, runtime, slot, ui, bundle, audio, translator, formatter, orientation,
  initData, featureContainer, record, queue
}) {
  function hold(reason) {
    const error = new Error("AG integrity: own32769 native free port " + reason);
    error.code = "OWN32769_NATIVE_FREE_PORT_HOLD";
    error.reason = reason;
    throw error;
  }

  let logic, freeSpin, topMeter, groupIndex, models;
  const actors = Array.from(
    {length: ns.Config.NUMBER_OF_REELS},
    () => Array.from(
      {length: ns.Config.SYMBOLS_IN_REEL},
      () => new runtime.createjs.Container()
    )
  );
  const group = {
    getController(index) {
      if (!models || !Number.isSafeInteger(index) || !models[index])
        hold("ACTUAL_NATIVE_REEL_LAYOUT_REQUIRED");
      return {getLayout: () => models[index].layout};
    }
  };
  const pulse = {
    getSctterResult(value) {
      record("free.scatterResult", [value]);
    },
    start(...args) {
      record("free.scatterPulse", args);
    },
    clearSymbols() {
      record("free.clearSymbols", []);
    }
  };
  const symbol = new ns.SymbolAnimationController(
    group, audio, featureContainer,
    Array.from({length: ns.Config.NUMBER_OF_REELS}, () => null),
    pulse, ns.Config.SCALAR, ui
  );

  const previousStop = slot.setStopPositions;
  const previousGroup = slot.changeReelSet;
  slot.getSymbolAnimationController = () => symbol;
  slot.getReelGroup = () => group;

  slot.changeReelSet = function(index) {
    if (!Number.isSafeInteger(index))
      hold("ACTUAL_NATIVE_REEL_GROUP_ID_REQUIRED");
    groupIndex = index;
    return Reflect.apply(previousGroup, this, [index]);
  };

  slot.setStopPositions = function(stops, ...rest) {
    if (!logic || !Array.isArray(stops) ||
        stops.length !== ns.Config.NUMBER_OF_REELS)
      hold("ACTUAL_NATIVE_STOP_POSITIONS_REQUIRED");

    const index = groupIndex === undefined
      ? Number(logic.gameData.getCustomData().reelIndex)
      : groupIndex;
    const sourceGroup = initData.parsed.getGameData().getReelGroup(index);
    if (!sourceGroup) hold("ACTUAL_INIT_REEL_GROUP_REQUIRED");

    models = Array.from(stops, (stop, reelId) => {
      if (!Number.isSafeInteger(stop))
        hold("ACTUAL_INTEGER_REEL_STOP_REQUIRED");
      const sourceStrip = sourceGroup.getStrip(reelId);
      if (!sourceStrip) hold("ACTUAL_INIT_REEL_STRIP_REQUIRED");

      const strip = new ns.ownNativeReels.Strip(sourceStrip.getSymbols());
      const reel = new ns.ownNativeReels.Reel(
        stop, ns.ownNativeReelHomeIndex, ns.Config.SYMBOLS_IN_REEL, strip
      );
      const window = new Array(ns.Config.SYMBOLS_IN_REEL);
      reel.getSymbolWindow(window);
      if (Array.from(window).some(value => !Number.isSafeInteger(value)))
        hold("NATIVE_REEL_WINDOW_INCOMPLETE");

      const layout = {
        reel,
        symbolWindow: window,
        symbols: actors[reelId],
        getSymbolId: ns.ownNativeLayoutGetSymbolId,
        getSymbolActor: ns.ownNativeLayoutGetSymbolActor,
        setSymbol(position, id, order) {
          // Own native LTLayout.setSymbol changes its image, not symbolWindow.
          // The graphics port records the actual native replacement.
          record("feature.replaceSymbolImage", [reelId, position, id, order]);
        }
      };
      return {reel, layout};
    });
    return Reflect.apply(previousStop, this, [stops, ...rest]);
  };

  // These functions are the cached game's actual text-rendering boundary.
  ns.cjsAnim = ns.cjsAnim || {};
  for (const name of [
    "updateOutroBanner", "updateBonusReelsInPlay", "updatetFreeSpinsRem",
    "updateTotFreeSpins", "updateIntroTxt", "updateWinTxt",
    "updateRedEnvVal", "updateMaxWinTxt"
  ]) {
    ns.cjsAnim[name] = (...args) => record("cjsText." + name, args);
  }

  function nativeCallback(controller, name, args = []) {
    record("nativeCallback." + controller.constructor.name + "." + name, args);
    return Reflect.apply(
      Object.getPrototypeOf(controller)[name], controller, args
    );
  }

  return Object.freeze({
    afterLogicReady(actualLogic, gameFeature) {
      logic = actualLogic;
      const cycle = slot.getWinDisplayController().getCycleResults();
      cycle.checkisFreeGame = ns.ownNativeCycleFreeFlag;
      cycle.setResults = value => record("free.actualCycleResults", [value]);
      slot.getWinDisplayController().playScatterAnim =
        ns.ownNativePlayScatterAnim;

      // Native method uses its source-owned configured game result.
      const previousConfigure = slot.getWinDisplayController().configure;
      slot.getWinDisplayController().configure = function(value) {
        this.gameResults = value;
        this.cycleResults = cycle;
        return Reflect.apply(previousConfigure, this, [value]);
      };

      ui.betController = actualLogic.bonus.betController;
      if (!ui.betController)
        hold("ACTUAL_NATIVE_BET_CONTROLLER_REQUIRED");
      for (const name of ["setInFG", "redEnvUpdate"])
        ui[name] = (...args) => record("view." + name, args);

      const spinButton = new runtime.createjs.Container();
      const handle = {
        getOrientation: () => orientation,
        getFreeSpin: () => freeSpin,
        getAudioController: () => audio,
        gettranslator: () => translator,
        getBaseBundle: () => bundle,
        getScalar: () => ns.Config.SCALAR,
        getTopMeterCont: () => featureContainer,
        getSpinBtn: () => ({spinDbBtn: () => spinButton}),
        getTopMeter: () => topMeter,
        getDashBoard: () => ({
          dashboardFgMeterView: value =>
            record("view.dashboardFgMeterView", [value])
        }),
        getfgBg: () => ({
          fgIntroAnimStart() {
            record("view.freeBgIntro", []);
          },
          fgOutroAnimStart() {
            record("view.freeBgOutro", []);
          }
        })
      };

      // Native constructor and callback bodies stay unchanged.
      ns.TopMeterAnimController.prototype.createComponent = function() {
        this.anim_L = new runtime.createjs.Container();
        this.anim_P = new runtime.createjs.Container();
        record("view.freeTopMeterPortsCreated", []);
      };
      ns.TopMeterAnimController.prototype.changeOrientation = function() {
        record("view.freeOrientation", []);
      };
      ns.TopMeterAnimController.prototype.updateTotalWinTxt = function(...args) {
        record("view.freeTotalWinText", args);
      };

      ns.TopMeterAnimController.prototype.fgIntroAnimStart = function() {
        const target = this;
        queue("free-intro", [freeSpin.getGameData()], () => {
          // Completion flags describe the two owned drawing receipts only.
          target.fgintrobannerL = target.fgintrobannerP = true;
          nativeCallback(target, "introBannerStart");
          target.fgLogoStopL = target.fgLogoStopP = true;
          nativeCallback(target, "onFgLogoStopAnim");
        });
      };

      ns.TopMeterAnimController.prototype.fgOutroAnimStart = function() {
        const target = this;
        queue("free-outro", [freeSpin.getGameData()], () => {
          target.fgoutrobannerL = target.fgoutrobannerP = true;
          nativeCallback(target, "outroBannerEnd");
          target.fgOutroEndL = target.fgOutroEndP = true;
          nativeCallback(target, "onCompleteFgAnim");
        });
      };

      topMeter = new ns.TopMeterAnimController(handle);
      freeSpin = new ns.FreeSpin(
        translator, formatter, audio, bundle, orientation, ns.Config.SCALAR,
        featureContainer, featureContainer, featureContainer, handle, gameFeature
      );
      ui.freeSpin = freeSpin;

      const mystery = gameFeature.getMysteryController();
      mystery.triggerMysteryAnim = function() {
        this.animSymPos = Array.from(
          ns.Config.TOTAL_ALL_POSITION,
          () => new runtime.createjs.Container()
        );
        nativeCallback(this, "symbolReplaceForMystery");
        queue(
          "mystery",
          [logic.gameData, this.replaceSymId],
          () => nativeCallback(this, "animOnComplete")
        );
      };

      const red = gameFeature.redEnvController;
      red.triggerRedEnvAnim = function() {
        nativeCallback(this, "valueToBanner");
        queue(
          "red-envelope",
          [logic.gameData],
          () => nativeCallback(this, "animOnComplete")
        );
      };

      const retrigger = gameFeature.getReTriggerController();
      retrigger.reTriggerAnimCall = function() {
        nativeCallback(this, "findAnimPosition");
        const selected = this.animStartFrom.indexOf(this.findPos.toString());
        // Drawing labels never gate the genuine native retrigger completion/request.
        queue(
          "free-retrigger",
          [
            logic.gameData,
            this.findPos.slice(),
            this.startAnimLable[selected],
            this.endAnimLable[selected]
          ],
          () => {
            freeSpin.reTriggerEndFsRem();
            nativeCallback(this, "animOnComplete");
          }
        );
      };

      const max = gameFeature.getMaxWinController();
      max.triggerMaxWinAnim = function() {
        nativeCallback(this, "valueToBanner");
        queue(
          "max-win",
          [logic.gameData, this.maxWinValue],
          () => nativeCallback(this, "animOnComplete")
        );
      };

      return Object.freeze({symbol, freeSpin, topMeter, group});
    }
  });
}

module.exports = Object.freeze({installOwn32769NativeFreeFeaturePorts});

