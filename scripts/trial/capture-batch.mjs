import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nextRequest, roundMapping} from './squid-protocol.mjs';
import {actionContract} from './pyramids-action-contracts.mjs';

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
  prepareRound, mappingHash, extensionHash, evidence, state, shouldStop, requestStop, deadline, limit,
  onProgress=()=>{}, exchangeOperation='exchange_journal',
  protocol='nextgen', startMessage='BET', route=nextRequest, mapping=roundMapping}) {
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
      if(plan.adapter==='veryfruity-wms-action-v1'&&state.balance<plan.betRaw)throw fail('DEMO_BALANCE_EXHAUSTED');
      if (plan.adapter!=='veryfruity-wms-action-v1'&&state.balance < 2500) {
        const previous = state.balance;
        state.balance = await bootstrap();
        if (state.balance <= previous) throw fail('DEMO_BALANCE_REFRESH_FAILED');
        evidence.demoBalanceRefreshes = (evidence.demoBalanceRefreshes || 0) + 1;
      }
      raw = {fixtureOnly:false, protocol, sourceKey:plan.sourceKey,
        roundFieldsVersion:'sg-round-fields-v1', startBalanceRaw:state.balance, steps:[]};
      const contract=actionContract(plan);
      if(contract){raw.requestFlowVersion=contract.version;raw.actionContractHash=contract.hash;}
      if (prepared) {
        assert.equal(prepared.sequence, sequence); assert.equal(prepared.startBalanceRaw, state.balance);
        attempt = prepared.attempt; prepared = null;
      } else {
        attempt = randomUUID();
        await rpc('begin', {...owned, sequence, attempt, startBalanceRaw:state.balance, requestPayload:payload(startMessage)});
      }
      intentReady = true;
    }
    let next=route(raw);
    while (true) {
      if(!next)throw fail('ROUND_ALREADY_SETTLED');
      const msg=next.MSGID, requestPayload=payload(msg,next);
      if (raw.steps.length >= plan.maxSteps) throw fail('ROUND_STEP_LIMIT');
      if (!intentReady) await rpc('intent', {...owned, sequence, requestPayload});
      const step = await post(requestPayload, msg);
      evidence.sourceElapsedMs = (evidence.sourceElapsedMs || 0) + step.elapsedMs;
      raw.steps.push(step);
      let normalized, following, continuation, remaining = null;
      try { if(!step.sourceRejected){continuation=route(raw);remaining=continuation?1:0;} } catch {}
      if (remaining === 0) {
        try { normalized = prepareRound(raw, mapping(raw,mappingHash,extensionHash)); }
        catch { /* Preserve the original response before server validation rejects it. */ }
      }
      if (remaining > 0 && raw.steps.length < plan.maxSteps) {
        following = {sequence, requestPayload:payload(continuation.MSGID,continuation)};
      } else if (normalized && sequence < sequenceTarget && evidence.completedThisRun + 1 < limit
          && !shouldStop() && performance.now() + 2000 < deadline
          && normalized.money.endBalanceRaw >= (plan.adapter==='veryfruity-wms-action-v1'?plan.betRaw:2500)) {
        following = {sequence:sequence + 1, attempt:randomUUID(), startBalanceRaw:normalized.money.endBalanceRaw,
          requestPayload:payload(startMessage)};
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
      // Reuse the decision for this exact prefix. Appending a response is the
      // only operation that changes it; do not rescan the same history twice.
      next=remaining===null?route(raw):continuation;
    }
    evidence.completedThisRun++; sequence++;
    if (evidence.completedThisRun % 100 === 0) onProgress();
  }
  const result = await rpc('release', owned);
  evidence.endCheckpoint = result.checkpoint;
  return result;
}

export async function runDynamicBatches({rpc, identity, capture, shouldStop, deadline,
  onLease=()=>{}, startupTimeoutMs=180000}) {
  const registered = await rpc('register', identity);
  if (registered.done) return;
  const worker = {owner:identity.owner, workerEpoch:registered.workerEpoch};
  const readyDeadline = performance.now() + startupTimeoutMs;
  while (!shouldStop() && performance.now() < deadline) {
    const lease = await rpc('next', worker);
    if (lease.done || lease.paused) return;
    if (lease.waitingForWorkers) {
      if (performance.now() >= readyDeadline) throw fail('POOL_RUNNERS_NOT_READY','storage');
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    const owned = {...worker, epoch:lease.epoch, batchId:lease.batchId};
    onLease(lease, owned);
    const result = await capture(lease, owned);
    if (result.status !== 'complete') return; // Partial batch stays with this session.
  }
}
