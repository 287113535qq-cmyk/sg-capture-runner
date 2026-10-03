import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// Already persisted responses only. This review cannot request or resume a game.
export async function reviewReceivedTerminalRecords({batches,plan,parser,runnerNext,normalize,now=Date.now}){
 const records=[];
 for(const b of batches.filter(b=>b.pending)){
  const p=b.pending;
  assert(b.leaseUntil<=now()&&!b.pendingOriginal&&!b.bootstrapAwaiting&&p.awaiting===null
   &&p.sequence===b.journaled+1&&p.sequence<=b.end&&p.raw?.fixtureOnly===false
   &&p.raw.steps?.length>0&&p.raw.steps.every(s=>!s.sourceRejected
    &&typeof s.requestPayload==='string'&&s.requestPayload.length>0
    &&typeof s.responsePayload==='string'&&s.responsePayload.length>0
    &&typeof s.responseXml==='string'&&s.responseXml.length>0),'RECEIVED_TERMINAL_ORIGINAL');
  assert(runnerNext(p.raw,plan)===null
   &&await parser.call({op:'next',plan,raw:p.raw})===null,'RECEIVED_TERMINAL_NOT_COMPLETE');
  const normalized=await normalize(p.raw,plan);
  const record=await parser.call({op:'record',plan,raw:p.raw,normalized,
   sequence:p.sequence,attempt:p.attempt,sessionHash:b.sessionHash,worker:b.worker,batchId:b.id});
  assert(hash(record.raw)===hash(p.raw)&&record.sequence===p.sequence&&record.attempt===p.attempt
   &&record.sourceSessionHash===b.sessionHash&&record.shardId===b.worker&&record.batchId===b.id
   &&record.trialId===plan.trialId&&record.fixtureOnly===false
   &&(await parser.call({op:'verify',plan,raw:p.raw,record})).verified===true,'RECEIVED_TERMINAL_RECORD');
  records.push(record);
 }
 return records;
}
