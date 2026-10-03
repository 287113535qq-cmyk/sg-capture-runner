import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {sealWorkLineEvidence,openWorkLineEvidence,recipientFingerprint} from './work-line-sealed-evidence.mjs';
test('private evidence round trips only to its recipient and authenticated origin',()=>{
 const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const recipient={schema:'sg-work-line-recipient-v1',publicKey:pair.publicKey,fingerprint:recipientFingerprint(pair.publicKey)};
 const origin={repository:'owner/repo',run:'12:1',commit:'a'.repeat(40),workflow:'.github/workflows/work-line-evidence.yml'};
 const value={schema:'sg-work-line-delivery-v1',origin,sourceAllowance:0,tasks:[{raw:'private test response'}]};
 const sealed=sealWorkLineEvidence(value,recipient);assert(!JSON.stringify(sealed).includes(value.tasks[0].raw));
 assert.deepEqual(openWorkLineEvidence(sealed,pair.privateKey,origin),value);
 assert.throws(()=>openWorkLineEvidence(sealed,pair.privateKey,{...origin,run:'13:1'}),/EVIDENCE_ORIGIN/);
 const changed={...sealed,ciphertext:Buffer.from(sealed.ciphertext,'base64').fill(0).toString('base64')};
 assert.throws(()=>openWorkLineEvidence(changed,pair.privateKey,origin));
 assert.throws(()=>openWorkLineEvidence({...sealed,recipient:'b'.repeat(64)},pair.privateKey,origin),/EVIDENCE_RECIPIENT/);
});
