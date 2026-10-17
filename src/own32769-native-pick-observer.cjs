// own32769-normal-Pick-payload-DATA-private.mjs
// DATA only. No transport, selection policy, scheduler or synthetic End.

const sourceBinding = Object.freeze({
  gameId: "32769",
  nativeGameId: "20135",
  runtimeGameId: 32991,
  sourceCache:
    "C:/Users/xxx/Documents/Codex/2026-10-07/zhe/work/ag-reuse-sg/" +
    "winB-first-src-v1/32769-source-private.json",
  sourcePath:
    "E:/platform-sync/api_new_docker/api_new/client/game/sg/static/" +
    "resource.atc.casinarena.com/resource-service/content/fudaole/" +
    "app/fudaole.js",
  retainedSourceSHA256:
    "76934234b9f8e362cf65db52f5733e533b72ff72d2099d23f62da75392125c1d",
  sourceHashRecomputed: false,
  // Declared character offsets from the existing source cache.
  ranges: Object.freeze({
    wagerConstructor: [1847427, 1847524],
    wagerToXML: [1847727, 1848129],
    pickConstructor: [1861064, 1861162],
    pickToXML: [1861365, 1861772],
    createPickBonusPayloads: [1745553, 1746128],
    sendPickBonusWager: [1744829, 1745213],
    checkToSendEndGame: [1746141, 1747662],
    sendEndGame: [1747675, 1747867]
  }),
  retainedCreatePickMethodSHA256:
    "1061197c3fb12c7a92f7fdcfe9d9a678eed8d22cf1ef7675e514a341d1506d66"
});

function hold(reason, input) {
  const error = new Error("Own 32769 Pick DATA hold: " + reason);
  error.code = "OWN32769_PICK_DATA_HOLD";
  error.reason = reason;
  error.sourceInput = input;
  return error;
}

function reference(value, name) {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  ) {
    throw hold(name + "_REFERENCE_REQUIRED");
  }
  return value;
}

function requireFields(value, names) {
  reference(value, "INPUT");
  for (const name of names) {
    if (!Object.prototype.hasOwnProperty.call(value, name)) {
      throw hold("ACTUAL_INPUT_MISSING_" + name, value);
    }
  }
}

function attribute(node, name) {
  reference(node, "ACTUAL_XML_NODE");
  const item = node.attributes && node.attributes.getNamedItem(name);
  if (!item || typeof item.value !== "string") {
    throw hold("ACTUAL_XML_ATTRIBUTE_MISSING_" + name, node);
  }
  return item.value;
}

function legalIndex(value) {
  return Number.isInteger(value) && value >= 0 && value <= 14;
}

function positiveActualStake(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    value.trim() !== "undefined" &&
    value.trim() !== "null"
  ) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0;
  }
  return false;
}

function createOwn32769NormalPickPayloadData({
  originalSessionScope,
  originalRoundScope,
  document
}) {
  reference(originalSessionScope, "ORIGINAL_SESSION_SCOPE");
  reference(originalRoundScope, "ORIGINAL_ROUND_SCOPE");
  reference(document, "ACTUAL_DOCUMENT");
  if (
    !document.implementation ||
    typeof document.implementation.createDocument !== "function"
  ) {
    throw hold("ACTUAL_DOM_IMPLEMENTATION_REQUIRED");
  }

  // Native cached constructors, unchanged.
  function LTWagerPayload(totalStake) {
                this.totalStake = totalStake;
            }

  function LTPickBonusPayload(pickIndex) {
                this.pickIndex = pickIndex;
            }

  // Native cached toXML functions, unchanged.
  LTWagerPayload.prototype.toXML = function () {
                var xmlDoc = document.implementation.createDocument("", "WagerInfo", null);
                var totalBetAttr = xmlDoc.createAttribute("totalStake");
                totalBetAttr.value = (this.totalStake).toString();
                xmlDoc.documentElement.attributes.setNamedItem(totalBetAttr);
                return xmlDoc;
            };

  LTPickBonusPayload.prototype.toXML = function () {
                var xmlDoc = document.implementation.createDocument("", "PickBonus", null);
                var pickIndexAttr = xmlDoc.createAttribute("pickIndex");
                pickIndexAttr.value = (this.pickIndex).toString();
                xmlDoc.documentElement.attributes.setNamedItem(pickIndexAttr);
                return xmlDoc;
            };

  const fudaole = { LTWagerPayload, LTPickBonusPayload };

  // Exact ordinary statements from cached createPickBonusPayloads.
  // This private entry exposes no history/replay payload branch.
  // It is not presented as the complete original method.
  function createNormalPickPayloads(wager, pickIndex) {
                var payloads = [];
                var payload = new fudaole.LTWagerPayload(wager.getTotalBet());
                payloads.push(payload);
                var pickPayload = new fudaole.LTPickBonusPayload(pickIndex);
                payloads.push(pickPayload);
                return payloads;
  }

  function inspectActualPickResponse(xml) {
    reference(xml, "ACTUAL_RESPONSE_XML");
    if (typeof xml.getElementsByTagName !== "function") {
      throw hold("ACTUAL_RESPONSE_DOCUMENT_REQUIRED", xml);
    }
    const feature = xml.getElementsByTagName("Feature")[0];
    const gameWinInfo = xml.getElementsByTagName("GameWinInfo")[0];
    if (attribute(feature, "index") !== "2") {
      throw hold("UNMAPPED_ACTUAL_FEATURE", xml);
    }
    const actualFeatureName = attribute(feature, "name");
    const rawIsMaxWin = attribute(gameWinInfo, "isMaxWin");
    if (rawIsMaxWin === "Y") {
      throw hold("MAX_REQUIRES_ORIGINAL_OUTRO_AND_NEXT_PATH", xml);
    }
    if (rawIsMaxWin !== "N") {
      throw hold("UNMAPPED_ACTUAL_MAX_FLAG", xml);
    }
    const dataNode = feature.childNodes[0];
    if (dataNode === undefined) {
      return Object.freeze({
        kind: "actual-trigger-without-data",
        feature, gameWinInfo, dataNode, actualFeatureName, rawIsMaxWin
      });
    }
    const rawLastPick = attribute(dataNode, "lastPick");
    if (rawLastPick === "Y") {
      throw hold("LAST_PICK_REQUIRES_ORIGINAL_OUTRO_AND_NEXT_PATH", xml);
    }
    if (rawLastPick !== "N") {
      throw hold("UNMAPPED_ACTUAL_LAST_PICK", xml);
    }
    const rawPickConceaded = attribute(dataNode, "pickConceaded");
    // Native parser expressions; preserve duplicates and original order.
    // These are revealed records, not an available-card whitelist.
    const pickConceaded = rawPickConceaded.split(",");
    const currectPick = pickConceaded[
      pickConceaded.length - 1
    ].split("|").map(Number);
    return Object.freeze({
      kind: "actual-pick-continuation",
      feature, gameWinInfo, dataNode, actualFeatureName,
      rawIsMaxWin, rawLastPick, rawPickConceaded,
      pickConceaded, currectPick
    });
  }

  return Object.freeze({
    buildPickPayloadData(input) {
      requireFields(input, [
        "sessionScope",
        "roundScope",
        "responseXML",
        "lastWager",
        "actualRemaining",
        "pickIndex",
        "sourceRefs"
      ]);

      if (
        input.sessionScope !== originalSessionScope ||
        input.roundScope !== originalRoundScope
      ) {
        throw hold("ORIGINAL_SCOPE_CHANGED", input);
      }

      // Opaque original records are preserved, not authenticated here.
      // The original factory must establish real transport success,
      // current game/session/round, recovery disposition and ownership.
      requireFields(input.sourceRefs, [
        "initRecord",
        "currentResponseRecord",
        "currentWagerRecord",
        "remainingRecord",
        "choiceRecord"
      ]);
      for (const name of [
        "initRecord",
        "currentResponseRecord",
        "currentWagerRecord",
        "remainingRecord",
        "choiceRecord"
      ]) {
        reference(input.sourceRefs[name], "ACTUAL_" + name);
      }

      const observation = inspectActualPickResponse(input.responseXML);

      // Remaining belongs to the original session/round owner.
      // This module never initializes or resets it to all fifteen cards.
      if (
        !Array.isArray(input.actualRemaining) ||
        input.actualRemaining.length === 0
      ) {
        throw hold("ACTUAL_REMAINING_REQUIRED", input);
      }

      const remaining = new Set();
      for (const index of input.actualRemaining) {
        if (!legalIndex(index)) {
          throw hold("INVALID_ACTUAL_REMAINING", input);
        }
        remaining.add(index);
      }

      // Explicit owner choice only; no default or generated policy.
      if (!legalIndex(input.pickIndex) || !remaining.has(input.pickIndex)) {
        throw hold("EXPLICIT_LEGAL_REMAINING_PICK_REQUIRED", input);
      }

      reference(input.lastWager, "ACTUAL_LAST_WAGER");
      if (typeof input.lastWager.getTotalBet !== "function") {
        throw hold("ACTUAL_WAGER_GETTER_REQUIRED", input);
      }

      // Native ordinary statements read the actual wager getter once.
      const payloads = createNormalPickPayloads(
        input.lastWager,
        input.pickIndex
      );
      if (!positiveActualStake(payloads[0].totalStake)) {
        throw hold("ACTUAL_POSITIVE_TOTAL_STAKE_REQUIRED", input);
      }

      for (const payload of payloads) Object.freeze(payload);
      Object.freeze(payloads);

      const payloadDocuments = Object.freeze(
        payloads.map(payload => payload.toXML())
      );

      return Object.freeze({
        kind: "pick-payload-data-only",
        sessionScope: originalSessionScope,
        roundScope: originalRoundScope,
        pickIndex: input.pickIndex,
        totalStake: payloads[0].totalStake,
        payloads,
        payloadDocuments,
        actualResponseXML: input.responseXML,
        responseObservation: observation,
        actualRemainingSnapshot: Object.freeze([...input.actualRemaining]),
        sourceRefs: Object.freeze({
          initRecord: input.sourceRefs.initRecord,
          currentResponseRecord: input.sourceRefs.currentResponseRecord,
          currentWagerRecord: input.sourceRefs.currentWagerRecord,
          remainingRecord: input.sourceRefs.remainingRecord,
          choiceRecord: input.sourceRefs.choiceRecord,
          lastWager: input.lastWager,
          actualRemaining: input.actualRemaining
        })
      });
    }
  });
}



const nativeProducerSource = Object.freeze({
  retainedSourceSHA256:
    "76934234b9f8e362cf65db52f5733e533b72ff72d2099d23f62da75392125c1d",
  hashRecomputed: false,
  cachedCharRanges: Object.freeze({
    parse: [1819970, 1827726],
    handlePlayResponse: [1750168, 1751759],
    initPickScreen: [1432798, 1434072],
    onPickSelected: [1434531, 1434938],
    revealPick: [1439002, 1440293],
    setPickBonus: [1738839, 1740305],
    checkToSendEndGame: [1746141, 1747662],
    sendEndGame: [1747675, 1747867],
    doGameEnd: [1445021, 1445165]
  }),
  necessaryReadByteWindows: Object.freeze({
    pickTickerAndBannerTicker: [1434940, 1438725],
    revealTicker: [1440308, 1441099],
    recoveryReveal: [1442339, 1445021]
  })
});

// Installs only on A's actual isolated native objects.
// It never invokes parser, picker, Logic or requestor methods itself.
// Every wrapper calls the original once with the original this/arguments.
// Method returns, including Promises, are returned unchanged and not awaited.
function installOwn32769NativeDataTap({
  originalSessionScope,
  originalRoundScope,
  document,
  parser,
  logic,
  picker,
  requestor,
  maxRecords
}) {
  for (const [name, value] of Object.entries({
    originalSessionScope, originalRoundScope, parser, logic, picker, requestor
  })) reference(value, name);
  if (!Number.isSafeInteger(maxRecords) || maxRecords <= 0) {
    throw hold("EXPLICIT_OBSERVATION_CAPACITY_REQUIRED");
  }
  if (logic.pickBonus !== picker || logic.glsRequestor !== requestor) {
    throw hold("ACTUAL_NATIVE_OBJECT_BINDING_CHANGED");
  }

  const payloadBuilder = createOwn32769NormalPickPayloadData({
    originalSessionScope, originalRoundScope, document
  });
  const records = [];
  const ownedRecords = new WeakSet();
  const observerErrors = [];
  const stack = [];
  let overflowed = false;
  let nextId = 1;

  function listSnapshot(list) {
    if (!Array.isArray(list)) return null;
    return {
      listReference: list,
      entries: list.map(button => ({
        button,
        name: button.name,
        visible: button.visible,
        // Exact native onPickSelected index expression.
        nativeClickIndex: typeof button.name === "string"
          ? parseInt(button.name.slice(4))
          : undefined
      }))
    };
  }

  function snapshot(label, receiver) {
    if (label.startsWith("picker.")) {
      return {
        inProcess: receiver.inProcess,
        pickData: receiver.pickData,
        pickEnd: receiver.pickData && receiver.pickData.pickEnd,
        pickIsMaxWin: receiver.pickData && receiver.pickData.isMaxWin,
        LS: listSnapshot(receiver.pickBtnsLS),
        PT: listSnapshot(receiver.pickBtnsPT)
      };
    }
    if (label.startsWith("logic.")) {
      return {
        gameState: receiver.gameState,
        featureInfo: receiver.featureInfo,
        fromPick: receiver.fromPick,
        historyReplayData: receiver.historyReplayData
      };
    }
    return null;
  }

  function observe(makeRecord) {
    try {
      if (records.length >= maxRecords) {
        overflowed = true;
        return null;
      }
      const record = Object.freeze({
        id: nextId++,
        sessionScope: originalSessionScope,
        roundScope: originalRoundScope,
        ...makeRecord()
      });
      records.push(record);
      ownedRecords.add(record);
      return record;
    } catch (error) {
      if (observerErrors.length < maxRecords) observerErrors.push(error);
      return null;
    }
  }

  const specs = [
    ["parser.parse", parser, "parse"],
    ["logic.sendPickBonusWager", logic, "sendPickBonusWager"],
    ["logic.checkToSendEndGame", logic, "checkToSendEndGame"],
    ["logic.sendEndGame", logic, "sendEndGame"],
    ["logic.backToBaseGame", logic, "backToBaseGame"],
    ["picker.initPickScreen", picker, "initPickScreen"],
    ["picker.setPickData", picker, "setPickData"],
    ["picker.revealPick", picker, "revealPick"],
    ["picker.revealTicker", picker, "revealTicker"],
    ["picker.doRecoveryRevealPickTile", picker, "doRecoveryRevealPickTile"],
    ["picker.onPickSelected", picker, "onPickSelected"],
    ["picker.doGameEnd", picker, "doGameEnd"],
    ["requestor.makePlayRequest", requestor, "makePlayRequest"],
    ["requestor.makeEndRequest", requestor, "makeEndRequest"]
  ];

  // Resolve every real method before changing any private object.
  const bindings = specs.map(([label, target, name]) => {
    const original = target[name];
    if (typeof original !== "function") {
      throw hold("ACTUAL_NATIVE_METHOD_MISSING_" + label);
    }
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    if (descriptor) {
      if (!("value" in descriptor) || !descriptor.writable) {
        throw hold("NATIVE_METHOD_NOT_WRITABLE_" + label);
      }
    } else if (!Object.isExtensible(target)) {
      throw hold("NATIVE_OBJECT_NOT_EXTENSIBLE_" + label);
    }
    return { label, target, name, original, descriptor };
  });

  function restore(binding) {
    if (binding.target[binding.name] !== binding.wrapper) return;
    if (binding.descriptor) {
      Object.defineProperty(
        binding.target, binding.name, binding.descriptor
      );
    } else {
      delete binding.target[binding.name];
    }
  }

  const installed = [];
  try {
    for (const binding of bindings) {
      binding.wrapper = function () {
        const receiver = this;
        const args = Array.prototype.slice.call(arguments);
        const parent = stack.length ? stack[stack.length - 1] : null;
        const entered = observe(() => ({
          phase: "enter",
          label: binding.label,
          nativeFunction: binding.original,
          receiver,
          args: Object.freeze(args),
          parent,
          before: snapshot(binding.label, receiver)
        }));
        stack.push(entered);
        try {
          const value = Reflect.apply(binding.original, receiver, args);
          observe(() => ({
            phase: "return",
            label: binding.label,
            call: entered,
            value,
            after: snapshot(binding.label, receiver)
          }));
          return value;
        } catch (error) {
          observe(() => ({
            phase: "throw",
            label: binding.label,
            call: entered,
            error
          }));
          throw error;
        } finally {
          stack.pop();
        }
      };
      Object.defineProperty(binding.target, binding.name, {
        value: binding.wrapper,
        writable: true,
        enumerable: binding.descriptor
          ? binding.descriptor.enumerable : false,
        configurable: binding.descriptor
          ? binding.descriptor.configurable : true
      });
      installed.push(binding);
    }
  } catch (error) {
    for (const binding of installed.reverse()) restore(binding);
    throw error;
  }

  function returned(record, label) {
    if (overflowed || observerErrors.length) {
      throw hold("OBSERVATION_INCOMPLETE");
    }
    if (
      !ownedRecords.has(record) ||
      record.phase !== "return" ||
      record.label !== label ||
      !record.call ||
      record.sessionScope !== originalSessionScope ||
      record.roundScope !== originalRoundScope
    ) throw hold("ACTUAL_OBSERVED_RETURN_REQUIRED_" + label);
    return record;
  }

  function parsedPickData(record) {
    returned(record, "parser.parse");
    const response = reference(record.value, "ACTUAL_NATIVE_PARSE_RESULT");
    const gameData = response.getGameData();
    const customData = gameData.getCustomData();
    const featureInfo = reference(
      customData.featureInfo, "ACTUAL_NATIVE_FEATURE_INFO"
    );
    if (featureInfo.featureindex !== "2") {
      throw hold("NOT_NATIVE_PICK_FEATURE");
    }
    return Object.freeze({
      kind: "actual-native-parser-return-DATA-only",
      parserReturn: record,
      responseXML: record.call.args[0],
      response, gameData, customData, featureInfo,
      gameWinInfo: customData.getgameWinInfo(),
      // Native names and values preserved. Not money/bonus defaults.
      pickConceaded: featureInfo.pickConceaded,
      currectPick: featureInfo.currectPick
    });
  }

  function remainingData(record, actualButtonList) {
    const producers = [
      "picker.initPickScreen",
      "picker.revealPick",
      "picker.doRecoveryRevealPickTile"
    ];
    if (!producers.includes(record && record.label)) {
      throw hold("ACTUAL_VISIBILITY_PRODUCER_RETURN_REQUIRED");
    }
    returned(record, record.label);
    const states = [record.after.LS, record.after.PT];
    const state = states.find(
      value => value && value.listReference === actualButtonList
    );
    if (!state) throw hold("ACTUAL_BUTTON_LIST_REFERENCE_CHANGED");
    return Object.freeze({
      kind: "actual-native-visibility-DATA-only",
      producerReturn: record,
      actualButtonList,
      controls: state.entries,
      // No complement, deduplication, card-count or seen-list gate.
      actualRemaining: Object.freeze(
        state.entries
          .filter(entry => entry.visible === true)
          .map(entry => entry.nativeClickIndex)
      )
    });
  }

  function originalCallData(record) {
    const labels = [
      "logic.checkToSendEndGame",
      "logic.sendEndGame",
      "requestor.makePlayRequest",
      "requestor.makeEndRequest"
    ];
    if (!labels.includes(record && record.label)) {
      throw hold("ACTUAL_ORIGINAL_SELECTOR_OR_REQUESTOR_RETURN_REQUIRED");
    }
    returned(record, record.label);
    return Object.freeze({
      kind: "original-call-return-DATA-only",
      record,
      nativeFunction: record.call.nativeFunction,
      receiver: record.call.receiver,
      args: record.call.args,
      returnedValue: record.value,
      parentCall: record.call.parent
    });
  }

  return Object.freeze({
    readRecords() {
      return Object.freeze(records.slice());
    },
    observerState() {
      return Object.freeze({
        overflowed,
        observerErrors: Object.freeze(observerErrors.slice())
      });
    },
    parsedPickData,
    remainingData,
    originalCallData,
    buildPickData({
      parserReturn,
      visibilityReturn,
      actualButtonList,
      pickIndex,
      sourceRefs
    }) {
      const parsed = parsedPickData(parserReturn);
      const remaining = remainingData(
        visibilityReturn, actualButtonList
      );
      requireFields(sourceRefs, [
        "initRecord", "currentResponseRecord",
        "currentWagerRecord", "choiceRecord"
      ]);
      const payloadData = payloadBuilder.buildPickPayloadData({
        sessionScope: originalSessionScope,
        roundScope: originalRoundScope,
        responseXML: parsed.responseXML,
        lastWager: logic.lastWager,
        actualRemaining: remaining.actualRemaining,
        pickIndex,
        sourceRefs: {
          ...sourceRefs,
          remainingRecord: visibilityReturn
        }
      });
      return Object.freeze({
        kind: "native-Pick-factory-DATA-only",
        parsed, remaining, payloadData
      });
    },
    uninstall() {
      for (const binding of installed.slice().reverse()) restore(binding);
    }
  });
}

module.exports = Object.freeze({sourceBinding,createOwn32769NormalPickPayloadData,nativeProducerSource,installOwn32769NativeDataTap});
