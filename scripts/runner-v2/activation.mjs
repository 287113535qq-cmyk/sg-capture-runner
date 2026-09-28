// Source-free, evidence-bound activation; no SG credentials or source calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {stable} from './mongo-writer.mjs';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {repositories} from '../trial/runner-group.mjs';

const group=repositories[process.env.GITHUB_REPOSITORY]?.name;assert(group);
const cfg=JSON.parse(fs.readFileSync('config/github-migration-v2.json','utf8'));
const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))[cfg.groups[group]];
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+5*60000});
const stage=process.argv[2];assert(['short','formal'].includes(stage));
try{
  const proof=(await store.get('state','migration-recovery-complete'))?.value;assert(proof && proof.sourceEnabled===false);
  const campaign=(await store.get('state','campaign'))?.value,pool=(await store.get('state','pool:'+plan.trialId))?.value;
  assert(campaign && pool && campaign.activeGame===plan.gameId && !pool.failure);
  assert(Object.values(pool.workers).every(w=>w.leaseUntil<Date.now()));
  if(stage==='short'){
    assert(!campaign.enabled && !pool.enabled && pool.recoveryProof===proof.proofHash);
  }else{
    const validation=(await store.get('state','migration-validation-complete'))?.value;
    assert(validation && validation.recoveryProof===proof.proofHash && validation.workersVerified===20
      && validation.newComplete===200 && validation.pending===0,'SHORT_CAPTURE_NOT_VERIFIED');
    assert(campaign.validationLimit===10 && validation.poolHash===createHash('sha256').update(stable(pool)).digest('hex')
      && 0<=Date.now()-validation.at && Date.now()-validation.at<15*60000,'SHORT_PROOF_STALE_OR_CHANGED');
  }
  await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3);
  await store.create('journal','activation:'+stage,{proofHash:proof.proofHash,stage,trialId:plan.trialId},{immutable:true});
  await store.update('state','pool:'+plan.trialId,v=>{
    assert(v.recoveryProof===proof.proofHash && !v.failure && Object.values(v.workers).every(w=>w.leaseUntil<Date.now()));v.enabled=true;return v;
  });
  await store.update('state','campaign',v=>{
    assert(v.activeGame===plan.gameId);v.enabled=true;v.reason=null;v.validationLimit=stage==='short'?10:0;return v;
  });
  await store.update('state','global-hold',v=>{
    assert(v.reason==='LEGACY_STORAGE_REVIEW_REQUIRED' || v.active===false,'NEW_GLOBAL_FAULT_REQUIRES_REVIEW');
    return {...v,active:false,reason:null,recoveryProof:proof.proofHash};
  });
  console.log(JSON.stringify({group,stage,trialId:plan.trialId,sourceRequests:0,validationLimit:stage==='short'?10:0}));
}catch(error){console.log(JSON.stringify({group,stage,error:'ACTIVATION_REQUIRES_REVIEW'}));process.exitCode=2;}
finally{transport.close();}
