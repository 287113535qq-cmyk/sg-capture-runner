"use strict";
const {DOMParser} = require("./own32769-node-dom.cjs");
const {createOwn32769NativePickProducer} =
  require("./own32769-native-pick-producer.cjs");

function hold(reason, details) {
  const error = new Error("AG integrity: own32769 native connection " + reason);
  error.code = "OWN32769_ORIGINAL_NATIVE_CONNECTION_HOLD";
  error.reason = reason;
  if (details !== undefined) error.details = details;
  throw error;
}
function need(ok, reason) {
  if (!ok) hold(reason);
}
function documentOf(text) {
  need(typeof text === "string", "RAW_XML_REQUIRED");
  return new DOMParser().parseFromString(text, "text/xml");
}
function one(root, name) {
  const nodes = root.getElementsByTagName(name);
  need(nodes.length === 1, "ONE_" + name + "_REQUIRED");
  return nodes[0];
}
function directChild(root, name) {
  const nodes = Array.from(root.childNodes)
    .filter(node => node.nodeType === 1 && node.nodeName === name);
  need(nodes.length === 1, "ONE_CURRENT_" + name + "_REQUIRED");
  return nodes[0];
}
function attr(node, name) {
  const value = node.attributes.getNamedItem(name);
  need(value && typeof value.value === "string", "ATTRIBUTE_" + name);
  return value.value;
}
function uint(text, label) {
  need(typeof text === "string" && /^\d+$/.test(text), "INTEGER_" + label);
  const value = Number(text);
  need(Number.isSafeInteger(value), "UNSAFE_" + label);
  return value;
}
function cash(doc) {
  const balances = Array.from(one(doc, "Balances").childNodes)
    .filter(x => x.nodeType === 1 && x.nodeName === "Balance" &&
      attr(x, "name") === "CASH_BALANCE");
  need(balances.length === 1, "ONE_RAW_CASH_BALANCE_REQUIRED");
  return uint(attr(balances[0], "value"), "CASH");
}
function requestHeader(text) {
  return one(documentOf(text), "Header");
}

function createOwn32769OriginalAGNativeBridge({
  session, game, sgSessionExports, originalGameplaySource,
  initialBalanceRaw, limits
}) {
  need(game?.provider === "sg" && game.gameId === "32769" &&
    game.dbName === "sg_fudaole" && game.sg?.protocol === "wms" &&
    game.sg.runtimeGameId === 32991 && game.sg.runtimeSlug === "fudaole" &&
    game.sg.header.gameID === "20135" &&
    game.sg.header.gameCodeRGI === "fudaole" &&
    game.sg.header.versionID === "1_0", "OWN_GAME_BINDING_REQUIRED");
  need(typeof originalGameplaySource?.read === "function" &&
    typeof originalGameplaySource?.has === "function",
    "SAME_MODULE_GAMEPLAY_SOURCE_REQUIRED");
  need(Number.isSafeInteger(initialBalanceRaw) &&
    Number.isSafeInteger(game.sg.betRaw) && game.sg.betRaw > 0,
    "ACTUAL_INITIAL_MONEY_REQUIRED");

  for (const key of [
    "maxDrawingCommands", "maxDataIntents",
    "maxObserverRecords", "maxObserverCohorts", "maxPresentationTicks"
  ]) {
    need(Number.isSafeInteger(limits?.[key]) && limits[key] > 0,
      "EXPLICIT_FINITE_LIMIT_" + key);
  }

  const init = sgSessionExports.readOwn32769ConsumedInitData(session);
  need(cash(init.xml) === initialBalanceRaw &&
    init.parsed.getBalance() === initialBalanceRaw,
    "ORIGINAL_INIT_BALANCE_ASSOCIATION_CHANGED");

  const producer = createOwn32769NativePickProducer({
    session, sgSessionExports, ...limits
  });
  const graph = producer.readNativeGraph();
  let balance = initialBalanceRaw;
  let round, serial = 0, fault, closed = false;
  let action = "SPIN", inflight, offered;
  const commands = new Map();

  function current() {
    if (fault) throw fault;
    need(!closed &&
      sgSessionExports.readOwn32769ConsumedInitData(session) === init,
      "CURRENT_CONSUMED_INIT_REVOKED");
    producer.assertCurrent();
  }
  function command(intent, button) {
    const id = String(++serial);
    const parameters = Object.freeze({
      __own32769NativeCommand: id,
      ...(button ? {pickIndex: button.name.slice(4)} : {})
    });
    const value = {
      event: intent ? intent.msgId : "Logic",
      parameters, intent, button, phase: "offered"
    };
    commands.set(id, value);
    return value;
  }
  function prepared() {
    const intents = producer.readPreparedNativeIntents();
    need(intents.length <= 1, "MULTIPLE_NATIVE_INTENTS");
    return intents[0];
  }
  function choosePrepared() {
    const intent = prepared();
    need(intent && producer.hasNativeIntent(intent),
      "ACTUAL_NATIVE_INTENT_REQUIRED");
    return command(intent);
  }
  function availableButtons() {
    const picker = graph.logic.pickBonus;
    if (graph.logic.gameState !== 1 || !picker ||
        picker.inProcess || picker.getVisible() !== true ||
        picker.pickBanner.currentLabel !== picker.pickLabels[2]) {
      return [];
    }
    need(picker instanceof graph.nativeTypes.PickBonus,
      "ACTUAL_PICKER_REQUIRED");
    return Array.from(picker.pickBtnsLS).filter(button => {
      const index = uint(button.name.slice(4), "NATIVE_BUTTON_INDEX");
      need(button instanceof graph.nativeTypes.createjs.MovieClip &&
        picker.pickBtnsPT[index]?.name === button.name,
        "NATIVE_BUTTON_PAIR_CHANGED");
      return button.visible === true &&
        picker.pickBtnsPT[index].visible === true;
    });
  }
  function drive(frame) {
    if (!documentOf(frame.requestPayload).getElementsByTagName("PickBonus").length)
      producer.completeCurrentNativeSpinPresentation(frame);

    for (let ticks = 0; ticks <= limits.maxPresentationTicks; ticks++) {
      if (round.lastFrame) {
        need(
          originalGameplaySource.read(session, round.scope) === round.lastFrame &&
          originalGameplaySource.has(round.lastFrame),
          "CURRENT_FRAME_REVOKED"
        );
      }
      for (const token of producer.readPendingPresentations()) {
        need(["expanding-wild", "win-display", "free-intro", "free-outro",
          "mystery", "red-envelope", "free-retrigger", "max-win"].includes(token.kind),
          "UNMAPPED_NATIVE_PRESENTATION_" + token.kind);
        producer.completePresentation(token);
      }
      if (prepared()) {
        offered = choosePrepared();
        action = offered.event === "Logic" && graph.logic.getIsFg()
          ? "FREE_SPIN" : "PLAY";
        return;
      }
      if (availableButtons().length) {
        action = "PICK";
        offered = undefined;
        return;
      }
      if (ticks < limits.maxPresentationTicks) {
        producer.stepNativePresentation(16, 1);
      }
    }
    hold("NATIVE_PRESENTATION_DID_NOT_PRODUCE_NEXT_OR_END", {
      nativeGameState: graph.logic.getGameState(),
      nativeFreeGame: graph.logic.getFreeGame(),
      drawings: producer.readNativeDrawingRecordState()
    });
  }
  function initial() {
    current();
    if (round) {
      need(action === "START" && offered?.phase === "offered",
        "PRIOR_ROUND_NOT_CLOSED");
      return {event: offered.event, parameters: offered.parameters};
    }

    need(action === "SPIN" && !inflight, "FRESH_ROUND_REQUIRED");
    round = {
      scope: Object.freeze({}),
      id: String(++serial),
      start: balance,
      win: undefined,
      steps: [],
      firstFrame: undefined,
      lastFrame: undefined
    };
    graph.betController.setForceBet(game.sg.betRaw);
    const bet = graph.betController.getCurrentBet();
    need(bet instanceof graph.nativeTypes.Bet &&
      bet.getTotalBet() === game.sg.betRaw, "INIT_NATIVE_BET_NOT_SELECTED");
    producer.beginOriginalRound(round.scope, bet);
    offered = choosePrepared();
    action = "START";
    return {event: offered.event, parameters: offered.parameters};
  }
  function exact(requestedAction) {
    current();
    need(requestedAction === action, "CURRENT_ACTION_CHANGED");
    if (action === "PICK") return undefined;
    need(["PLAY", "FREE_SPIN"].includes(action) && offered?.phase === "offered",
      "CURRENT_NATIVE_FOLLOWUP_REQUIRED");
    return {event: offered.event, parameters: offered.parameters};
  }
  function pickProtocol(requestedAction) {
    current();
    need(action === "PICK" && requestedAction === action && !inflight,
      "CURRENT_NATIVE_PICK_REQUIRED");
    const buttons = availableButtons();
    need(buttons.length > 0, "NO_CURRENT_NATIVE_BUTTONS");
    commands.clear();

    return {
      kind: "choice",
      event: "Logic",
      options: buttons.map(button => {
        const entry = command(undefined, button);
        const index = uint(button.name.slice(4), "BUTTON_INDEX");
        return {
          pickIndex: index,
          requestPickIndex: index,
          requestParams: entry.parameters
        };
      })
    };
  }
  function take(event, parameters, currentSessionTicket) {
    current();
    need(round && !inflight && parameters &&
      typeof parameters.__own32769NativeCommand === "string",
      "CURRENT_COMMAND_REQUIRED");

    const entry = commands.get(parameters.__own32769NativeCommand);
    need(entry && entry.phase === "offered" && entry.event === event &&
      JSON.stringify(parameters) === JSON.stringify(entry.parameters),
      "COMMAND_REPLAY_OR_SELECTOR_CHANGED");
    commands.clear();
    entry.phase = "selected";

    if (entry.button) {
      need(action === "PICK" && availableButtons().includes(entry.button),
        "SELECTED_NATIVE_BUTTON_REVOKED");
      producer.clickActualNativeButton(entry.button);
      entry.intent = prepared();
    }

    const intent = entry.intent;
    need(intent && producer.hasNativeIntent(intent) &&
      intent.sourceRequestor === graph.requestor &&
      intent.sessionScope === session &&
      intent.roundScope === round.scope &&
      intent.endpoint === game.sg.endpoint &&
      intent.msgId === event, "CURRENT_NATIVE_REQUEST_DATA_REQUIRED");

    const h = requestHeader(intent.requestPayload);
    need(attr(h, "sessionID") === currentSessionTicket &&
      graph.requestor.glsServerSessionId === currentSessionTicket,
      "CURRENT_REQUEST_TICKET_CHANGED");
    need(attr(h, "gameID") === "20135" &&
      attr(h, "gameCodeRGI") === "fudaole" &&
      attr(h, "versionID") === "1_0", "NATIVE_HEADER_CHANGED");

    inflight = entry;
    entry.phase = "dispatching";
    offered = undefined;
    return Object.freeze({
      intent,
      roundScope: round.scope,
      roundId: round.id,
      requestPayload: intent.requestPayload,
      event
    });
  }
  function finish(frame, step, envelopeBalanceRaw) {
    current();
    need(round && inflight &&
      originalGameplaySource.read(session, round.scope) === frame &&
      originalGameplaySource.has(frame) &&
      frame.roundScope === round.scope &&
      frame.requestPayload === inflight.intent.requestPayload &&
      frame.nativeIntent === inflight.intent &&
      frame.msgId === inflight.event &&
      step === frame.step, "ACTUAL_ORIGINAL_SUCCESS_FRAME_REQUIRED");

    const doc = documentOf(frame.responsePayload);
    need(attr(doc.documentElement, "type") === frame.msgId &&
      !doc.getElementsByTagName("Error").length &&
      !doc.getElementsByTagName("Errors").length &&
      attr(one(doc, "Header"), "gameID") === "20135",
      "ACTUAL_RESPONSE_ENVELOPE_CHANGED");

    const nextBalance = cash(doc);
    need(nextBalance === envelopeBalanceRaw,
      "ORIGINAL_RESPONSE_BALANCE_ASSOCIATION_CHANGED");
    const first = round.firstFrame === undefined;
    let cumulative;

    if (frame.msgId === "Logic") {
      // The native parser selects the current result before recovery DATA.
      const result = directChild(doc.documentElement, "GameResult");
      if (first) {
        need(
          uint(attr(result, "totalStake"), "RESPONSE_STAKE") === game.sg.betRaw,
          "ACTUAL_RESPONSE_STAKE_CHANGED"
        );
      }
      uint(attr(result, "totalWin"), "SPIN_WIN");
      const win = directChild(result, "GameWinInfo");
      cumulative = uint(attr(win, "totalWagerWin"), "TOTAL_WAGER_WIN");
      // Native parser/Logic/Picker owns feature, cap and lastPick transitions.
      // No component-sum, observed-combination or cumulative-history gate.
      if (inflight.button) {
        const feature = doc.getElementsByTagName("Feature")[0];
        const data = feature && feature.childNodes[0];
        if (data && data.attributes) {
          const awarded = data.attributes.getNamedItem("jkptAwarded");
          if (awarded && awarded.value === "Y") {
            uint(attr(data, "jkptValue"), "ACTUAL_JACKPOT_VALUE");
            need(uint(attr(data, "jkptType"), "ACTUAL_JACKPOT_TYPE") < 4,
              "ACTUAL_JACKPOT_TYPE_CHANGED");
          }
          const history = data.attributes.getNamedItem("pickConceaded");
          if (history) {
            // Only the returned current pair indexes native controls.
            // Earlier returned IDs may repeat, reorder or be reused.
            const pair = history.value.split(",").at(-1).split("|");
            need(pair.length === 2, "ACTUAL_CURRENT_PICK_PAIR_REQUIRED");
            const index = uint(pair[0], "CURRENT_RETURNED_PICK");
            const kind = uint(pair[1], "CURRENT_RETURNED_JACKPOT_TYPE");
            need(index < graph.logic.pickBonus.pickBtnsLS.length &&
              index < graph.logic.pickBonus.pickBtnsPT.length && kind < 4,
              "CURRENT_RETURNED_PICK_OUTSIDE_NATIVE_CONTROLS");
          }
        }
      }
    } else {
      need(frame.msgId === "EndGame" &&
        doc.getElementsByTagName("GameResult").length === 0 &&
        Number.isSafeInteger(round.win) &&
        nextBalance === round.start - game.sg.betRaw + round.win,
        "ACTUAL_END_ACK_OR_FINANCIAL_CLOSURE_REQUIRED");
    }

    round.lastFrame = frame;
    if (first) round.firstFrame = frame;
    const accepted = producer.acceptOriginalFrame(
      frame, originalGameplaySource, round.scope
    );
    if (frame.msgId === "Logic") {
      const parsed = accepted.parsedResponse;
      need(parsed.getBalance() === nextBalance &&
        parsed.getGameData().getCustomData()
          .getgameWinInfo().totalWagerWin === cumulative,
        "NATIVE_PARSED_MONEY_CHANGED");
      round.win = cumulative;
      const featureInfo =
        parsed.getGameData().getCustomData().featureInfo;
      if (featureInfo && featureInfo.featureindex === "1") {
        const remaining = uint(featureInfo.remainingFreeSpins, "NATIVE_FREE_REMAINING");
        const played = uint(featureInfo.totalFreeSpinsPlayed, "NATIVE_FREE_PLAYED");
        const total = remaining + played;
        need(Number.isSafeInteger(total), "UNSAFE_NATIVE_FREE_TOTAL");
        round.freeData = {
          freeSpinsTotal: total, freeSpinsPlayed: played,
          freeSpinsRemaining: remaining
        };
        const rawFeature = doc.getElementsByTagName("Feature")[0];
        const rawData = rawFeature && rawFeature.childNodes[0];
        const extra = rawData?.attributes?.getNamedItem("extraFreeSpinsAwarded");
        const last = rawData?.attributes?.getNamedItem("lastFreeSpin");
        if (extra)
          round.freeData.extraFreeSpinsAwarded =
            uint(extra.value, "ACTUAL_EXTRA_FREE");
        if (last) {
          need(["Y", "N"].includes(last.value),
            "ACTUAL_LAST_FREE_VALUE_REQUIRED");
          round.freeData.nativeLastFreeSpin = last.value;
        }
      }

    } else {
      need(accepted.kind === "owned-original-EndGame-native-DATA-only" &&
        graph.logic.getGameInProgress() === false,
        "NATIVE_END_NOT_RETURNED");
    }

    balance = nextBalance;
    round.steps.push({...step, responseBalance: balance});
    inflight.phase = "consumed";
    inflight = undefined;
    if (frame.msgId === "EndGame") {
      action = "SPIN";
      commands.clear();
    } else {
      drive(frame);
    }

    const steps = action === "SPIN"
      ? round.steps : round.steps.slice(-1);
    const normalized = {
      NextActionInfo: {nextAction: action},
      PlayerBalanceInfo: {
        preWagerBalance: round.start / 100,
        balance: balance / 100,
        wager: game.sg.betRaw / 100,
        resultAmount: round.win / 100
      },
      ...(round.freeData ? {FreeSpinsInfo: {
        ...round.freeData, accumulativeWin: round.win / 100
      }} : {}),
      capturePlatform: "sg",
      gameId: 32991,
      runtimeSlug: game.sg.runtimeSlug,
      startBalance: round.start / 100,
      endBalance: balance / 100,
      totalWin: round.win / 100,
      SGWireResponse: frame.responsePayload,
      stepCount: steps.length,
      msgIds: steps.map(x => x.msgId),
      steps: structuredClone(steps),
      SGOwnSDKDecision: {
        contract: "own32769-original-native-free-feature-private-v3",
        nativeDrawingRecords: producer.readNativeDrawingRecordState(),
        actualSameModuleSuccessFrame: true,
        actualNativeRequestData: true,
        actualNativeEndReturned: frame.msgId === "EndGame",
        providerAuthenticationClaimedByComponent: false,
        productionAdmission: false
      },
      money: {
        startBalanceRaw: round.start,
        endBalanceRaw: balance,
        betRaw: game.sg.betRaw,
        totalWinRaw: round.win
      }
    };
    if (action === "SPIN") round = undefined;
    return normalized;
  }

  return Object.freeze({
    initial, exact, pickProtocol, take, finish,
    close() {
      closed = true;
      commands.clear();
      producer.dispose();
    },
    fail(error) {
      if (!fault) fault = error;
    },
    graph() {
      current();
      return producer.readNativeGraph();
    }
  });
}

module.exports = Object.freeze({
  createOwn32769OriginalAGNativeBridge
});

