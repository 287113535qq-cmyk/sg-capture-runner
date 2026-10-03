import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
import {receiptKey} from './durable-queue.mjs';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import {bindPreparedPlanHash} from './prepared-count-plan-binding.mjs';
import {ACTION_VERSION as HUFF_ACTION_VERSION} from '../trial/huff-action-contract.mjs';

// Formal retirement references a paged ledger instead of individual legacy
// batches. Follow its immutable pages and original batch snapshots, never an
// arbitrary journal search or a truncated first page.
async function retiredBatchRows(store,plan,archive,repair,rows,repairKey,transport){
  if(!['sg-count-prepared-before-v1','sg-count-shared-before-v1'].includes(archive.schema))
    return rows.map((row,i)=>({row,ref:repair.evidence[i]}));
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
  if(archive.terminalRecords){
    const closureKey=repair.archiveKey.slice(0,-':before'.length),closed=(await store.get('journal',closureKey+':complete'))?.value;
    assert(archive.schema==='sg-count-shared-before-v1'&&closed?.schema==='sg-count-shared-close-v1'
      &&closed.repairKey===repairKey&&Array.isArray(archive.terminalRecords)
      &&closed.receivedTerminalsReconciled===archive.terminalRecords.length
      &&archive.terminalRecords.length>0&&archive.terminalRecords.length<=100
      &&new Set(archive.terminalRecords.map(t=>t.batchId)).size===archive.terminalRecords.length,'NATIVE_REPAIR_TERMINALS');
    for(const ref of archive.terminalRecords){
      const key=closureKey+':terminal:'+ref.batchId,terminal=(await store.get('journal',key))?.value;
      assert(terminal?.sourceRequests===0&&terminal.batch?.id===ref.batchId&&terminal.pending?.awaiting===null
        &&hash(terminal.pending)===ref.pendingHash&&hash(terminal.batch.pending)===ref.pendingHash
        &&hash(terminal.record)===ref.recordHash&&hash(terminal.record.raw)===hash(terminal.pending.raw)
        &&terminal.record.sequence===terminal.pending.sequence
        &&terminal.record.trialId===plan.trialId,'NATIVE_REPAIR_TERMINAL_BINDING');
      const receipt=(await store.get('journal',receiptKey(plan.trialId,terminal.record.sequence)))?.value;
      assert(stable(receipt)===stable(terminal.record),'NATIVE_REPAIR_TERMINAL_RECEIPT');
      const readback=await transport.request('rounds_read',{trialId:plan.trialId,ids:[receipt._id]});
      assert(readback.length===1&&stable(readback[0])===stable(receipt),'NATIVE_REPAIR_TERMINAL_READBACK');
      out.push({row:{value:terminal},ref:{key,hash:hash(terminal.batch)},
        confirmedTerminal:{record:receipt,readback:readback[0]}});
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
  const manifest={repairKey,repair,archiveHash:hash(archive)},failureEvidenceHash=hash(manifest),faults=[],confirmedTerminals=[];
  let captureLink,repairTransition;
  const previousGame=archive.campaign?.games?.find(g=>g.game_id===plan.gameId);
  const preparedClosure=archive.schema==='sg-count-prepared-before-v1';
  if((preparedClosure||archive.schema==='sg-count-shared-before-v1'&&archive.terminalRecords?.length)&&previousGame?.repairKey){
    const previousKey=previousGame.repairKey,previous=(await store.get('state',previousKey))?.value;
    const previousArchive=(await store.get('journal',previous?.archiveKey))?.value;
    const closed=(await store.get('journal',repair.archiveKey.slice(0,-':before'.length)+':complete'))?.value;
    const activationKey=`complete-count:${plan.trialId}:${closed?.activation}`;
    const activationBefore=(await store.get('journal',activationKey+':before'))?.value;
    const spec=(await store.get('journal',activationKey))?.value,activation=(await store.get('journal',activationKey+':complete'))?.value;
    const original=activationBefore?.scene?.repair;
    assert(previousKey!==repairKey&&previousKey.startsWith('game-repair:'+plan.trialId+':')
      &&previous?.schema==='sg-game-repair-v1'&&previous.gameId===plan.gameId&&previous.trialId===plan.trialId
      &&previous.sourceAllowance===0&&previous.requiresNewSession===true&&previousArchive
      &&closed?.schema===(preparedClosure?'sg-count-prepared-close-v1':'sg-count-shared-close-v1')&&closed.repairKey===repairKey
      &&closed.sourceRequests===0&&closed.newBetAllowance===0
      &&(preparedClosure?closed.requiresNewSession===true:closed.receivedTerminalsReconciled===archive.terminalRecords.length)
      &&/^[a-f0-9]{64}$/.test(previousGame.preparationProofHash??'')
      &&activationBefore?.schema==='sg-prepared-count-before-v1'&&original?.status==='pending-adapter'
      &&activationBefore.scene.closed.repairKey===previousKey
      &&activationBefore.scene.preparationProofHash===previousGame.preparationProofHash
      &&spec?.schema==='sg-complete-count-v1'&&spec.activation===closed.activation&&spec.trialId===plan.trialId
      &&activation?.schema==='sg-complete-count-activation-v1'&&activation.specHash===hash(spec)
      &&activationBefore.profileHash===spec.profileHash&&activation.profileHash===spec.profileHash
      &&hash(previous)===hash({...original,status:'validated-awaiting-admission',
        preparationProofHash:previousGame.preparationProofHash,countActivation:closed.activation,sourceAllowance:0}),
      'NATIVE_REPAIR_TRANSITION');
    const previousFailureEvidenceHash=hash({repairKey:previousKey,repair:original,archiveHash:hash(previousArchive)});
    assert(previousFailureEvidenceHash===activationBefore.scene.failureEvidenceHash,'NATIVE_REPAIR_TRANSITION');
    repairTransition={previousRepairKey:previousKey,
      previousFailureEvidenceHash,
      rejectedProofHash:previousGame.preparationProofHash,archiveHash:hash(archive),closed};
  }
  for(const {row,ref,confirmedTerminal} of await retiredBatchRows(store,plan,archive,repair,rows,repairKey,transport)) {
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
    if(pending.raw.requestFlowVersion===HUFF_ACTION_VERSION){
      const receipt=(await store.get('journal',batch.workLineFault))?.value;
      assert(abandoned&&plan.gameId===32714&&receipt,'NATIVE_REPAIR_FAULT_PLAN');
      const sourcePlan=bindPreparedPlanHash({base:plan,planHash:receipt.planHash});
      assert(hash(captureFaultReceipt({plan:sourcePlan,batch:{...batch,pending},archiveKey:batch.abandonedDemo,
        archive:abandoned,group:receipt.group}))===hash(receipt)
        &&batch.workLineFault===`capture-fault:${plan.trialId}:${batch.id}:${hash(receipt)}`,'NATIVE_REPAIR_FAULT_PLAN');
      evidence.captureEvidence={plan:sourcePlan,receipt,raw:pending.raw,receiptKey:batch.workLineFault};
    }
    faults.push({raw:pending.raw,evidence,evidenceHash:hash(evidence),failureEvidenceHash,
      ...(confirmedTerminal?{terminalRecordHash:hash(confirmedTerminal.record)}:{})});
    if(confirmedTerminal)confirmedTerminals.push(confirmedTerminal);
    const oldGame=archive.campaign?.games?.find(g=>g.game_id===plan.gameId);
    if(archive.schema==='sg-count-prepared-before-v1'&&oldGame?.pendingReview?.rawHash===hash(pending.raw)){
      const closed=(await store.get('journal',repair.archiveKey.slice(0,-':before'.length)+':complete'))?.value;
      const retiredBefore=(await store.get('journal',repair.evidence[0].key.slice(0,-':complete'.length)+':before'))?.value;
      const sourcePlan=retiredBefore?.plan,receipt=(await store.get('journal',batch.workLineFault))?.value;
      assert(closed?.repairKey===repairKey&&closed.sourceRun===archive.run&&closed.sourceCommit===archive.commit
        &&sourcePlan?.gameId===plan.gameId&&sourcePlan.trialId===plan.trialId&&sourcePlan.countAllocation===closed.activation
        &&receipt&&hash(captureFaultReceipt({plan:sourcePlan,batch:{...batch,pending},archiveKey:batch.abandonedDemo,
          archive:abandoned,group:receipt.group}))===hash(receipt)
        &&batch.workLineFault===`capture-fault:${plan.trialId}:${batch.id}:${hash(receipt)}`
        &&/^[a-f0-9]{64}$/.test(oldGame.preparationProofHash??''),'NATIVE_REPAIR_CAPTURE_LINK');
      const captureEvidence={receipt,plan:sourcePlan,raw:pending.raw};
      captureLink={failureEvidenceHash:hash(captureEvidence),rejectedProofHash:oldGame.preparationProofHash,captureEvidence};
    }
  }
  assert(faults.length>0,'NATIVE_REPAIR_NO_FAULT_PREFIX');
  const receipts=await store.getMany('journal',Array.from({length:100},(_,i)=>receiptKey(plan.trialId,i+1)));
  const record=receipts.map(r=>r?.value).find(r=>r?.gameId===plan.gameId&&r.fixtureOnly===false&&r.normalized&&r.raw);
  assert(record,'NATIVE_REPAIR_COMPLETE_RECEIPT');
  const readbacks=await transport.request('rounds_read',{trialId:plan.trialId,ids:[record._id]});
  assert(readbacks.length===1&&stable(readbacks[0])===stable(record),'NATIVE_REPAIR_FULL_READBACK');
  const extra=confirmedTerminals.filter(t=>t.record._id!==record._id);
  assert(extra.length<100&&new Set(extra.map(t=>t.record._id)).size===extra.length,'NATIVE_REPAIR_TERMINALS');
  return {schema:'sg-native-repair-replay-task-v1',gameId:plan.gameId,plan,planHash:hash(plan),revisionHash,
    manifest,failureEvidenceHash,records:[record,...extra.map(t=>t.record)],readbacks:[...readbacks,...extra.map(t=>t.readback)],faults,...(captureLink?{captureLink}:{}),
    ...(repairTransition?{repairTransition}:{}),sourceAllowance:0};
}

export function validateNativeRepairReplay(task) {
  assert(task?.schema==='sg-native-repair-replay-task-v1'&&task.sourceAllowance===0&&task.planHash===hash(task.plan)
    &&task.gameId===task.plan.gameId&&task.manifest?.repair?.gameId===task.gameId
    &&task.manifest.repair.sourceAllowance===0&&task.manifest.repair.status==='pending-adapter'
    &&task.failureEvidenceHash===hash(task.manifest)&&task.faults?.length>0
    &&task.faults.every(f=>f.failureEvidenceHash===task.failureEvidenceHash&&f.evidenceHash===hash(f.evidence)
      &&hash(f.raw)===hash(f.evidence.raw))&&task.records?.length>0&&task.records.length<=100
    &&task.readbacks?.length===task.records.length&&new Set(task.records.map(r=>r._id)).size===task.records.length
    &&task.records.every((r,i)=>stable(r)===stable(task.readbacks[i])),'NATIVE_REPAIR_DELIVERY_CHANGED');
  for(const fault of task.faults)if(fault.terminalRecordHash){
    const matches=task.records.filter(r=>hash(r)===fault.terminalRecordHash);
    assert(matches.length===1&&hash(matches[0].raw)===hash(fault.raw),'NATIVE_REPAIR_TERMINAL_RECORD');
  }
  for(const fault of task.faults)if(fault.evidence.captureEvidence){
    const e=fault.evidence.captureEvidence,r=e.receipt;
    assert(r?.schema==='sg-capture-fault-receipt-v1'&&r.gameId===task.gameId&&r.trialId===task.plan.trialId
      &&r.sourceAllowance===0&&r.requiresNewSession===true&&r.planHash===hash(e.plan)
      &&r.rawHash===hash(fault.raw)&&hash(e.raw)===hash(fault.raw)
      &&r.archiveKey===fault.evidence.abandonedKey&&r.archiveHash===fault.evidence.abandonedHash
      &&e.receiptKey===`capture-fault:${task.plan.trialId}:${r.batchId}:${hash(r)}`,'NATIVE_REPAIR_FAULT_PLAN');
  }
  if(task.captureLink){const link=task.captureLink,e=link.captureEvidence;
    assert(link.failureEvidenceHash===hash(e)&&/^[a-f0-9]{64}$/.test(link.rejectedProofHash??'')
      &&e?.receipt?.gameId===task.gameId&&e.receipt.trialId===task.plan.trialId
      &&e.receipt.rawHash===hash(e.raw)&&e.receipt.planHash===hash(e.plan)
      &&task.faults.some(f=>hash(f.raw)===hash(e.raw)),'NATIVE_REPAIR_CAPTURE_LINK');}
  if(task.repairTransition){const t=task.repairTransition,c=t.closed;
    assert(t.previousRepairKey!==task.manifest.repairKey&&t.previousRepairKey.startsWith('game-repair:'+task.plan.trialId+':')
      &&/^[a-f0-9]{64}$/.test(t.previousRepairKey.split(':').at(-1))
      &&/^[a-f0-9]{64}$/.test(t.previousFailureEvidenceHash??'')&&/^[a-f0-9]{64}$/.test(t.rejectedProofHash??'')
      &&t.archiveHash===task.manifest.archiveHash&&['sg-count-shared-close-v1','sg-count-prepared-close-v1'].includes(c?.schema)
      &&c.trialId===task.plan.trialId&&c.repairKey===task.manifest.repairKey
      &&(c.schema==='sg-count-prepared-close-v1'||c.receivedTerminalsReconciled>0)
      &&c.sourceRequests===0&&c.newBetAllowance===0&&c.requiresNewSession===true,'NATIVE_REPAIR_TRANSITION');}
  return {...task,schema:'sg-preparation-replay-task-v1'};
}
