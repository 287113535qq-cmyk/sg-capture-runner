import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import {evidenceSpool} from './work-line-evidence-spool.mjs';
import {recipientFingerprint} from './work-line-sealed-evidence.mjs';
import {receiveSealedEvidence} from './work-line-evidence-delivery.mjs';
import {deliverCaptureFault} from './capture-fault-delivery.mjs';
import {capturePreparationBinding} from './capture-preparation-binding.mjs';

test('registered formal plan fault crosses encrypted delivery and queues both repairs using the original base proof',t=>{
 const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
 const registry=read('config/prepared-count-authorizations.json');
 const [name,authorization]=Object.entries(registry.profiles).find(([,a])=>a.gameId===32714);
 const basePlan=read('config/round-one-plans.json')[32714],profile=read('config/'+name);
 const publication=read('config/prepared-inventory.json'),countBinding={basePlan,profile,authorization};
 const plan=preparedCountPlan(basePlan,profile,authorization);
 assert.notEqual(hash(plan),hash(basePlan));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-count-fault-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'config'));
 for(const f of ['prepared-count-authorizations.json','round-one-plans.json',name])
  fs.copyFileSync('config/'+f,path.join(root,'config',f));
 const k=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const recipient={schema:'sg-work-line-recipient-v1',publicKey:k.publicKey,fingerprint:recipientFingerprint(k.publicKey)};
 const origin={runId:'123',attempt:'1',commit:'a'.repeat(40)};
 // Fault is synthetic; registered plan/proof and authorization are actual.
 const batch={id:41,checkpoint:0,journaled:0,pending:{awaiting:null,sequence:4001,raw:{steps:[{payload:'synthetic private fault'}]}}};
 const archive={schema:'sg-abandoned-demo-v1',trialId:plan.trialId,batchId:batch.id,pending:batch.pending,
  reason:'FLOW_GAP',sourceRequests:0,disposition:'interrupted-abandoned-without-replay'};
 const receipt=captureFaultReceipt({plan,batch,archive,archiveKey:`abandoned-demo:${plan.trialId}:41:hash`,group:'primary'});
 const args={plan,group:'primary',publication,countBinding};
 assert.equal(capturePreparationBinding(args).proofHash,profile.preparationProofHash);
 for(const changed of ['target','profile','authorization','base','proof','missing']){
  const a=structuredClone(args);
  if(changed==='target')a.plan.target++;
  if(changed==='profile')a.countBinding.profile.preparationProofHash='0'.repeat(64);
  if(changed==='authorization')a.countBinding.authorization.profileHash='0'.repeat(64);
  if(changed==='base')a.countBinding.basePlan.betRaw++;
  if(changed==='proof')a.publication.bindings[32714].proofHash='0'.repeat(64);
  if(changed==='missing')delete a.countBinding;
  assert.throws(()=>capturePreparationBinding(a));
 }
 const spool=evidenceSpool({dir:path.join(root,'out'),recipient,origin,publication,countBinding});
 spool.fault({plan,batch,archive,receipt});
 const sealed=read(path.join(root,'out',fs.readdirSync(path.join(root,'out'))[0]));
 // Consumer independently refuses an unregistered authorization before inbox writes.
 const local=path.join(root,'config/prepared-count-authorizations.json');
 fs.writeFileSync(local,JSON.stringify({...registry,profiles:{}}));
 assert.throws(()=>receiveSealedEvidence({root,sealed,privateKey:k.privateKey,origin}),/UNAUTHORIZED/);
 assert(!fs.existsSync(path.join(root,'.local')));
 fs.writeFileSync(local,JSON.stringify(registry));
 const delivery=receiveSealedEvidence({root,sealed,privateKey:k.privateKey,origin});
 const task=read(path.join(root,'.local/capture-handoff-worker/inbox',delivery.mailboxes[0]+'.json'));
 const result=deliverCaptureFault(root,task);
 assert.equal(result.status,'repair-and-analysis-delivered');assert.equal(result.sourceRequests,0);
 for(const lane of ['admission','repair'])assert.equal(fs.readdirSync(path.join(root,'.local/preparation-worker',lane,'inbox')).length,1);
 assert.equal(fs.readdirSync(path.join(root,'.local/protocol-analysis-worker/inbox')).length,1);
 assert.deepEqual(deliverCaptureFault(root,task),result);
});
