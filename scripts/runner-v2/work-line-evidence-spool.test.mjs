import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {evidenceSpool,githubEvidenceSpool} from './work-line-evidence-spool.mjs';
import {recipientFingerprint,openWorkLineEvidence} from './work-line-sealed-evidence.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import {preparationGates} from './preparation-inventory.mjs';
import {receiveSealedEvidence} from './work-line-evidence-delivery.mjs';
import {deliverCaptureFault} from './capture-fault-delivery.mjs';
test('confirmed pending classification becomes encrypted sidecar without changing capture or minting permission',()=>{
 const key=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sg-sealed-spool-')),origin={repository:'owner/repo',runId:'1',attempt:'1',commit:'a'.repeat(40)};
 const plan={gameId:32721,trialId:'trial',runtimeGameId:33121,sourceKey:'fixture'},record={_id:'fixture',gameId:32721,trialId:'trial',runtimeGameId:33121,fixtureOnly:false,normalized:{classificationStatus:'pending'},raw:{fixtureOnly:false,sourceKey:'fixture',steps:[{private:'sample'}]}};
 const original=hash(record),spool=evidenceSpool({dir,origin,recipient:{schema:'sg-work-line-recipient-v1',publicKey:key.publicKey,fingerprint:recipientFingerprint(key.publicKey)}});
 try{
  spool.confirmed(plan,[record]);spool.confirmed(plan,[record]);const files=fs.readdirSync(dir);assert.equal(files.length,2);
  const sealed=JSON.parse(fs.readFileSync(path.join(dir,files[0])));assert(!JSON.stringify(sealed).includes('sample'));
  const task=openWorkLineEvidence(sealed,key.privateKey,origin).tasks[0];assert.equal(task.recordHash,original);assert.equal(hash(record),original);
  assert.equal(task.sourceAllowance,0);assert.deepEqual(task.record,task.readback);
  assert.throws(()=>spool.confirmed({...plan,trialId:'other'},[record]),/EVIDENCE_CONFIRMED_SCOPE/);
  assert.throws(()=>githubEvidenceSpool(dir,{SG_ENCRYPTED_EVIDENCE:'1'}),/EVIDENCE_GITHUB_SCOPE/);
  assert.equal(githubEvidenceSpool(dir,{}),null);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a durable flow failure crosses encryption and fans out to repair and analysis with its exact original proof',()=>{
 const k=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-fault-spool-')),dir=path.join(root,'out'),origin={runId:'123',attempt:'1',commit:'a'.repeat(40)};
 const plan={gameId:1,trialId:'trial'},batch={id:1,checkpoint:0,journaled:0,pending:{awaiting:null,sequence:1,raw:{steps:[{payload:'private original'}]}}};
 const archive={schema:'sg-abandoned-demo-v1',trialId:'trial',batchId:1,pending:batch.pending,reason:'FLOW_GAP',sourceRequests:0,disposition:'interrupted-abandoned-without-replay'};
 const receipt=captureFaultReceipt({plan,batch,archiveKey:'abandoned-demo:trial:1:hash',archive,group:'primary'});
 const proof={schema:'sg-reusable-preparation-v1',gameId:1,revisionHash:'a'.repeat(64),sourceAllowance:0,gates:Object.fromEntries(preparationGates.map(g=>[g,{verified:true,evidenceHash:'b'.repeat(64)}]))};
 const publication={schema:'sg-prepared-publication-v1',sourceAllowance:0,bindings:{1:{group:'primary',planHash:hash(plan),proofHash:hash(proof)}},inventory:{tasks:[{gameId:1,status:'prepared',proof,proofHash:hash(proof)}]}};
 const recipient={schema:'sg-work-line-recipient-v1',publicKey:k.publicKey,fingerprint:recipientFingerprint(k.publicKey)},envelope={plan,batch,receipt,archive};
 try{
  const spool=evidenceSpool({dir,origin,recipient,publication});spool.fault(envelope);
  const sealed=JSON.parse(fs.readFileSync(path.join(dir,fs.readdirSync(dir)[0])));
  const handoff=receiveSealedEvidence({root,sealed,privateKey:k.privateKey,origin});
  const task=JSON.parse(fs.readFileSync(path.join(root,'.local/capture-handoff-worker/inbox',handoff.mailboxes[0]+'.json')));
  const result=deliverCaptureFault(root,task);assert.equal(result.status,'repair-and-analysis-delivered');
  for(const lane of ['admission','repair'])assert.equal(fs.readdirSync(path.join(root,'.local/preparation-worker',lane,'inbox')).length,1);
  assert.equal(fs.readdirSync(path.join(root,'.local/protocol-analysis-worker/inbox')).length,1);
  const invalid=structuredClone(publication);invalid.bindings[1].planHash='c'.repeat(64);
  assert.throws(()=>evidenceSpool({dir,origin,recipient,publication:invalid}).fault(envelope),/EVIDENCE_ORIGINAL_PREPARATION/);
  const changed=structuredClone(envelope);changed.archive.pending.raw.steps=[];
  assert.throws(()=>spool.fault(changed),/EVIDENCE_FAULT_CHANGED/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
