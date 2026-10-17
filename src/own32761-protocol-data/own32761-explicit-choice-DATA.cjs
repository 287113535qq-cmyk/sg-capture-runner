'use strict';
// Protocol DATA for the accepted base-game -> explicit FreeSpinChoice edge only.
// This leaf creates a candidate. It neither sends it nor acknowledges a round.
exports.createOwn32761ExplicitChoiceDATA = function ({DOM, choiceDomain, vm, modelDATA}) {
  const need = (ok, code) => {
    if (!ok) throw Object.assign(new Error('OWN32761_CHOICE_HOLD_' + code), {
      own32761ChoiceHold: true, newRequestNotSent: true, retryAllowed: false
    });
  };
  need(DOM?.DOMParser && DOM?.XMLSerializer &&
    JSON.stringify(choiceDomain) === '[0,1,2,3,4]', 'SOURCE_DATA');
  const freeDecode = modelDATA && vm?.Script && modelDATA.schema === 'own32761-original-wire-model-DATA-v1261'
    ? new vm.Script('(' + modelDATA.sourceFunctions.decodeFree + ')').runInNewContext({}, {timeout:100}) : null;
  const one = (parent, name) => {
    const found = Array.from(parent.childNodes || []).filter(n => n.nodeType === 1 && n.nodeName === name);
    need(found.length === 1, 'ONE_' + name); return found[0];
  };
  const children = (parent, name) => Array.from(parent.childNodes || []).filter(n => n.nodeType === 1 && n.nodeName === name);
  const attr = (n, name) => {
    const a = n.attributes?.getNamedItem(name); need(a !== null && a !== undefined, 'EXPLICIT_' + name); return a.value;
  };
  const integer = (value, code) => {
    need(/^(?:0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value)), code); return Number(value);
  };
  const parse = (text, rootName, type) => {
    need(typeof text === 'string' && text.length > 0 && !/<!DOCTYPE/i.test(text), 'RAW_XML');
    const doc = new DOM.DOMParser().parseFromString(text, 'text/xml');
    const root = doc.documentElement;
    need(root?.nodeName === rootName && attr(root, 'type') === type &&
      doc.getElementsByTagName('parsererror').length === 0 &&
      doc.getElementsByTagName('Error').length === 0 && doc.getElementsByTagName('Errors').length === 0,
    'SUCCESSFUL_' + type + '_ENVELOPE');
    return {doc, root};
  };
  return Object.freeze({prepare({sessionScope, source, frame, initFrame, selectionIndex}) {
    need(sessionScope && source?.readCurrent?.(sessionScope) === frame && source.readInit?.(sessionScope) === initFrame && source.has?.(frame) &&
      source.readNormalCaptureMode?.(sessionScope) === 'normal-capture', 'PRIVATE_CURRENT_FRAME');
    need(frame?.msgId === 'Logic' && frame.httpStatus === 200 && initFrame?.msgId === 'Init' &&
      initFrame.httpStatus === 200, 'ACCEPTED_CURRENT_INIT_LOGIC');
    const response = parse(frame.responsePayload, 'GameResponse', 'Logic');
    const init = parse(initFrame.responsePayload, 'GameResponse', 'Init');
    const current = parse(frame.requestPayload, 'GameRequest', 'Logic');
    const initRequest = parse(initFrame.requestPayload, 'GameRequest', 'Init');
    const rh = one(response.root, 'Header'), ih = one(init.root, 'Header');
    const qh = one(current.root, 'Header'), iqh = one(initRequest.root, 'Header');
    for (const h of [rh, ih, qh, iqh]) {
      need(attr(h, 'gameID') === '20454' && attr(h, 'versionID') === '1_0', 'OWN_GAME_VERSION');
    }
    need(attr(rh, 'isRecovering') === 'N' && attr(ih, 'isRecovering') === 'N', 'NONRECOVERY');
    for (const name of ['affiliate', 'ccyCode', 'channel', 'freePlay', 'gameCodeRGI', 'glsID', 'lang', 'promotions', 'userID', 'userType', 'versionID']) {
      need(attr(qh, name) === attr(iqh, name), 'BOUND_REQUEST_' + name);
    }
    need(attr(qh, 'gameCodeRGI') === 'dancingdrumsexplosion', 'OWN_BACKEND');
    for (const name of ['REPLAY', 'FORCE']) {
      need(children(current.root, name).length === 0 && children(initRequest.root, name).length === 0, 'NORMAL_INITIAL_CHOICE_' + name);
    }
    const result = one(response.root, 'GameResult'), bg = one(result, 'BGInfo');
    const decision = one(result, 'DecisionInfo');
    // Exact source choice controller: !vb.Jj && Ok.wK. Do not gate on picksUsed
    // or on whether the response happens to include an FSInfo element.
    const fs = children(result, 'FSInfo'); need(fs.length <= 1, 'ONE_FS_INFO');
    if (fs.length) {
      need(freeDecode, 'SOURCE_FREE_DECODER');
      const dto = {}, model = {vb:{}};
      for (const [key, name] of Object.entries(modelDATA.typedFS)) {
        const a = fs[0].attributes.getNamedItem(name);
        if (a) dto[key] = integer(a.value, 'SOURCE_FS_' + name);
      }
      freeDecode.call({T:model}, dto); need(!model.vb.Jj, 'ACTIVE_FREE_IS_NOT_CHOICE');
    }
    const awards = integer(attr(decision, 'picksAwarded'), 'SOURCE_PICK_AWARD');
    need(awards > 0, 'SOURCE_CHOICE_AWARDED');
    const max = attr(bg, 'isMaxWin');
    need(['0', 'false', 'n', 'no'].includes(max.toLowerCase()), 'MAX_BRANCH_REQUIRES_OWN_MAPPING');
    const paid = integer(attr(one(current.root, 'Stake'), 'total'), 'SOURCE_PAID_TOTAL');
    need(paid > 0 && integer(attr(result, 'stake'), 'SOURCE_STAKE') === paid, 'UNCHANGED_SOURCE_WAGER');
    const cumulativeWin = integer(attr(bg, 'totalWagerWin'), 'SOURCE_CUMULATIVE_WIN');
    const sid = attr(rh, 'sessionID'); need(sid.length > 0, 'ACCEPTED_CURSOR');
    const base = {sourceChoiceIndexes: Object.freeze([...choiceDomain]), sourcePaidTotal: paid,
      sourceCumulativeWin: cumulativeWin, EndCandidate: false, transportAttempted: false,
      newProviderACK: false, fullFreeNextEndNotQualified: true};
    if (selectionIndex === undefined) return Object.freeze({...base,
      kind: 'source-explicit-free-mode-selection-pending', noDefaultSelection: true});
    need(Number.isInteger(selectionIndex) && choiceDomain.includes(selectionIndex), 'EXPLICIT_CHOICE_DOMAIN');
    // Source IPa copies Header/Stake/PaylineCount/AccountData and adds FreeSpinChoice.type.
    // Clone the accepted request so optional fields and monetary representation stay exact.
    need(Array.from(current.root.childNodes).every(n => n.nodeType !== 1 ||
      ['Header', 'Stake', 'PaylineCount', 'AccountData', 'FreeSpinChoice'].includes(n.nodeName)), 'UNMAPPED_REQUEST_FIELD');
    qh.setAttribute('sessionID', sid);
    for (const previous of children(current.root, 'FreeSpinChoice')) current.root.removeChild(previous);
    const choice = current.doc.createElement('FreeSpinChoice');
    choice.setAttribute('type', String(selectionIndex)); current.root.appendChild(choice);
    return Object.freeze({...base, kind: 'source-explicit-free-mode-choice-candidate', event: 'Logic',
      action: 'PICK_FREE_SPINS', selectionIndex,
      requestPayload: new DOM.XMLSerializer().serializeToString(current.doc)});
  }});
};
