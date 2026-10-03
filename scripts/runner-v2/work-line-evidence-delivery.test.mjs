import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {generateKeyPairSync} from 'node:crypto';
import {evidenceOrigin,receiveSealedEvidence} from './work-line-evidence-delivery.mjs';
import {sealWorkLineEvidence,recipientFingerprint} from './work-line-sealed-evidence.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('only exact owner workflows deliver intact records; invalid deliveries write no inbox',()=>{
 const repo='zyzuoyang/sg-capture-runner',run={id:123,run_attempt:1,head_sha:'a'.repeat(40),head_branch:'main',event:'workflow_dispatch',
  path:'.github/workflows/work-line-evidence.yml',repository:{full_name:repo},head_repository:{full_name:repo}};
 const origin=evidenceOrigin(run,repo);
 for(const change of [{event:'pull_request'},{head_branch:'other'},{head_repository:{full_name:'outsider/repo'}},{path:'.github/workflows/other.yml'}])
  assert.throws(()=>evidenceOrigin({...run,...change},repo),/EVIDENCE_RUN_SCOPE/);
 const k=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const recipient={schema:'sg-work-line-recipient-v1',publicKey:k.publicKey,fingerprint:recipientFingerprint(k.publicKey)};
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-evidence-')),plan={gameId:32721},record={raw:'private fixture',sequence:1};
 const task={schema:'sg-confirmed-round-analysis-task-v1',gameId:32721,plan,planHash:hash(plan),record,recordHash:hash(record),readback:record,sourceAllowance:0};
 const seal=tasks=>sealWorkLineEvidence({schema:'sg-work-line-delivery-v1',origin,sourceAllowance:0,tasks},recipient);
 try{
  assert.throws(()=>receiveSealedEvidence({root,sealed:seal([task,{...task,sourceAllowance:1}]),privateKey:k.privateKey,origin}),/EVIDENCE_TASK_ALLOWANCE/);
  assert(!fs.existsSync(path.join(root,'.local')));
  const sealed=seal([task]),first=receiveSealedEvidence({root,sealed,privateKey:k.privateKey,origin});
  assert.deepEqual(receiveSealedEvidence({root,sealed,privateKey:k.privateKey,origin}),first);
  const files=fs.readdirSync(path.join(root,'.local','capture-handoff-worker','inbox'));assert.equal(files.length,1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'.local','capture-handoff-worker','inbox',files[0]))),task);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
