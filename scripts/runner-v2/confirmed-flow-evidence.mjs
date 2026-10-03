import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';

// Full Mongo readback is supplied by the capture writer. This sample is only
// input to independent offline replay; it is never a ready gate or permission.
export function validateConfirmedFlowEvidence(task) {
  const r=task?.record;
  assert(task?.schema==='sg-confirmed-flow-evidence-v1'&&task.sourceAllowance===0
    &&task.gameId===task.plan?.gameId&&task.planHash===hash(task.plan)
    &&task.recordHash===hash(r)&&hash(task.readback)===hash(r)
    &&typeof r?._id==='string'&&r.fixtureOnly===false&&r.gameId===task.gameId
    &&r.trialId===task.plan.trialId&&r.runtimeGameId===task.plan.runtimeGameId
    &&r.raw?.fixtureOnly===false&&r.raw.sourceKey===task.plan.sourceKey
    &&Array.isArray(r.raw.steps)&&r.raw.steps.length>0&&r.normalized,
    'CONFIRMED_FLOW_FULL_READBACK');
  return task;
}
export function deliverConfirmedFlowEvidence(root,task) {
  validateConfirmedFlowEvidence(task);
  const dir=path.join(root,'.local/preparation-worker/repair/confirmed-evidence',task.planHash);
  fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'sample.json');
  if(!fs.existsSync(file)){
    const temp=file+'.'+process.pid+'.tmp',fd=fs.openSync(temp,'wx');
    try{fs.writeFileSync(fd,JSON.stringify(task));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temp,file);
  }
  const retained=validateConfirmedFlowEvidence(JSON.parse(fs.readFileSync(file,'utf8')));
  assert(retained.planHash===task.planHash,'CONFIRMED_FLOW_PLAN_CHANGED');
  return {status:'confirmed-flow-evidence-retained',gameId:task.gameId,
    recordHash:retained.recordHash,sourceRequests:0,sourceAllowance:0,prepared:false};
}
export function automaticFlowReplay(root,task,current,revisionHash) {
  if(task?.schema!=='sg-flow-repair-task-v1'||current?.lane!=='repair'
    ||current.failureEvidenceHash!==task.evidenceHash)return null;
  assert(hash(task.evidence)===task.evidenceHash,'FLOW_REPAIR_EVIDENCE_CHANGED');
  const plan=task.evidence.plan,planHash=hash(plan);
  const file=path.join(root,'.local/preparation-worker/repair/confirmed-evidence',planHash,'sample.json');
  if(!fs.existsSync(file))return null;
  const sample=validateConfirmedFlowEvidence(JSON.parse(fs.readFileSync(file,'utf8')));
  assert(sample.planHash===planHash&&sample.gameId===task.gameId,'CONFIRMED_FLOW_PLAN_CHANGED');
  return {schema:'sg-preparation-replay-task-v1',gameId:task.gameId,plan,planHash,revisionHash,
    failureEvidenceHash:task.evidenceHash,records:[sample.record],readbacks:[sample.readback],
    faults:[{raw:task.evidence.raw,evidence:task.evidence,evidenceHash:task.evidenceHash,
      failureEvidenceHash:task.evidenceHash}],sourceAllowance:0};
}
export async function exportConfirmedFlowEvidence({store,transport,parser,plan,sequence}) {
  assert(Number.isSafeInteger(sequence)&&sequence>=1&&sequence<=600000,'CONFIRMED_FLOW_SEQUENCE');
  const campaign=(await store.get('state','campaign'))?.value;
  assert(campaign?.games?.some(g=>g.game_id===plan.gameId),'CONFIRMED_FLOW_CAMPAIGN');
  const record=(await store.get('journal',receiptKey(plan.trialId,sequence)))?.value;
  assert(record?.sequence===sequence,'CONFIRMED_FLOW_RECEIPT');
  const readbacks=await transport.request('rounds_read',{trialId:plan.trialId,ids:[record._id]});
  assert(readbacks.length===1,'CONFIRMED_FLOW_FULL_READBACK');
  const task=validateConfirmedFlowEvidence({schema:'sg-confirmed-flow-evidence-v1',gameId:plan.gameId,
    plan,planHash:hash(plan),record,recordHash:hash(record),readback:readbacks[0],sourceAllowance:0});
  assert.deepEqual(await parser.call({op:'verify',plan,raw:record.raw,record}),{verified:true});
  return task;
}
