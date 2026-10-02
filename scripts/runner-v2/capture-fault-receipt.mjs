import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// Written by the GitHub controller only after the original interrupted attempt
// has been archived and read back. This is work, never a source permission.
export function captureFaultReceipt({plan,batch,archiveKey,archive,group}){
 assert(['primary','secondary'].includes(group)&&batch?.pending?.awaiting===null
  &&batch.checkpoint===batch.journaled,'CAPTURE_FAULT_UNSETTLED');
 assert(archive?.schema==='sg-abandoned-demo-v1'&&archive.trialId===plan.trialId
  &&archive.batchId===batch.id&&hash(archive.pending)===hash(batch.pending)
  &&archive.sourceRequests===0&&archive.disposition==='interrupted-abandoned-without-replay',
  'CAPTURE_FAULT_ARCHIVE');
 assert(archiveKey.startsWith('abandoned-demo:'+plan.trialId+':'),'CAPTURE_FAULT_KEY');
 return {schema:'sg-capture-fault-receipt-v1',gameId:plan.gameId,trialId:plan.trialId,
  group,planHash:hash(plan),batchId:batch.id,sequence:batch.pending.sequence,
  checkpoint:batch.checkpoint,journaled:batch.journaled,
  archiveKey,archiveHash:hash(archive),rawHash:hash(batch.pending.raw),
  reason:archive.reason,flowRepairStatus:'queued',protocolAnalysisStatus:'queued',
  sourceAllowance:0,requiresNewSession:true};
}
