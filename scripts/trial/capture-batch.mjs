import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export function fail(code, category='source_protocol', extra={}) {
  return Object.assign(new Error(code), {code, category, ...extra});
}
export function params(value) {
  const parsed = {};
  for (const part of String(value).split('&')) {
    if (!part) continue;
    const at = part.indexOf('=');
    if (at < 0 || Object.hasOwn(parsed, part.slice(0, at))) throw fail('AMBIGUOUS_SOURCE_RESPONSE');
    parsed[part.slice(0, at)] = part.slice(at + 1);
  }
  return parsed;
}
export function integer(value) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw fail('INVALID_SOURCE_MONEY');
  return Number(value);
}

// Shared by the live worker and an offline protocol/storage integration test.
// The caller provides the only source transport. There are no network calls here.
export async function captureBatch({plan, lease, owned, rpc, post, payload, bootstrap,
  prepareRound, mappingHash, evidence, state, shouldStop, requestStop, deadline, limit,
  onProgress=()=>{}, exchangeOperation='exchange_journal'}) {
  const sequenceTarget = lease.sequenceTarget ?? plan.target;
  if (lease.durable >= sequenceTarget) return rpc('release', owned);
  let pending = lease.pendingRound;
  if (pending) {
    assert.equal(pending.awaiting, null);
    state.balance = pending.raw.startBalanceRaw;
  } else if (state.balance === undefined) {
    state.balance = await bootstrap();
    evidence.initialBalanceRaw = state.balance;
  }
  let sequence = lease.durable + 1, prepared = null;
  while (sequence <= sequenceTarget && evidence.completedThisRun < limit
      && (!shouldStop() && performance.now() < deadline || pending || prepared)) {
    let raw, attempt, intentReady = false;
    if (pending) {
      raw = pending.raw; attempt = pending.attempt; sequence = pending.sequence; pending = null;
    } else {
      if (state.balance < 2500) {
        const previous = state.balance;
        state.balance = await bootstrap();
        if (state.balance <= previous) throw fail('DEMO_BALANCE_REFRESH_FAILED');
        evidence.demoBalanceRefreshes = (evidence.demoBalanceRefreshes || 0) + 1;
      }
      raw = {fixtureOnly:false, protocol:'nextgen', sourceKey:plan.sourceKey,
        roundFieldsVersion:'sg-round-fields-v1', startBalanceRaw:state.balance, steps:[]};
      if (prepared) {
        assert.equal(prepared.sequence, sequence); assert.equal(prepared.startBalanceRaw, state.balance);
        attempt = prepared.attempt; prepared = null;
      } else {
        attempt = randomUUID();
        await rpc('begin', {...owned, sequence, attempt, startBalanceRaw:state.balance, requestPayload:payload('BET')});
      }
      intentReady = true;
    }
    while (true) {
      const msg = raw.steps.length ? 'FREE_GAME' : 'BET';
      if (raw.steps.length >= plan.maxSteps) throw fail('ROUND_STEP_LIMIT');
      if (!intentReady) await rpc('intent', {...owned, sequence, requestPayload:payload(msg)});
      const step = await post(payload(msg), msg);
      evidence.sourceElapsedMs = (evidence.sourceElapsedMs || 0) + step.elapsedMs;
      raw.steps.push(step);
      let normalized, following, remaining = null;
      try { remaining = step.sourceRejected ? null : integer(params(step.responsePayload).NFG ?? '0'); } catch {}
      if (remaining === 0) {
        try { normalized = prepareRound(raw, {buy:0, bonus:raw.steps.some(s => s.msgId === 'FREE_GAME') ? 1 : 0, typeMappingHash:mappingHash}); }
        catch { /* Preserve the original response before server validation rejects it. */ }
      }
      if (remaining > 0 && raw.steps.length < plan.maxSteps) {
        following = {sequence, requestPayload:payload('FREE_GAME')};
      } else if (normalized && sequence < sequenceTarget && evidence.completedThisRun + 1 < limit
          && !shouldStop() && performance.now() + 2000 < deadline && normalized.money.endBalanceRaw >= 2500) {
        following = {sequence:sequence + 1, attempt:randomUUID(), startBalanceRaw:normalized.money.endBalanceRaw,
          requestPayload:payload('BET')};
      }
      const result = await rpc(exchangeOperation, {...owned, sequence, step,
        ...(normalized ? {normalized} : {}), ...(following ? {following} : {})});
      if (result.stopRequested) requestStop();
      if (result.stopRequested && !result.complete) throw fail('GLOBAL_SOURCE_STOPPED', 'storage');
      intentReady = result.followingIntentDurable === true;
      if (result.complete) {
        state.balance = result.endBalanceRaw; evidence.endCheckpoint = result.checkpoint;
        if (intentReady) prepared = following;
        break;
      }
    }
    evidence.completedThisRun++; sequence++;
    if (evidence.completedThisRun % 100 === 0) onProgress();
  }
  const result = await rpc('release', owned);
  evidence.endCheckpoint = result.checkpoint;
  return result;
}

export async function runDynamicBatches({rpc, identity, capture, shouldStop, deadline, onLease=()=>{}}) {
  const registered = await rpc('register', identity);
  const worker = {owner:identity.owner, workerEpoch:registered.workerEpoch};
  while (!shouldStop() && performance.now() < deadline) {
    const lease = await rpc('next', worker);
    if (lease.done) return;
    if (lease.waitingForWorkers) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    const owned = {...worker, epoch:lease.epoch, batchId:lease.batchId};
    onLease(lease, owned);
    const result = await capture(lease, owned);
    if (result.status !== 'complete') return; // Partial batch stays with this session.
  }
}
