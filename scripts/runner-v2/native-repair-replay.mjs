import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
import {receiptKey} from './durable-queue.mjs';

// Formal retirement references a paged ledger instead of individual legacy
// batches. Follow its immutable pages and original batch snapshots, never an
// arbitrary journal search or a truncated first page.
async function retiredBatchRows(store,plan,archive,repair,rows){
  if(archive.schema!=='sg-count-prepared-before-v1')return rows.map((row,i)=>({row,ref:repair.evidence[i]}));
  assert(rows.length===1&&repair.evidence[0].key.endsWith(':complete'),'NATIVE_REPAIR_RETIREMENT');
  const result=rows[0]?.value,prefix=repair.evidence[0].key.slice(0,-':complete'.length);
  const before=(await store.get('journal',prefix+':before'))?.value;
  const pool=(await store.get('state','pool:'+plan.trialId))?.value;
  assert(result?.schema==='sg-retired-count-result-v1'&&hash(result)===repair.evidence[0].hash
    &&result.trialId===plan.trialId&&result.sourceRequests===0&&result.newBetAllowance===0
    &&before?.schema==='sg-retired-count-before-v1'&&before.plan.trialId===plan.trialId
    &&hash({plan:before.plan,pool:before.pool})===result.beforeHash
    &&pool?.retiredCount===prefix&&pool.confirmed===result.completePreserved
    &&pool.nextBatchId===before.pool.nextBatchId&&Number.isSafeInteger(pool.nextBatchId)
    &&pool.nextBatchId>1&&pool.nextBatchId<=600001,'NATIVE_REPAIR_RETIREMENT');
  const out=[];
  for(let first=1;first<pool.nextBatchId;first+=100){
    const page=(await store.get('journal',prefix+':page:'+first))?.value;
    const ids=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>first+i);
    assert(page?.schema==='sg-retired-count-page-v1'&&page.entries.length===ids.length
      &&page.entries.every((e,i)=>e.batchId===ids[i]),'NATIVE_REPAIR_RETIREMENT_PAGE');
    const batches=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
    assert(batches.length===ids.length,'NATIVE_REPAIR_RETIREMENT_PAGE');
    for(const [i,row] of batches.entries()){
      let value=row?.value;
      assert(value?.id===ids[i],'NATIVE_REPAIR_RETIREMENT_PAGE');
      const key=prefix+':batch:'+ids[i];
      if(hash(value)!==page.entries[i].beforeHash){
        const original=(await store.get('journal',key))?.value;
        assert(original?.schema==='sg-retired-count-batch-v1'&&value.retiredCount===key,
          'NATIVE_REPAIR_RETIREMENT_BATCH');value=original.batch;
      }
      assert(hash(value)===page.entries[i].beforeHash,'NATIVE_REPAIR_RETIREMENT_BATCH');
      out.push({row:{value},ref:{key:hash(row.value)===hash(value)?`batch:${plan.trialId}:${ids[i]}`:key,hash:hash(value)}});
    }
  }
  return out;
}

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
  for(const {row,ref} of await retiredBatchRows(store,plan,archive,repair,rows)) {
    const value=row?.value;
    assert(value && hash(value.batch??value)===ref.hash,'NATIVE_REPAIR_ARCHIVE_CHANGED');
    const batch=value.batch??value;
    let pending=value.pending??value.batch?.pending, abandoned;
    if(batch.abandonedDemo) {
      assert(!pending && Number.isSafeInteger(batch.id)
        && batch.abandonedDemo.startsWith(`abandoned-demo:${plan.trialId}:${batch.id}:`),
      'NATIVE_REPAIR_ABANDONED_BINDING');
      abandoned=(await store.get('journal',batch.abandonedDemo))?.value;
      pending=abandoned?.pending;
      assert(abandoned?.schema==='sg-abandoned-demo-v1' && abandoned.trialId===plan.trialId
        && abandoned.batchId===batch.id && abandoned.disposition==='interrupted-abandoned-without-replay'
        && abandoned.sourceRequests===0 && !abandoned.pendingOriginal && pending
        && pending.sequence===batch.journaled+1 && pending.sequence<=batch.end
        && batch.abandonedDemo===`abandoned-demo:${plan.trialId}:${batch.id}:${hash(pending)}`,
      'NATIVE_REPAIR_ABANDONED_BINDING');
    }
    if(!pending)continue;
    assert(pending.awaiting===null && pending.raw?.fixtureOnly===false, 'NATIVE_REPAIR_UNKNOWN_RESPONSE');
    const evidence={plan,raw:pending.raw,archiveKey:ref.key,archiveHash:ref.hash,
      ...(abandoned?{abandonedKey:batch.abandonedDemo,abandonedHash:hash(abandoned)}:{})};
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
