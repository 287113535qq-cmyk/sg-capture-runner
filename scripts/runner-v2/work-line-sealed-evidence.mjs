import assert from 'node:assert/strict';
import {createCipheriv,createDecipheriv,createHash,createPublicKey,privateDecrypt,publicEncrypt,randomBytes,constants} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {protocolHash as hash} from './protocol-resume.mjs';
export const recipientFingerprint=key=>createHash('sha256').update(createPublicKey(key).export({type:'spki',format:'der'})).digest('hex');
export function sealWorkLineEvidence(value,recipient){
 assert(recipient?.schema==='sg-work-line-recipient-v1'&&recipient.fingerprint===recipientFingerprint(recipient.publicKey),'EVIDENCE_RECIPIENT');
 const plain=Buffer.from(JSON.stringify(value));assert(plain.length<=16*1024*1024,'EVIDENCE_SIZE');
 const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const meta={schema:'sg-work-line-sealed-v1',recipient:recipient.fingerprint};cipher.setAAD(Buffer.from(JSON.stringify(meta)));
 const encrypted=Buffer.concat([cipher.update(gzipSync(plain)),cipher.final()]);
 return {...meta,key:publicEncrypt({key:recipient.publicKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},key).toString('base64'),
  iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:encrypted.toString('base64')};
}
export function openWorkLineEvidence(sealed,privateKey,expectedOrigin){
 assert(sealed?.schema==='sg-work-line-sealed-v1'&&sealed.recipient===recipientFingerprint(privateKey),'EVIDENCE_RECIPIENT');
 assert(typeof sealed.ciphertext==='string'&&sealed.ciphertext.length<=24*1024*1024,'EVIDENCE_SIZE');
 const key=privateDecrypt({key:privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(sealed.key,'base64'));
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(sealed.iv,'base64'));
 decipher.setAAD(Buffer.from(JSON.stringify({schema:sealed.schema,recipient:sealed.recipient})));decipher.setAuthTag(Buffer.from(sealed.tag,'base64'));
 const compressed=Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext,'base64')),decipher.final()]);
 const value=JSON.parse(gunzipSync(compressed,{maxOutputLength:16*1024*1024}).toString('utf8'));
 assert(value?.schema==='sg-work-line-delivery-v1'&&value.sourceAllowance===0
  &&hash(value.origin)===hash(expectedOrigin)&&Array.isArray(value.tasks)&&value.tasks.length<=100,'EVIDENCE_ORIGIN');
 return value;
}
