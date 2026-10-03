import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
import {ACTION_VERSION as HUFF_ACTION_VERSION,ACTION_CONTRACT_HASH as HUFF_ACTION_HASH} from '../trial/huff-action-contract.mjs';

export function replayFaultPlan(task,fault){
  if(fault.raw.requestFlowVersion!==HUFF_ACTION_VERSION||task.plan.featureProfile===HUFF_ACTION_VERSION)return task.plan;
  // A repair may contain both original base records and a later action-run
  // fault. Keep every raw byte and verify that fault with its captured plan.
  const scoped=fault.evidence?.captureEvidence,link=task.captureLink,e=scoped??link?.captureEvidence,plan=e?.plan;
  const bound=scoped!==undefined?fault.evidenceHash===hash(fault.evidence)
    &&e?.receipt?.schema==='sg-capture-fault-receipt-v1'&&e.receipt.gameId===task.gameId&&e.receipt.trialId===task.plan.trialId
    &&e.receipt.sourceAllowance===0&&e.receipt.requiresNewSession===true
    &&e.receipt.archiveKey===fault.evidence.abandonedKey&&e.receipt.archiveHash===fault.evidence.abandonedHash
    &&e.receiptKey===`capture-fault:${task.plan.trialId}:${e.receipt.batchId}:${hash(e.receipt)}`
    :link?.failureEvidenceHash===hash(e);
  assert(task.gameId===32714&&bound&&plan?.gameId===32714
    &&e.receipt?.planHash===hash(plan)&&e.receipt.rawHash===hash(fault.raw)
    &&hash(e.raw)===hash(fault.raw)&&/^[a-f0-9]{64}$/.test(plan.countAllocation??'')
    &&hash(plan)===hash({...task.plan,target:300000,countAllocation:plan.countAllocation,
      featureProfile:HUFF_ACTION_VERSION,actionContractHash:HUFF_ACTION_HASH}),
    'PREPARATION_REPLAY_ACTION_BINDING');
  return plan;
}

// A bounded replay of preserved real data supplies flow, settlement and storage
// gates. Gameplay classification is deliberately not part of this interface.
// The gates describe tested code/data scope, never whole-game coverage or quota.
export async function preparationReplayEvidence({task, revisionHash, parser, runnerNext, independentFields}) {
  assert(task?.schema === 'sg-preparation-replay-task-v1' && task.sourceAllowance === 0
    && task.gameId === task.plan?.gameId && task.planHash === hash(task.plan)
    && /^[a-f0-9]{64}$/.test(revisionHash) && task.revisionHash === revisionHash
    && typeof runnerNext === 'function' && typeof independentFields === 'function', 'PREPARATION_REPLAY_SCOPE');
  assert(Array.isArray(task.records) && task.records.length > 0 && task.records.length <= 100
    && Array.isArray(task.readbacks) && task.readbacks.length === task.records.length
    && new Set(task.records.map(r => r._id)).size === task.records.length, 'PREPARATION_REPLAY_RECORDS');
  const faults = task.faults ?? [];
  assert(Buffer.byteLength(JSON.stringify(task))<=6*1024*1024,'PREPARATION_REPLAY_BYTES');
  const until=Date.now()+180000;
  const call=async request=>{assert(Date.now()<until,'PREPARATION_REPLAY_DEADLINE');return parser.call(request);};
  assert(Array.isArray(faults) && faults.length <= 100
    && (!task.failureEvidenceHash || /^[a-f0-9]{64}$/.test(task.failureEvidenceHash) && faults.length > 0),
    'PREPARATION_REPLAY_FAILURE_REQUIRED');
  assert.deepEqual(await call({op: 'plan', plan: task.plan}), {validated: true});
  const route = [], settlement = [], persistence = [];
  for (const fault of faults) {
    assert(fault?.raw?.fixtureOnly === false && fault.evidenceHash === hash(fault.evidence)
      && hash(fault.evidence.raw) === hash(fault.raw)
      && (!task.failureEvidenceHash || (fault.failureEvidenceHash??fault.evidenceHash) === task.failureEvidenceHash), 'PREPARATION_REPLAY_FAULT_BINDING');
    const faultPlan=replayFaultPlan(task,fault);
    assert.deepEqual(await call({op:'plan',plan:faultPlan}),{validated:true});
    const next = await call({op: 'next', plan: faultPlan, raw: fault.raw});
    assert.deepEqual(runnerNext(fault.raw, faultPlan), next, 'PREPARATION_REPLAY_ROUTE_MISMATCH');
    if(next===null){
      const confirmed=task.records.filter(r=>hash(r)===fault.terminalRecordHash);
      assert(confirmed.length===1&&hash(confirmed[0].raw)===hash(fault.raw),
        'PREPARATION_REPLAY_FAULT_TERMINAL_UNCONFIRMED');
      // The normal record loop below independently verifies every prefix,
      // settlement, full record and readback before emitting any ready gate.
    }else assert(next?.MSGID && typeof next.MSGID === 'string', 'PREPARATION_REPLAY_FAULT_TERMINAL_UNCONFIRMED');
    route.push(hash({evidenceHash: fault.evidenceHash, next}));
  }
  // All evidence must pass before emitting any gate. A corrupt/missing record
  // cannot produce a partial ready item or overwrite an existing proof.
  for (const record of task.records) {
    assert(record.fixtureOnly === false && record.gameId === task.gameId && record.trialId === task.plan.trialId
      && record.runtimeGameId === task.plan.runtimeGameId && record.raw?.fixtureOnly === false,
      'PREPARATION_REPLAY_REAL_RECORD');
    const matches = task.readbacks.filter(r => r._id === record._id);
    assert(matches.length === 1 && stable(matches[0]) === stable(record), 'PREPARATION_REPLAY_READBACK');
    assert.deepEqual(await call({op: 'verify', plan: task.plan, raw: record.raw, record}), {verified: true});
    assert.deepEqual(await independentFields(record.raw, task.plan, record.normalized), record.normalized,
      'PREPARATION_REPLAY_SETTLEMENT_MISMATCH');
    const steps = record.raw.steps;
    assert(Array.isArray(steps) && steps.length > 0 && steps.length <= task.plan.maxSteps, 'PREPARATION_REPLAY_STEPS');
    for (let i = 1; i <= steps.length; i++) {
      const raw = {...record.raw, steps: steps.slice(0, i)};
      const next = await call({op: 'next', plan: task.plan, raw});
      assert.deepEqual(runnerNext(raw, task.plan), next, 'PREPARATION_REPLAY_ROUTE_MISMATCH');
      if (i === steps.length) assert.equal(next, null, 'PREPARATION_REPLAY_NOT_TERMINAL');
      else {
        assert(next?.MSGID === steps[i].msgId, 'PREPARATION_REPLAY_MISSING_STEP');
        assert.deepEqual(await call({op: 'intent', plan: task.plan, raw, payload: steps[i].requestPayload}), {validated: true});
      }
      route.push(hash({rawHash: hash(raw), next}));
    }
    settlement.push(hash({id: record._id, fields: record.normalized}));
    persistence.push(hash(record));
  }
  const evidence = {route, settlement, persistence};
  return {schema: 'sg-preparation-replay-review-v1', gameId: task.gameId, revisionHash,
    records: task.records.length, faults: faults.length, gameplayCoverageComplete: false,
    receipts: Object.entries(evidence).map(([gate, supportingHashes]) => ({schema: 'sg-preparation-gate-v1',
      gate, gameId: task.gameId, revisionHash, verified: true, sourceAllowance: 0,
      supportingHashes, ...(task.failureEvidenceHash ? {failureEvidenceHash: task.failureEvidenceHash} : {})})),
    sourceRequests: 0, mongoWrites: 0, replayAllowed: false, newBetAllowance: 0};
}
