import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {evidenceSpool,githubEvidenceSpool} from './work-line-evidence-spool.mjs';
import {recipientFingerprint,openWorkLineEvidence} from './work-line-sealed-evidence.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('confirmed pending classification becomes encrypted sidecar without changing capture or minting permission',()=>{
 const key=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sg-sealed-spool-')),origin={repository:'owner/repo',runId:'1',attempt:'1',commit:'a'.repeat(40)};
 const plan={gameId:32721,trialId:'trial'},record={gameId:32721,trialId:'trial',fixtureOnly:false,normalized:{classificationStatus:'pending'},raw:{private:'sample'}};
 const original=hash(record),spool=evidenceSpool({dir,origin,recipient:{schema:'sg-work-line-recipient-v1',publicKey:key.publicKey,fingerprint:recipientFingerprint(key.publicKey)}});
 try{
  spool.confirmed(plan,[record]);spool.confirmed(plan,[record]);const files=fs.readdirSync(dir);assert.equal(files.length,1);
  const sealed=JSON.parse(fs.readFileSync(path.join(dir,files[0])));assert(!JSON.stringify(sealed).includes('sample'));
  const task=openWorkLineEvidence(sealed,key.privateKey,origin).tasks[0];assert.equal(task.recordHash,original);assert.equal(hash(record),original);
  assert.equal(task.sourceAllowance,0);assert.deepEqual(task.record,task.readback);
  assert.throws(()=>spool.confirmed({...plan,trialId:'other'},[record]),/EVIDENCE_CONFIRMED_SCOPE/);
  assert.throws(()=>githubEvidenceSpool(dir,{SG_ENCRYPTED_EVIDENCE:'1'}),/EVIDENCE_GITHUB_SCOPE/);
  assert.equal(githubEvidenceSpool(dir,{}),null);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
