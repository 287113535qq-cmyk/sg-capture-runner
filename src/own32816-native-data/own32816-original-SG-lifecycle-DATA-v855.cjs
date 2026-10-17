'use strict';

// Disabled preparation. Original SG owns transport, successful envelopes,
// journal, accepted-result capabilities and raw money. This module owns none
// of those operations and cannot admit itself to the live source.
exports.createOwn32816OriginalSGLifecycle = function(d) {
  const need = (ok, reason) => { if (!ok) throw Error('OWN32816_ORIGINAL_LIFECYCLE_' + reason); };
  const scope = d.sessionScope, game = d.game;
  need(scope && typeof scope === 'object' && game?.gameId === '32816' &&
    game.dbName === 'sg_zeus3_prt' && game.sg?.runtimeGameId === 33176 &&
    String(game.sg.header?.gameID) === '20123' && game.sg.betRaw === 40, 'OWN_GAME_DATA');
  for (const name of ['assertOriginalOpen', 'readOriginalSessionID', 'readOriginalCashRaw',
    'readOriginalAction', 'exchangeOriginalNative', 'authenticateOriginalResult',
    'createSelector', 'createProjection', 'readHost', 'wallNow', 'yieldNative']) {
    need(typeof d[name] === 'function', 'PRIVATE_CALLBACK_' + name);
  }
  need(d.binding?.providerData && typeof d.binding.providerData.captureCurrentNative === 'function', 'V5_NATIVE_PORT');
  need(Number.isSafeInteger(d.maxTicks) && d.maxTicks > 0 && d.maxTicks <= 100000, 'EXPLICIT_TICK_BUDGET');
  need(Number.isSafeInteger(d.timeoutMs) && d.timeoutMs > 0 && d.timeoutMs <= 30000, 'EXPLICIT_WALL_BUDGET');
  const frames = new WeakSet(), envelopes = new WeakMap(), deliveries = new WeakMap();
  const paid = new WeakMap(), usedPaid = new WeakSet();
  let initFrame, currentFrame, roundScope, issuedPaid, followUp, lastRecorded;
  let phase = 'new', sealed = false, serial = 0;

  function guard() { need(!sealed, 'SEALED'); d.assertOriginalOpen(); }
  function cash() {
    const raw = d.readOriginalCashRaw();
    need(Number.isSafeInteger(raw) && raw >= 0, 'ACTUAL_ORIGINAL_CASH'); return raw;
  }
  function nativeIdle() {
    const h = d.readHost(), Main = h?.context?.sgigame?.Main, Model = h?.context?.sgigame?.GameStateModel;
    need(typeof Main === 'function' && typeof Model === 'function' && h.outerGame?.main instanceof Main, 'ACTUAL_MAIN');
    const entries = h.outerGame.main._context?.injector?.singletonMap;
    need(Array.isArray(entries), 'ORIGINAL_INJECTOR');
    const rows = entries.filter(e => e.instance instanceof Model); need(rows.length === 1, 'ONE_STATE_MODEL');
    const m = rows[0].instance;
    return h.pending.length === 0 && m.getCurrentState()?.stateName === h.context.sgigame.BaseGameStates.IDLE_STATE &&
      m.getSubGame() === h.context.sgigame.SubGames.BASE_GAME;
  }
  async function waitFor(predicate, stage) {
    const until = d.wallNow() + d.timeoutMs; let count = 0;
    while (!predicate()) {
      guard(); need(d.wallNow() < until && count++ < d.maxTicks, 'FINITE_' + stage);
      const h = d.readHost(); need(h.errors.length === 0 && h.runDue(), 'ORIGINAL_HOST_PROGRESS_' + stage);
      await d.yieldNative();
    }
    guard();
  }

  const source = Object.freeze({
    has: frame => frames.has(frame),
    readEnvelope: frame => envelopes.get(frame),
    readInit: s => s === scope ? initFrame : undefined
  });
  const project = d.createProjection(source);
  need(typeof project === 'function', 'ORIGINAL_MONEY_PROJECTION');

  function registerAccepted(result, event) {
    guard();
    // Only the original module-private SG result registry can return this raw
    // object. A public response shape, copied delivery or copied XML is insufficient.
    const raw = d.authenticateOriginalResult(result, event);
    const step = result.step, envelope = result.envelope, delivery = result.delivery;
    need(raw && raw.sessionScope === scope && raw.game === game && raw.parsedStep === step &&
      raw.nativeDispatch?.event === event && step.msgId === event && raw.httpStatus === 200 &&
      raw.requestPayload === step.requestPayload && raw.responsePayload === step.responsePayload,
      'AUTHENTIC_ORIGINAL_COMPLETE_EXCHANGE');
    need(delivery && typeof delivery === 'object' && !deliveries.has(delivery) &&
      delivery.nativeResponseCallbackDelivered === true && delivery.nativeSessionMatchesOriginalOwner === true,
      'ACTUAL_NATIVE_CALLBACK');
    need(envelope.type === event && String(envelope.Header?.gameID) === '20123' &&
      envelope.Header.sessionID === d.readOriginalSessionID(), 'CURRENT_ORIGINAL_ENVELOPE');
    const frame = Object.freeze({sessionScope:scope,game,roundScope,msgId:event,step,
      requestPayload:raw.requestPayload,responsePayload:raw.responsePayload,
      requestHeaders:raw.actualTransportRequestHeaders,responseHeaders:raw.responseHeaders,
      httpStatus:raw.httpStatus,ordinal:raw.ordinal,responseSessionID:envelope.Header.sessionID,cashRaw:cash()});
    frames.add(frame); envelopes.set(frame,envelope);
    deliveries.set(delivery,{event,sid:frame.responseSessionID,frame}); currentFrame = frame;
    if (event !== 'Init') lastRecorded = Object.freeze({event,
      parameters:Object.freeze({nativeRequestPayload:frame.requestPayload})});
    return frame;
  }

  const selector = d.createSelector({
    readHost:d.readHost,assertOriginalOpen:guard,providerData:d.binding.providerData,
    readOriginalSessionID:d.readOriginalSessionID,wallNow:d.wallNow,yieldNative:d.yieldNative,
    maxTicks:d.maxTicks,timeoutMs:d.timeoutMs,
    consumeOriginalPaidIntent(params, sid) {
      guard(); const intent = paid.get(params);
      need(intent && params === issuedPaid && !usedPaid.has(params) && !roundScope &&
        currentFrame === intent.admissionFrame && sid === intent.sid && sid === d.readOriginalSessionID() &&
        cash() === intent.startCashRaw && d.readOriginalAction() === 'SPIN', 'ONE_CURRENT_ORIGINAL_PAID_INTENT');
      usedPaid.add(params); roundScope = intent; issuedPaid = undefined;
    },
    assertOriginalAcceptedDelivery(delivery, event, sid) {
      guard(); const own = deliveries.get(delivery);
      need(own && own.frame === currentFrame && own.event === event && own.sid === sid &&
        frames.has(own.frame) && own.frame.roundScope === roundScope, 'CURRENT_ORIGINAL_ACCEPTED_DELIVERY');
    }
  });

  function seal(error) {
    sealed = true; phase = 'sealed'; selector.seal();
    // Preserve the host pending entry and original journal; never replay it.
    return error;
  }
  return Object.freeze({
    async bootstrap() {
      try {
        guard(); need(phase === 'new', 'ONE_INIT_LIFECYCLE'); phase = 'init-pending';
        await waitFor(() => d.readHost().pending.length === 1, 'INIT_REQUEST');
        const request = d.binding.providerData.captureCurrentNative(); need(request?.event === 'Init', 'NATIVE_INIT_REQUEST');
        const result = await d.exchangeOriginalNative(request.event, request.parameters);
        initFrame = registerAccepted(result, 'Init');
        await waitFor(nativeIdle, 'INIT_IDLE'); selector.acceptInit(result.delivery); phase = 'ready';
      } catch (error) { throw seal(error); }
    },
    initial() {
      try {
        guard(); need((phase === 'ready' || phase === 'ended') && !roundScope && !followUp &&
          nativeIdle() && d.readOriginalAction() === 'SPIN', 'ORIGINAL_AG_PAID_ADMISSION');
        if (!issuedPaid) {
          issuedPaid = Object.freeze({__own32816OriginalPaidIntent:++serial});
          paid.set(issuedPaid,Object.freeze({sessionScope:scope,game,ordinal:serial,
            admissionFrame:currentFrame,startCashRaw:cash(),sid:d.readOriginalSessionID()}));
        }
        return {event:'Logic',parameters:issuedPaid};
      } catch (error) { throw seal(error); }
    },
    exact(action) {
      guard(); need(phase === 'round-active' && followUp &&
        action === (followUp.event === 'EndGame' ? 'PLAY' : 'FREE_SPIN'), 'ACTUAL_NATIVE_FOLLOWUP');
      return followUp;
    },
    async call(event, parameters) {
      try {
        guard(); let request;
        if (parameters === issuedPaid && paid.has(parameters)) {
          need(event === 'Logic' && (phase === 'ready' || phase === 'ended'), 'ORIGINAL_PAID_CALL');
          request = await selector.paid(parameters); phase = 'round-active';
        } else {
          need(phase === 'round-active' && followUp && followUp.event === event &&
            followUp.parameters === parameters, 'EXACT_PRIVATE_NATIVE_FOLLOWUP_CAP');
          request = followUp; followUp = undefined;
        }
        need(request.event === event, 'SAME_ORIGINAL_AG_NATIVE_EVENT');
        const result = await d.exchangeOriginalNative(request.event,request.parameters);
        const frame = registerAccepted(result,event), decision = await selector.afterAccepted(result.delivery);
        const data = project({sessionScope:scope,game,sourceInitFrame:initFrame,roundScope,
          frame,step:result.step,currentCashRaw:cash(),actualNativeEndACK:decision.actualEndACK});
        if (decision.terminal) { need(event === 'EndGame', 'TRUE_END_ACK'); phase = 'ended'; roundScope = undefined; }
        else { followUp = decision.request; need(followUp, 'GENUINE_NEXT_REQUEST'); }
        return {...data,NextActionInfo:{nextAction:decision.nextAction},SGOwnSDKDecision:{...data.SGOwnSDKDecision,
          contract:'own32816-original-AG-native-next-end-DATA-preparation-v855',
          requestRecordingContract:'own32816-native-full-XML-request-record-v855',nativeRequestParameterField:'nativeRequestPayload',
          actualNativeEndReturned:decision.actualEndACK,noHistoricalResponseWhitelist:true,noSyntheticNativeAction:true}};
      } catch (error) { throw seal(error); }
    },
    getLastGameRequest() { return lastRecorded; },
    close() { seal(new Error('Original SG session closed')); },
    status() { return {gameId:'32816',phase,sealed,originalPaidIntents:serial,
      selector:selector.status(),networkClientIncluded:false,DBWrites:0,productionReady:false}; }
  });
};
