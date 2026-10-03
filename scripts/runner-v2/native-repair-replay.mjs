import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
import {receiptKey} from './durable-queue.mjs';

// Exact existing repair item plus its bounded immutable archive references.
// Legacy faults predate preparation publications; never invent an old proof.
export async function exportNativeRepairReplay({store, transport, plan, revisionHash, repairKey}) {
  assert(repairKey.startsWith('game-repair:'+plan.trialId+':') && /^[a-f0-9]{64}$/.test(repairKey.split(':').at(-1)),
    'NATIVE_REPAIR_FIXED_KEY');
  const campaign=(await store.get('state','campaign'))?.value;
  const game=campaign?.games?.find(g=>g.game_id===plan.gameId);
  const repair=(await store.get('state',repairKey))?.value;
  assert(game?.status==='parked-protocol' && game.repairKey===repairKey && repair?.schema==='sg-game-repair-v1'
    && repair.gameId===plan.gameId && repair.trialId===plan.trialId && repair.status==='pending-adapter'
    && repair.sourceAllowance===0 && repair.requiresNewSession===true, 'NATIVE_REPAIR_CURRENT_BINDING');
  assert(Array.isArray(repair.evidence) && repair.evidence.length>0 && repair.evidence.length<=100
    && new Set(repair.evidence.map(e=>e.key)).size===repair.evidence.length
    && repair.evidence.every(e=>e.key.includes(plan.trialId)&&/^[a-f0-9]{64}$/.test(e.hash)), 'NATIVE_REPAIR_PAGE');
  const archive=(await store.get('journal',repair.archiveKey))?.value;
  assert(archive,'NATIVE_REPAIR_ARCHIVE');
  const rows=await store.getMany('journal',repair.evidence.map(e=>e.key));
  assert(rows.length===repair.evidence.length,'NATIVE_REPAIR_PAGE');
  const manifest={repairKey,repair,archiveHash:hash(archive)},failureEvidenceHash=hash(manifest),faults=[];
  for(const [i,row] of rows.entries()) {
    const value=row?.value,ref=repair.evidence[i];
    assert(value && hash(value.batch??value)===ref.hash,'NATIVE_REPAIR_ARCHIVE_CHANGED');
    const pending=value.pending??value.batch?.pending;
    if(!pending)continue;
    assert(pending.awaiting===null && pending.raw?.fixtureOnly===false, 'NATIVE_REPAIR_UNKNOWN_RESPONSE');
    const evidence={plan,raw:pending.raw,archiveKey:ref.key,archiveHash:ref.hash};
    faults.push({raw:pending.raw,evidence,evidenceHash:hash(evidence),failureEvidenceHash});
  }
  assert(faults.length>0,'NATIVE_REPAIR_NO_FAULT_PREFIX');
  const receipts=await store.getMany('journal',Array.from({length:100},(_,i)=>receiptKey(plan.trialId,i+1)));
  const record=receipts.map(r=>r?.value).find(r=>r?.gameId===plan.gameId&&r.fixtureOnly===false&&r.normalized&&r.raw);
  assert(record,'NATIVE_REPAIR_COMPLETE_RECEIPT');
  const readbacks=await transport.request('rounds_read',{trialId:plan.trialId,ids:[record._id]});
  assert(readbacks.length===1&&stable(readbacks[0])===stable(record),'NATIVE_REPAIR_FULL_READBACK');
  return {schema:'sg-native-repair-replay-task-v1',gameId:plan.gameId,plan,planHash:hash(plan),revisionHash,
    manifest,failureEvidenceHash,records:[record],readbacks,faults,sourceAllowance:0};
}

export function validateNativeRepairReplay(task) {
  assert(task?.schema==='sg-native-repair-replay-task-v1'&&task.sourceAllowance===0&&task.planHash===hash(task.plan)
    &&task.gameId===task.plan.gameId&&task.manifest?.repair?.gameId===task.gameId
    &&task.manifest.repair.sourceAllowance===0&&task.manifest.repair.status==='pending-adapter'
    &&task.failureEvidenceHash===hash(task.manifest)&&task.faults?.length>0
    &&task.faults.every(f=>f.failureEvidenceHash===task.failureEvidenceHash&&f.evidenceHash===hash(f.evidence)
      &&hash(f.raw)===hash(f.evidence.raw))&&task.records?.length===1&&task.readbacks?.length===1
    &&stable(task.records[0])===stable(task.readbacks[0]),'NATIVE_REPAIR_DELIVERY_CHANGED');
  return {...task,schema:'sg-preparation-replay-task-v1'};
}
