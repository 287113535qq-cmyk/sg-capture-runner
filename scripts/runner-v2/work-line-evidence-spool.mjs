import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {sealWorkLineEvidence} from './work-line-sealed-evidence.mjs';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import {validatePreparationProof} from './work-line-events.mjs';

// Ciphertext sidecar only. Original receipts and Mongo records remain the
// recovery source of truth if this independent delivery channel is unavailable.
export function evidenceSpool({dir,recipient,origin,publication}){
 fs.mkdirSync(dir,{recursive:true});
 const publish=task=>{
  const value={schema:'sg-work-line-delivery-v1',origin,tasks:[task],sourceAllowance:0},id=hash(value),dest=path.join(dir,id+'.json');
  if(fs.existsSync(dest))return id;
  const sealed=sealWorkLineEvidence(value,recipient),temp=dest+'.'+process.pid+'.tmp',fd=fs.openSync(temp,'wx');
  try{fs.writeFileSync(fd,JSON.stringify(sealed));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(temp,dest);return id;
 };
 return {
  confirmed(plan,records){
   for(const record of records){
    if(record.normalized?.classificationStatus!=='pending')continue;
    assert(record.gameId===plan.gameId&&record.trialId===plan.trialId&&record.fixtureOnly===false,'EVIDENCE_CONFIRMED_SCOPE');
    publish({schema:'sg-confirmed-round-analysis-task-v1',gameId:plan.gameId,plan,planHash:hash(plan),record,
     recordHash:hash(record),readback:record,sourceAllowance:0});
   }
  },
  fault(envelope){
   const {plan,batch,receipt,archive}=envelope;
   assert(hash(captureFaultReceipt({plan,batch,archiveKey:receipt.archiveKey,archive,group:receipt.group}))===hash(receipt),'EVIDENCE_FAULT_CHANGED');
   const binding=publication?.bindings?.[String(plan.gameId)],task=publication?.inventory?.tasks?.find(t=>t.gameId===plan.gameId);
   assert(publication?.schema==='sg-prepared-publication-v1'&&binding?.planHash===hash(plan)&&binding.group===receipt.group
    &&task?.status==='prepared'&&validatePreparationProof(task.proof,plan.gameId)===binding.proofHash,'EVIDENCE_ORIGINAL_PREPARATION');
   return publish({...envelope,schema:'sg-capture-fault-export-v1',publication,sourceAllowance:0});
  }
 };
}

export function githubEvidenceSpool(root,env=process.env){
 if(env.SG_ENCRYPTED_EVIDENCE!=='1')return null;
 assert(env.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Linux'&&env.RUNNER_ENVIRONMENT==='github-hosted'
  &&['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner'].includes(env.GITHUB_REPOSITORY)
  &&/^[0-9]+$/.test(env.GITHUB_RUN_ID)&&/^[0-9]+$/.test(env.GITHUB_RUN_ATTEMPT)
  &&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA),'EVIDENCE_GITHUB_SCOPE');
 const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
 return evidenceSpool({dir:path.join(root,'work-line-sealed'),recipient:read('config/work-line-evidence-recipient.json'),
  publication:read('config/prepared-inventory.json'),origin:{repository:env.GITHUB_REPOSITORY,runId:env.GITHUB_RUN_ID,
   attempt:env.GITHUB_RUN_ATTEMPT,commit:env.GITHUB_SHA,workflow:'.github/workflows/trial-300k.yml'}});
}
