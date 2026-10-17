'use strict';

// Private, disabled preparation. The existing original SG wire owner alone
// supplies consumed paid-intent and accepted-response capabilities.
exports.createOwn32816OriginalMainSelector = function(d) {
  const need = (ok, message) => { if (!ok) throw Error('OWN32816_NATIVE_SELECTOR_' + message); };
  for (const name of ['readHost', 'assertOriginalOpen', 'consumeOriginalPaidIntent',
    'assertOriginalAcceptedDelivery', 'readOriginalSessionID', 'wallNow', 'yieldNative']) {
    need(typeof d[name] === 'function', 'DEPENDENCY_' + name);
  }
  need(d.providerData && typeof d.providerData.captureCurrentNative === 'function', 'PRIVATE_V5_PORT');
  need(Number.isSafeInteger(d.maxTicks) && d.maxTicks > 0 && d.maxTicks <= 100000, 'EXPLICIT_TICK_BUDGET');
  need(Number.isSafeInteger(d.timeoutMs) && d.timeoutMs > 0 && d.timeoutMs <= 30000, 'EXPLICIT_WALL_BUDGET');
  let pinned, sealed = false, phase = 'before-init', lastDispatchEvent, roundIntent;
  let paidStarts = 0, ticks = 0, acceptedEnds = 0;
  const usedDeliveries = new WeakSet();
  function acceptDelivery(delivery, event) {
    need(delivery && typeof delivery === 'object' && !usedDeliveries.has(delivery), 'ONE_USE_ORIGINAL_DELIVERY');
    d.assertOriginalAcceptedDelivery(delivery, event, d.readOriginalSessionID());
    usedDeliveries.add(delivery);
  }

  function host() {
    need(!sealed, 'SEALED'); d.assertOriginalOpen();
    const h = d.readHost(), Main = h?.context?.sgigame?.Main;
    const Model = h?.context?.sgigame?.GameStateModel;
    need(h && h.disposed !== true && typeof Main === 'function' && typeof Model === 'function', 'OWN_MAIN_TYPES');
    const main = h.outerGame?.main;
    need(main instanceof Main && main.startAutoplay === Main.prototype.startAutoplay, 'ORIGINAL_MAIN_PUBLIC_ACTION');
    const entries = main._context?.injector?.singletonMap;
    need(Array.isArray(entries), 'ORIGINAL_INJECTOR');
    const models = entries.filter(e => e.instance instanceof Model);
    need(models.length === 1 && models[0].instance.getCurrentState === Model.prototype.getCurrentState,
      'ONE_ORIGINAL_STATE_MODEL');
    const current = { h, main, Model, model: models[0].instance, Main };
    if (!pinned) pinned = current;
    need(Object.keys(current).every(k => current[k] === pinned[k]), 'PINNED_HOST_IDENTITY');
    need(Array.isArray(h.pending) && h.pending.length <= 1, 'ONE_NATIVE_PENDING');
    need(h.errors.length === 0 && typeof h.runDue === 'function', 'HEALTHY_ORIGINAL_HOST');
    return current;
  }

  function idle(x) {
    const states = x.h.context.sgigame.BaseGameStates, subgames = x.h.context.sgigame.SubGames;
    need(states && subgames, 'ORIGINAL_STATE_CONSTANTS');
    return x.model.getCurrentState()?.stateName === states.IDLE_STATE &&
      x.model.getSubGame() === subgames.BASE_GAME && x.h.pending.length === 0;
  }

  function stop(error) { sealed = true; phase = 'sealed'; throw error; }
  async function next() {
    try {
      const until = d.wallNow() + d.timeoutMs; let localTicks = 0;
      while (true) {
        const x = host();
        const request = d.providerData.captureCurrentNative();
        if (request) {
          need(['Logic', 'EndGame'].includes(request.event), 'ACTUAL_NATIVE_NEXT_EVENT');
          need(x.h.pending.length === 1 && x.h.pending[0].event === request.event, 'SAME_NATIVE_PENDING');
          lastDispatchEvent = request.event;
          return request;
        }
        need(d.wallNow() < until && localTicks < d.maxTicks, 'FINITE_NEXT_BUDGET');
        need(x.h.runDue(), 'NO_MAPPED_NATIVE_CONTINUATION');
        localTicks++; ticks++;
        await d.yieldNative();
      }
    } catch (error) { return stop(error); }
  }

  return Object.freeze({
    acceptInit(delivery) {
      try {
        need(phase === 'before-init', 'ONE_INIT');
        acceptDelivery(delivery, 'Init');
        need(idle(host()), 'INIT_ACK_NATIVE_IDLE'); phase = 'ready';
      } catch (error) { stop(error); }
    },
    async paid(intent) {
      try {
        const x = host();
        need((phase === 'ready' || phase === 'ended') && idle(x), 'CLOSED_ORIGINAL_IDLE_BEFORE_PAID');
        d.consumeOriginalPaidIntent(intent, d.readOriginalSessionID());
        roundIntent = intent; phase = 'round-active'; paidStarts++;
        // Existing original Main API emits its own GLSServer request. Neither
        // the request XML, native state nor autoplay callback is manufactured.
        x.main.startAutoplay(1);
        const request = await next(); need(request.event === 'Logic', 'ACTUAL_FIRST_LOGIC');
        return request;
      } catch (error) { return stop(error); }
    },
    async afterAccepted(delivery) {
      try {
        need(phase === 'round-active' && roundIntent, 'ACTIVE_ORIGINAL_PAID_SCOPE');
        need(['Logic', 'EndGame'].includes(lastDispatchEvent), 'EXACT_PRIOR_NATIVE_EVENT');
        acceptDelivery(delivery, lastDispatchEvent);
        if (lastDispatchEvent === 'EndGame') {
          const until=d.wallNow()+d.timeoutMs;let localTicks=0;
          while(!idle(host())) {
            const x=host();
            need(x.h.pending.length===0 && !d.providerData.captureCurrentNative(), 'NO_NEXT_REQUEST_BEFORE_END_IDLE');
            need(d.wallNow()<until && localTicks<d.maxTicks, 'FINITE_END_IDLE_BUDGET');
            need(x.h.runDue(), 'ORIGINAL_END_ACK_PROGRESS');
            localTicks++;ticks++;await d.yieldNative();
          }
          need(idle(host()), 'ACTUAL_END_ACK_NATIVE_IDLE');
          phase = 'ended'; acceptedEnds++; roundIntent = undefined;
          return Object.freeze({ terminal: true, nextAction: 'SPIN', actualEndACK: true });
        }
        const request = await next();
        return Object.freeze({ terminal: false, request,
          nextAction: request.event === 'EndGame' ? 'PLAY' : 'FREE_SPIN', actualEndACK: false });
      } catch (error) { return stop(error); }
    },
    seal() { sealed = true; phase = 'sealed'; },
    status() { return { gameId: '32816', phase, sealed, paidStarts, acceptedEnds, ticks,
      physicalTransportIncluded: false, terminalSynthesized: false, productionReady: false }; }
  });
};
