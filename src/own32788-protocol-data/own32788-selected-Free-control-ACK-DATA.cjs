'use strict';

// Control receipts never stand in for a spin, money result, or terminal ACK.
exports.createOwn32788SelectedFreeControlACKDATA = function ({game, DOM, source}) {
  const need = (ok, message) => {
    if (!ok) throw Object.assign(new Error('OWN32788_CONTROL_HOLD_' + message), {retryAllowed:false});
  };
  need(game?.gameId === '32788' && game.dbName === 'sg_lockitlink' &&
    game.sg?.runtimeGameId === 33010 && game.sg.betRaw === 50 &&
    game.sg.header?.gameID === '20158' && DOM?.DOMParser && source, 'OWN_INPUTS');
  const children = (node, tag) => Array.from(node?.childNodes || [])
    .filter(x => x.nodeType === 1 && x.nodeName === tag);
  const one = (node, tag) => { const rows = children(node, tag); need(rows.length === 1, 'ONE_' + tag); return rows[0]; };
  const integer = (node, field) => {
    const attr = node?.attributes?.getNamedItem(field);
    need(attr && /^(0|[1-9][0-9]*)$/.test(attr.value) && Number.isSafeInteger(Number(attr.value)), 'ACTUAL_' + field);
    return Number(attr.value);
  };
  const receipts = new WeakMap(), seen = new WeakSet();
  let retained = null, retainedNext = null, nativeCompletion = null, sent = false, sealed = false;
  function parse(text, type) {
    need(typeof text === 'string' && text.length > 0 && !/<!DOCTYPE/i.test(text), 'RAW_XML');
    const document = new DOM.DOMParser().parseFromString(text, 'text/xml'), root = document.documentElement;
    need(root?.nodeName === type && !document.getElementsByTagName('parsererror').length &&
      !document.getElementsByTagName('Error').length && !document.getElementsByTagName('Errors').length, 'SUCCESS_XML');
    return {document, root};
  }
  function current(frame) {
    need(!sealed && frame?.game === game && frame.sessionScope && frame.roundScope &&
      source.has(frame) && source.readCurrent(frame.sessionScope, frame.roundScope) === frame &&
      source.envelopeAccepted(frame) === true && frame.msgId === 'Logic' && frame.httpStatus === 200 &&
      source.readNormalCaptureMode(frame.sessionScope, frame.roundScope) === 'normal-capture', 'CURRENT_FRAME');
  }
  return Object.freeze({
    isAcceptedReceipt(receipt) { return !sealed && receipt === retained && receipts.has(receipt); },
    accept({ticket, dispatch, frame}) {
      current(frame);
      need(!retained && !seen.has(frame) && ticket && dispatch && source.hasDispatch(dispatch) &&
        source.isCurrentConsumedChoiceTicket(ticket, dispatch) === true &&
        ticket.event === 'Logic' && ticket.parameters?.selectedBonus === 0 &&
        Object.keys(ticket.parameters).length === 1 && dispatch.event === 'Logic' &&
        dispatch.sessionScope === frame.sessionScope && dispatch.roundScope === frame.roundScope &&
        dispatch.originalResponseFrame === ticket.originalResponseFrame &&
        dispatch.requestPayload === ticket.requestPayload && frame.requestPayload === dispatch.requestPayload &&
        dispatch.requestSessionID === ticket.requestSessionID && frame.requestSessionID === dispatch.requestSessionID,
      'MATCHED_SELECTED_ZERO_TICKET');
      const request = parse(dispatch.requestPayload, 'GameRequest').root;
      need(request.getAttribute('type') === 'Logic' && one(request, 'Header').getAttribute('sessionID') === dispatch.requestSessionID &&
        one(request, 'BonusChoice').getAttribute('selectedBonus') === '0', 'ACTUAL_SELECTED_ZERO_REQUEST');
      const {document, root} = parse(frame.responsePayload, 'GameResponse'), header = one(root, 'Header');
      need(root.getAttribute('type') === 'Logic' && header.getAttribute('gameID') === '20158' &&
        header.getAttribute('versionID') === '1_0' && header.getAttribute('isRecovering') === 'N' &&
        header.getAttribute('sessionID') && header.getAttribute('sessionID') === source.readOriginalSessionID(frame.sessionScope),
      'ACTUAL_ACCEPTED_RESPONSE_CURSOR');
      const result = one(root, 'GameResult'), features = children(result, 'Feature');
      need(integer(result, 'stake') === 50 && features.length === 1 &&
        features[0].getAttribute('index') === '2' && features[0].getAttribute('name') === 'FreeGame', 'FREE_INTRO_CONTROL');
      // The actual ordinal9 GameWinInfo is a ROOT sibling of GameResult.
      // Retain it verbatim in the original frame; it does not turn the ACK into a spin.
      need(children(result, 'GameWinInfo').length === 0 && !['ReelResults','FSInfo','LilInfo','BaseGameRecoveryInfo','LilRecoveryInfo']
        .some(tag => document.getElementsByTagName(tag).length), 'NOT_A_SPIN_OR_RECOVERY');
      const rootWin = one(root, 'GameWinInfo');
      integer(rootWin, 'totalWagerWin'); need(rootWin.getAttribute('isMaxWin') === 'N', 'ACTUAL_ROOT_WIN');
      const bg = one(features[0], 'BGInfo'), awarded = integer(bg, 'numTotalFreeSpinsAwarded');
      need(awarded > 0 && bg.getAttribute('lastFreeSpin') === 'N', 'ACTUAL_CONTROL_AWARD');
      const receipt = Object.freeze({kind:'own32788-selected-Free-control-ACK', frame, ticket, dispatch,
        sessionScope:frame.sessionScope, roundScope:frame.roundScope, responseSessionID:header.getAttribute('sessionID'),
        actualAwardedSpins:awarded, continuation:'await-actual-native-dispatch', moneyResult:false, terminal:false});
      receipts.set(receipt, {frame}); seen.add(frame); retained = receipt;
      return receipt;
    },
    onNativeIntroTransitionComplete(receipt, event) {
      need(!sealed && receipt === retained && receipts.has(receipt) && !nativeCompletion && !sent,
        'ONE_NATIVE_INTRO_COMPLETION'); current(receipt.frame);
      need(event && source.isActualNativeIntroCompletion(event) === true &&
        event.type === 'TransitionEvent_INTRO_TRANSITION_COMPLETE' && event.game === game &&
        event.sessionScope === receipt.sessionScope && event.roundScope === receipt.roundScope &&
        event.originalResponseFrame === receipt.frame, 'ACTUAL_NATIVE_INTRO_CALLBACK');
      nativeCompletion = event;
    },
    nextFromActualNative(receipt) {
      need(!sealed && receipt === retained && receipts.has(receipt) && !retainedNext && !sent, 'ONE_CONTROL_NATIVE_NEXT');
      current(receipt.frame);
      // The old FREE_SPIN_INTRO entry describes the request already ACKed.
      // It cannot authorize another request; require an actually issued native capability.
      need(nativeCompletion, 'ACTUAL_NATIVE_INTRO_CALLBACK');
      const next = source.readActualNativeNextForControl(receipt, nativeCompletion);
      need(next && source.isIssuedNativeDispatch(next) === true && next.event === 'Logic' &&
        next.game === game && next.sessionScope === receipt.sessionScope && next.roundScope === receipt.roundScope &&
        next.originalResponseFrame === receipt.frame && next.requestSessionID === receipt.responseSessionID &&
        Array.isArray(next.requestHeaders), 'ACTUAL_POST_ACK_NATIVE_DISPATCH');
      const request = parse(next.requestPayload, 'GameRequest').root, header = one(request, 'Header');
      need(request.getAttribute('type') === 'Logic' && header.getAttribute('gameID') === '20158' &&
        header.getAttribute('sessionID') === receipt.responseSessionID && !request.getElementsByTagName('BonusChoice').length,
      'CURRENT_NATIVE_LOGIC_NO_STICKY_CHOICE');
      retainedNext = next;
      return next;
    },
    consumeNext(receipt, candidate) {
      need(!sealed && receipt === retained && candidate === retainedNext && candidate && !sent, 'UNUSED_NATIVE_NEXT');
      current(receipt.frame); sent = true; return candidate;
    },
    seal() { sealed = true; },
    status() { return {controlRetained:!!retained, nativeCompletionRetained:!!nativeCompletion, nativeNextRetained:!!retainedNext, sent, sealed,
      retryAllowed:false, moneyResults:0, terminalACKs:0}; }
  });
};
