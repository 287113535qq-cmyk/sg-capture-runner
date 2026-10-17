"use strict";
const {DOMParser} = require("./own32769-node-dom.cjs");
const {createOwn32769NativeRuntime} =
  require("./own32769-native-graphics-runtime.cjs");
const {createOwn32769NativeModelTypes} =
  require("./own32769-native-model-types-producer.cjs");
const {observeOwn32769PickBinding} =
  require("./own32769-model-connection-data-v2.cjs");
const {installOwn32769NativeDataTap} =
  require("./own32769-native-pick-observer.cjs");

const {installOwn32769NativeFreeFeaturePorts} =
  require("./own32769-native-free-feature-ports.cjs");
const liveProducers = new WeakMap();
const ownedGraphs = new WeakSet();

function fail(reason) {
  const error = new Error("Own native Pick producer: " + reason);
  error.code = "OWN32769_NATIVE_PRODUCER_HOLD";
  error.reason = reason;
  throw error;
}
function ref(value) {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}
function xml(text) {
  return new DOMParser().parseFromString(text, "text/xml");
}
function attribute(node, name) {
  const item = node && node.attributes.getNamedItem(name);
  if (!item || typeof item.value !== "string")
    fail("ACTUAL_XML_ATTRIBUTE_REQUIRED_" + name);
  return item.value;
}

function createOwn32769NativePickProducer({
  session, sgSessionExports, maxDrawingCommands, maxDataIntents,
  maxObserverRecords, maxObserverCohorts
}) {
  if (!ref(session) || !ref(sgSessionExports) ||
      typeof sgSessionExports.readOwn32769ConsumedInitData !== "function")
    fail("SAME_ORIGINAL_SG_SESSION_AND_EXPORTS_REQUIRED");
  for (const value of [
    maxDrawingCommands, maxDataIntents, maxObserverRecords, maxObserverCohorts
  ]) if (!Number.isSafeInteger(value) || value <= 0)
    fail("EXPLICIT_COMPONENT_CAPACITIES_REQUIRED");

  function currentInit() {
    const value = sgSessionExports.readOwn32769ConsumedInitData(session);
    if (!value || value.sessionScope !== session ||
        value.kind !== "actual-normal-Init-protocol-DATA-only" ||
        value.request.nativeGameId !== "20135")
      fail("CURRENT_CONSUMED_OWN_INIT_REQUIRED");
    return value;
  }

  const initData = currentInit();
  const retained = liveProducers.get(session);
  if (retained) {
    retained.assertCurrent();
    if (retained.initData !== initData ||
        retained.sgSessionExports !== sgSessionExports)
      fail("PRODUCER_OR_INIT_MODULE_BINDING_CHANGED");
    return retained.api;
  }

  let runtime, graph, round, fault, currentParser, currentTap;
  let pickerCache, requestor, lastResponse;
  const intents = [], cohorts = [], pendingPresentations = [];
  const ownedIntents = new WeakSet(), completedFrames = new WeakMap();
  const ownedPresentations = new WeakSet();
  const completedPresentations = new WeakSet();
  const completedNativeSpins = new WeakSet();
  let completedNativeSpinCount = 0;

  function assertCurrent() {
    if (fault) throw fault;
    if (currentInit() !== initData) fail("CONSUMED_INIT_CHANGED");
    if (graph && (!ownedGraphs.has(graph) ||
        graph.logic.glsRequestor !== graph.requestor ||
        graph.logic.bonus !== graph.bonus ||
        graph.bonus.betController !== graph.betController ||
        graph.requestor !== requestor ||
        graph.requestor.parserFactory !== graph.parserFactory ||
        graph.logic.slot !== graph.presentationSlot ||
        graph.bonus.slot !== graph.presentationSlot))
      fail("CURRENT_NATIVE_GRAPH_REVOKED_OR_CHANGED");
  }

  function requireRound() {
    assertCurrent();
    if (!round || !ref(round.scope))
      fail("ACTUAL_ORIGINAL_ROUND_REQUIRED");
    if (round.lastFrame && (!round.owner ||
        round.owner.read(session, round.scope) !== round.lastFrame ||
        !round.owner.has(round.lastFrame)))
      fail("ORIGINAL_CURRENT_ROUND_FRAME_REVOKED");
    return round;
  }

  function report(name, args) {
    runtime.recordDrawing(name, args);
  }
  function queuePresentation(kind, args, complete) {
    const actualRound = requireRound();
    const token = Object.freeze({
      kind, args: Object.freeze(Array.from(args)),
      sessionScope: session, roundScope: actualRound.scope,
      originalFrame: actualRound.lastFrame
    });
    ownedPresentations.add(token);
    pendingPresentations.push({token, complete});
    report(kind, args);
    return token;
  }

  const httpconnection = {
    HttpConnectionFactory: class NativeRequestDataFactory {
      createConnection(endpoint, requestPayload, method) {
        const actualRound = requireRound();
        if (endpoint !== initData.url || method !== 1)
          fail("ORIGINAL_NATIVE_ENDPOINT_OR_METHOD_CHANGED");
        const requestXML = xml(requestPayload);
        const msgId = attribute(requestXML.documentElement, "type");
        if (!["Logic", "EndGame"].includes(msgId))
          fail("SECOND_INIT_OR_UNMAPPED_NATIVE_REQUEST_FORBIDDEN");

        const signal = {
          onComplete: null, onFail: null, onProgress: null
        };
        const events = new runtime.events.EventDispatcher(signal);
        let sent = false;

        return {
          getEvents() { return events; },
          send() {
            assertCurrent();
            if (sent) fail("NATIVE_DATA_INTENT_ALREADY_PREPARED");
            if (intents.length >= maxDataIntents)
              fail("NATIVE_DATA_INTENT_CAPACITY_REACHED");
            sent = true;
            const intent = Object.freeze({
              kind: "native-GLS-request-DATA-only",
              sessionScope: session, roundScope: actualRound.scope,
              endpoint, requestPayload, msgId, method,
              sourceRequestor: requestor
            });
            ownedIntents.add(intent);
            intents.push({intent, signal, phase: "prepared"});
          }
        };
      }
    }
  };

  runtime = createOwn32769NativeRuntime({
    httpconnection, maxDrawingCommands
  });
  const initialRequest = xml(initData.actualRequestText);
  const h = initialRequest.getElementsByTagName("Header")[0];
  const freePlay = attribute(h, "freePlay");
  if (freePlay !== "Y" && freePlay !== "N")
    fail("UNMAPPED_ACTUAL_FREEPLAY_HEADER");

  const metadata = Object.freeze({
    getLogicUrl: () => initData.url,
    getGameCode: () => attribute(h, "gameCodeRGI"),
    getLocale: () => attribute(h, "lang"),
    isRealMoney: () => freePlay === "N",
    isGaffingEnabled: () => runtime.metadataBundle.isGaffingEnabled()
  });
  const sessionFields = Object.freeze({
    getContextID: () => attribute(h, "affiliate"),
    getPlayerID: () => attribute(h, "userID"),
    getSessionID: () => attribute(h, "sessionID")
  });
  if (sessionFields.getSessionID() !== initData.request.initialSessionId)
    fail("ORIGINAL_INITIAL_TICKET_BINDING_CHANGED");

  const types = createOwn32769NativeModelTypes({
    nativeNamespace: runtime.namespace, events: runtime.events,
    glscomms: runtime.glscomms, createjs: runtime.createjs,
    TweenLite: runtime.TweenLite, TweenMax: runtime.TweenMax
  });
  const ns = types.namespace;
  if (String(ns.Config.GLM_INFO.id) !== "20135" ||
      String(ns.Config.GLM_INFO.version) !== "1_0")
    fail("OWN_NATIVE_GLM_DESCRIPTION_CHANGED");

  requestor = new runtime.glscomms.GLSRequestor(
    metadata, sessionFields, ns.Config.GLM_INFO
  );
  const factory = new ns.LTResponseXMLParserFactory();
  const nativeCreatePlayParser = factory.createPlayParser;

  function installTap(parser, picker) {
    requireRound();
    if (currentTap) currentTap.uninstall();
    if (cohorts.length >= maxObserverCohorts)
      fail("NATIVE_OBSERVER_COHORT_CAPACITY_REACHED");
    currentTap = installOwn32769NativeDataTap({
      originalSessionScope: session, originalRoundScope: round.scope,
      document: runtime.document, parser,
      logic, picker, requestor, maxRecords: maxObserverRecords
    });
    cohorts.push(Object.freeze({
      parser, picker, tap: currentTap, roundScope: round.scope
    }));
  }

  factory.createPlayParser = function (...args) {
    const parser = Reflect.apply(nativeCreatePlayParser, this, args);
    currentParser = parser;
    const nativeParse = parser.parse;
    parser.parse = function (...parseArgs) {
      const value = Reflect.apply(nativeParse, this, parseArgs);
      lastResponse = value;
      return value;
    };
    if (graph && graph.logic.pickBonus)
      installTap(parser, graph.logic.pickBonus);
    return parser;
  };

  requestor.setXMLParserFactory(factory);
  requestor.configure(initData.parsed.getPlatformData());
  requestor.glsServerSessionId =
    initData.parsed.getPlatformData().getSessionId();
  requestor.requestObject = initData.originalExchangeRecord.response;

  const formatter = new runtime.locale.CurrencyFormatter();
  formatter.setData(initData.parsed.getPlatformData().getCurrencyFormat());
  const translator =
    new runtime.locale.Translator(Object.create(null));
  const orientation = new ns.OrientationController(
    ns.Config.SCREEN_WIDTH, ns.Config.SCREEN_HEIGHT
  );
  const font = new runtime.asset.FontAsset(
    "resources/fonts/MyriadPro-Bold.otf"
  );
  // Native name calculation only; no font-loaded flag or completion event.
  font.fontName = "font" + font.getSimpleHash(font.path);
  const bundle = {
    myriadProBold: font,
    pickbackground_ls: new runtime.asset.ImageAsset(
      "resources/images/x1.0/pickbonus/pickfeaturebgl.jpg"
    ),
    pickbackground_pt: new runtime.asset.ImageAsset(
      "resources/images/x1.0/pickbonus/pickfeaturebgp.jpg"
    )
  };
  const audio = new Proxy({}, {
    get(_target, name) {
      return (...args) => report("audio." + String(name), args);
    }
  });
  const partner = {
    startedPlay() { report("partner.startedPlay", []); },
    receivedGameLogicResponse(value) {
      report("partner.receivedGameLogicResponse", [value]);
    }
  };
  const signal = names => {
    const object = Object.fromEntries(names.map(name => [name, null]));
    const events = new runtime.events.EventDispatcher(object);
    return {object, events};
  };
  const spinSignal = signal([
    "onSpinComplete", "onSkillStop", "onGaffReel"
  ]);
  const symbolSignal = signal(["onScatterSymbolAnimComplete"]);
  const bangSignal = signal(["onStart", "onComplete"]);
  const winSignal = signal([
    "onPulseAllSymbols", "onPulseAllSymbolsComplete", "onOnceComplete"
  ]);
  let displayData;
  const cycleResults = {
    addDataForPick(value) { report("view.actualPickResult", [value]); },
    getWinStack: () => ({
      reset() { report("view.resetWinStack", []); }
    })
  };
  const winDisplay = {
    configure(value) {
      displayData = value;
      report("view.configureWin", [value]);
    },
    updateGameResultTotalWin(...args) {
      report("view.updateGameResultTotalWin", args);
    },
    getBangController: () => ({
      getEvents: () => bangSignal.events
    }),
    getEvents: () => winSignal.events,
    getCycleResults: () => cycleResults,
    start(...args) {
      queuePresentation("win-display", [displayData, ...args], () => {
        winSignal.object.onOnceComplete();
        bangSignal.object.onComplete();
      });
    }
  };
  const featureContainer = new runtime.createjs.Container();
  runtime.root.addChild(featureContainer);
  const slot = {
    getEvents: () => spinSignal.events,
    getSymbolAnimationController: () => ({
      getEvents: () => symbolSignal.events,
      setHitData(value) { report("view.hitData", [value]); }
    }),
    getWinDisplayController: () => winDisplay,
    getFeatureAnimContainer: () => featureContainer,
    spin() { report("view.spinRequested", []); },
    setStopPositions(value) {
      report("view.actualStopPositions", [value]);
    },
    setGaffingEnabled(value) {
      report("view.gaffingEnabled", [value]);
    },
    setGaffingType(value) { report("view.gaffingType", [value]); },
    shouldGaff() { return metadata.isGaffingEnabled(); },
    skipWinDisplay(value) {
      report("view.skipWinDisplay", [value]);
    },
    setVisible(value) { report("view.slotVisible", [value]); },
    changeReelSet(value) {
      report("view.changeReelSet", [value]);
    }
  };
  const ui = {
    handleAnim: {
      getBigwin: () => ({
        getBigWinPlaying() {
          return pendingPresentations.some(item =>
            item.token.kind === "bigwin-display" &&
            !completedPresentations.has(item.token)
          );
        },
        animEndAutoPlay() {
          report("view.animEndAutoPlay", []);
        }
      })
    }
  };
  for (const name of [
    "setCanUpdateBalance", "updateUIForPickGame", "showStagePreloader",
    "stopAutoPlay", "resetSpinButtonTracker", "toggleSpinButton",
    "setWin", "handleBangupComplete", "stopWinDisplay"
  ]) ui[name] = (...args) => report("view." + name, args);

  const freePorts = installOwn32769NativeFreeFeaturePorts({
    ns, runtime, slot, ui, bundle, audio, translator, formatter, orientation,
    initData, featureContainer, record: report, queue: queuePresentation
  });

  const gameData = initData.parsed.getGameData();
  const betConfig = gameData.getBetConfiguration();
  const betController = new types.BetController(
    betConfig.getAvailableBets(), betConfig.getDefaultIndex()
  );
  let logic;
  const removeConstructorHook =
    types.observeLogicConstruction(actual => {
      logic = actual;
      observeOwn32769PickBinding({
        logic: actual, nativeTypes: types,
        onBound(binding) {
          if (!currentParser)
            fail("ACTUAL_ROUND_PLAY_PARSER_REQUIRED");
          installTap(currentParser, binding.picker);
        }
      });
    });
  logic = new ns.Logic(
    partner, bundle, requestor, ui, audio
  );
  removeConstructorHook();
  logic.setSlot(slot);
  logic.setJackpotValues(
    gameData.getCustomData().jackpotData.jackpotAwards
  );
  logic.setRedEnvValues(
    gameData.getCustomData().redEnvData.redEnvAwards
  );
  ui.logic = logic;

  const bonus = new types.Bonus(
    slot, bundle, formatter, translator, partner, metadata, ui, audio,
    orientation, requestor, betController, gameData,
    runtime.root, featureContainer, runtime.root, runtime.root
  );
  logic.setBonus(bonus);
  ui.gameFeature = new ns.GameFeature(
    translator, formatter, audio, bundle, orientation,
    ns.Config.SCALAR, runtime.root
  );
  const nativeFreePorts = freePorts.afterLogicReady(logic, ui.gameFeature);
  const expanding = ui.gameFeature.getExpandWildController();
  expanding.triggerExpanWildAnim = function () {
    const data =
      this.gameFeature.getGameData().getCustomData().customfeatureinfo;
    if (!this.animStartFrom.includes(data.nudgingWildPositions))
      fail("UNMAPPED_ACTUAL_EXPANDING_WILD_POSITIONS");
    Reflect.apply(
      ns.selectExpandingPresentationFromOwnSource, this, []
    );
    queuePresentation("expanding-wild", [
      data.nudgingWildPositions, data.replacementSymbolIndex,
      this.selectAnimInx, this.startAnimLable[this.selectAnimInx],
      this.endAnimLable[this.selectAnimInx]
    ], () => Reflect.apply(
      ns.ExpanWildAnimController.prototype.animOnComplete, this, []
    ));
  };
  for (const controller of [
    ui.gameFeature.getMysteryController(),
    ui.gameFeature.redEnvController,
    ui.gameFeature.getReTriggerController(),
    ui.gameFeature.getMaxWinController()
  ]) {
    if (!controller) fail("OWN_NATIVE_FEATURE_CONTROLLER_MISSING");
  }

  function prepareCachedPickAssets() {
    assertCurrent();
    if (pickerCache) return pickerCache;
    const landscape = new ns.PickBonusLS.PickfeatureLM();
    landscape.setTransform(
      0, 0, ns.Config.SCALAR, ns.Config.SCALAR
    );
    landscape.gotoAndStop(0);
    const portrait = new ns.PickBonusPT.PickfeaturePortrait();
    portrait.setTransform(
      0, 0, ns.Config.SCALAR, ns.Config.SCALAR
    );
    portrait.gotoAndStop(0);
    const picker = types.PickBonusFactory.createPickBonus(
      featureContainer, bundle, landscape, landscape, portrait,
      audio, translator, formatter, orientation,
      metadata.isGaffingEnabled(), ui, betController
    );
    pickerCache = Object.freeze({landscape, portrait, picker});
    return pickerCache;
  }

  // Cache-loading port: real native declarations create the controls.
  // No LoadQueue success or bitmap-loaded flag is declared.
  bonus.loadPickBonusAsset = function (isRecovering) {
    if (isRecovering !== undefined && isRecovering !== false)
      fail("RECOVERY_ASSET_PATH_NOT_DELIVERED");
    const assets = prepareCachedPickAssets();
    if (this.pickBonus !== assets.picker ||
        logic.pickBonus !== assets.picker) {
      this.pickBonus = assets.picker;
      this.pickBonus.setVisible(false);
      this.signal.onPickBonusAssetsLoaded(this.pickBonus);
    }
    this.uiController.showStagePreloader(false, 0);
    this.playTransition(true);
  };

  graph = Object.freeze({
    sessionScope: session, initData, nativeTypes: types,
    logic, bonus, betController, requestor, parserFactory: factory,
    orientation, formatter, gameData, nativeFreePorts,
    presentationSlot: slot, presentationUI: ui, featureContainer
  });
  ownedGraphs.add(graph);

  function checkedFrame(frame, owner, scope) {
    assertCurrent();
    if (!ref(owner) || typeof owner.has !== "function" ||
        typeof owner.read !== "function" ||
        owner.read(session, scope) !== frame || !owner.has(frame) ||
        frame.sessionScope !== session || frame.roundScope !== scope ||
        frame.endpoint !== initData.url ||
        !["Logic", "EndGame"].includes(frame.msgId) ||
        !Number.isInteger(frame.httpStatus) ||
        frame.httpStatus < 200 || frame.httpStatus >= 300 ||
        typeof frame.requestPayload !== "string" ||
        typeof frame.responsePayload !== "string" ||
        !ref(frame.responseHeaders) || !ref(frame.response))
      fail("CURRENT_ORIGINAL_KNOWN_WIRE_FRAME_REQUIRED");
  }


  function completeCurrentNativeSpinPresentation(frame) {
    const value = requireRound();
    if (!frame || frame !== value.lastFrame || frame.msgId !== "Logic" ||
        !completedFrames.get(frame)?.result)
      fail("ACTUAL_CURRENT_PLAY_RETURN_REQUIRED_BEFORE_PRESENTATION");
    if (xml(frame.requestPayload).getElementsByTagName("PickBonus").length)
      fail("PICK_RESPONSE_HAS_NO_REEL_SPIN_RECEIPT");
    if (completedNativeSpins.has(frame))
      fail("SPIN_PRESENTATION_ALREADY_COMPLETED");
    completedNativeSpins.add(frame);
    completedNativeSpinCount++;
    spinSignal.object.onSpinComplete();
  }

  const api = Object.freeze({
    readNativeGraph() {
      assertCurrent();
      return graph;
    },
    prepareCachedPickAssets,
    readNativeAssetControls() {
      const assets = prepareCachedPickAssets();
      return Object.freeze({
        landscape: assets.landscape, portrait: assets.portrait,
        LS: ns.PickBonusLS.getPickBtns(),
        PT: ns.PickBonusPT.getPickBtns()
      });
    },
    beginOriginalRound(originalRoundScope, actualNativeBet) {
      assertCurrent();
      if (!ref(originalRoundScope) || round)
        fail("FRESH_ORIGINAL_ROUND_SCOPE_REQUIRED");
      if (!(actualNativeBet instanceof types.Bet) ||
          actualNativeBet !== betController.getCurrentBet())
        fail("ACTUAL_CURRENT_NATIVE_BET_REQUIRED");
      round = {
        scope: originalRoundScope,
        firstFrame: undefined, lastFrame: undefined
      };
      try {
        logic.sendWager(actualNativeBet);
        return Object.freeze(
          intents.filter(item => item.phase === "prepared")
            .map(item => item.intent)
        );
      } catch (error) {
        fault = error;
        throw error;
      }
    },
    hasNativeIntent(value) {
      assertCurrent();
      return ownedIntents.has(value) &&
        intents.some(item =>
          item.phase === "prepared" && item.intent === value
        ) &&
        value.sessionScope === session &&
        value.roundScope === round?.scope;
    },
    acceptOriginalFrame(frame, owner, originalRoundScope) {
      checkedFrame(frame, owner, originalRoundScope);
      const old = completedFrames.get(frame);
      if (old) {
        if (old.owner !== owner || !owner.has(frame) ||
            old.requestPayload !== frame.requestPayload ||
            old.responsePayload !== frame.responsePayload ||
            old.responseHeaders !== frame.responseHeaders)
          fail("ORIGINAL_FRAME_OWNER_CHANGED");
        if (old.error) throw old.error;
        return old.result;
      }
      if (round && round.scope !== originalRoundScope)
        fail("PRIOR_ORIGINAL_ROUND_NOT_CLOSED");

      const requestDoc = xml(frame.requestPayload);
      const requestHeader =
        requestDoc.getElementsByTagName("Header")[0];
      if (attribute(requestDoc.documentElement, "type") !== frame.msgId ||
          attribute(requestHeader, "gameID") !== "20135" ||
          attribute(requestHeader, "gameCodeRGI") !== metadata.getGameCode() ||
          attribute(requestHeader, "versionID") !== "1_0" ||
          attribute(requestHeader, "sessionID") !== requestor.glsServerSessionId)
        fail("ORIGINAL_CURRENT_REQUEST_HEADER_BINDING_CHANGED");

      const attempt = {
        owner, requestPayload: frame.requestPayload,
        responsePayload: frame.responsePayload,
        responseHeaders: frame.responseHeaders
      };
      completedFrames.set(frame, attempt);
      try {
        if (frame.msgId === "EndGame") {
          if (!round || round.scope !== originalRoundScope)
            fail("ACTUAL_ORIGINAL_ROUND_REQUIRED");
          round.owner = owner;
          round.lastFrame = frame;
          requireRound();
          const pending = intents.find(item =>
            item.phase === "prepared" &&
            item.intent.msgId === "EndGame" &&
            item.intent.roundScope === originalRoundScope &&
            item.intent.requestPayload === frame.requestPayload
          );
          if (!pending) fail("ACTUAL_NATIVE_END_INTENT_REQUIRED");
          requestor.requestObject = Object.freeze({
            originalFrame: frame,
            originalResponse: frame.response,
            responseText: frame.responsePayload
          });
          requestor.processEndResponse(
            frame.endpoint, frame.responsePayload, frame.responseHeaders
          );
          if (requestor.extractMessageType(xml(frame.responsePayload)) !== "EndGame")
            fail("ACTUAL_ENDGAME_RESPONSE_REQUIRED");
          const drawingRetirement =
            runtime.retireDrawingCommandsAfterNativeEnd();
          pendingPresentations.length = 0;
          pending.phase = "original-response-consumed";
          const result = Object.freeze({
            kind: "owned-original-EndGame-native-DATA-only",
            drawingRetirement,
            originalFrame: frame, sessionScope: session,
            roundScope: originalRoundScope,
            nativeObserverCohorts: Object.freeze(cohorts.slice())
          });
          if (currentTap) currentTap.uninstall();
          currentTap = undefined;
          currentParser = undefined;
          cohorts.length = 0;
          intents.splice(
            0, intents.length,
            ...intents.filter(item => item.phase === "prepared")
          );
          round = undefined;
          attempt.result = result;
          return result;
        }

        if (!round) {
          round = {
            scope: originalRoundScope,
            firstFrame: frame, lastFrame: frame, owner
          };
          const wagerXML = xml(frame.requestPayload);
          const wagers = wagerXML.getElementsByTagName("WagerInfo");
          if (wagers.length !== 1)
            fail("ACTUAL_ORIGINAL_WAGER_REQUIRED");
          const raw = attribute(wagers[0], "totalStake");
          const amount = Number(raw);
          if (!Number.isSafeInteger(amount) || amount <= 0)
            fail("ACTUAL_ORIGINAL_INTEGER_STAKE_REQUIRED");
          betController.setForceBet(amount);
          logic.setLastWager(betController.getCurrentBet());
        } else {
          const pending = intents.find(item =>
            item.phase === "prepared" &&
            item.intent.msgId === "Logic" &&
            item.intent.roundScope === originalRoundScope &&
            item.intent.requestPayload === frame.requestPayload
          );
          if (!pending) fail("ACTUAL_NATIVE_PLAY_INTENT_REQUIRED");
          pending.phase = "original-response-known";
          if (!round.firstFrame) round.firstFrame = frame;
          round.lastFrame = frame;
          round.owner = owner;
        }

        requestor.requestObject = Object.freeze({
          originalFrame: frame,
          originalResponse: frame.response,
          responseText: frame.responsePayload
        });
        requestor.processPlayResponse(
          frame.endpoint, frame.responsePayload, frame.responseHeaders
        );
        for (const pending of intents) {
          if (pending.phase === "original-response-known")
            pending.phase = "original-response-consumed";
        }
        const result = Object.freeze({
          kind: "owned-original-Play-native-model-DATA-only",
          sessionScope: session, roundScope: originalRoundScope,
          originalFrame: frame, parsedResponse: lastResponse,
          parser: currentParser, graph
        });
        attempt.result = result;
        return result;
      } catch (error) {
        attempt.error = fault = error;
        throw error;
      }
    },
    completeOriginalSpinPresentation() {
      return completeCurrentNativeSpinPresentation(requireRound().lastFrame);
    },
    completeCurrentNativeSpinPresentation(frame) {
      return completeCurrentNativeSpinPresentation(frame);
    },
    readNativeDrawingRecordState() {
      assertCurrent();
      return Object.freeze({
        ...runtime.readNativeDrawingRecordState(),
        completedNativeSpins: completedNativeSpinCount
      });
    },
    readPendingPresentations() {
      assertCurrent();
      return Object.freeze(
        pendingPresentations
          .filter(item => !completedPresentations.has(item.token))
          .map(item => item.token)
      );
    },
    completePresentation(token) {
      const value = requireRound();
      if (!ownedPresentations.has(token) ||
          completedPresentations.has(token) ||
          token.roundScope !== value.scope ||
          token.originalFrame !== value.lastFrame)
        fail("CURRENT_NATIVE_PRESENTATION_RECEIPT_REQUIRED");
      const item = pendingPresentations.find(
        entry => entry.token === token
      );
      completedPresentations.add(token);
      item.complete();
    },
    clickActualNativeButton(button) {
      requireRound();
      const picker = graph.logic.pickBonus;
      if (!picker || !currentTap)
        fail("ACTUAL_NATIVE_PICK_ENTRY_NOT_RETURNED");
      if (![picker.pickBtnsLS, picker.pickBtnsPT].some(
        list => Array.isArray(list) && list.includes(button)
      )) fail("ACTUAL_NATIVE_BUTTON_REFERENCE_REQUIRED");
      if (button.visible !== true || picker.inProcess)
        fail("ACTUAL_NATIVE_BUTTON_NOT_CURRENTLY_AVAILABLE");
      button.dispatchEvent("click");
    },
    readPreparedNativeIntents() {
      assertCurrent();
      return Object.freeze(
        intents.filter(item => item.phase === "prepared")
          .map(item => item.intent)
      );
    },
    readObserverCohorts() {
      assertCurrent();
      return Object.freeze(cohorts.slice());
    },
    stepNativePresentation(milliseconds, maxSteps) {
      assertCurrent();
      return runtime.stepPresentation(milliseconds, maxSteps);
    },
    readDrawingCommands() {
      return runtime.readDrawingCommands();
    },
    readRetainedForensics() {
      return Object.freeze({
        fault, initData, graph,
        lastOriginalFrame: round && round.lastFrame,
        nativeIntents: Object.freeze(intents.map(item => item.intent))
      });
    },
    assertCurrent,
    dispose() {
      if (currentTap) currentTap.uninstall();
      ownedGraphs.delete(graph);
      // Keep the closed entry: this Init/session cannot build another context.
    }
  });

  liveProducers.set(session, {
    api, initData, sgSessionExports, assertCurrent
  });
  return api;
}
module.exports = Object.freeze({createOwn32769NativePickProducer});

