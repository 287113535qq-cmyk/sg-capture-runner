import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import {constants} from 'node:fs';import path from 'node:path';
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const error=()=>Error('HISTORICAL_PRIVATE_DURABLE_SINK_STOP_NO_RETRY');
export function assertHistoricalSinkBinding(binding,context,grant){
 assert(binding?.schema==='sg-historical-private-durable-sink-v1'&&binding.enabled===true&&binding.algorithm==='AES-256-GCM'
  &&path.posix.isAbsolute(binding.directory)&&path.posix.normalize(binding.directory)===binding.directory&&binding.directory.startsWith('/var/lib/sg-historical-32737/')
  &&/^[a-f0-9]{64}$/.test(binding.keyFingerprint??'')&&Number.isSafeInteger(binding.ownerUid)&&binding.ownerUid>=0);
 assert(stable(grant?.value?.privateEvidenceSink)===stable({...binding,gameId:32737,run:context.run,commit:context.commit,encryptedOnly:true}),'HISTORICAL_PROTECTED_DURABLE_SINK_REQUIRED');return binding;
}
// Only ciphertext reaches the approved directory. Unknown fsync/readback retains the file and ends this sink.
export function historicalEncryptedDurableSink({binding,context,grant,key},dependencies={}){
 binding=structuredClone(binding);context=structuredClone(context);assertHistoricalSinkBinding(binding,context,grant);
 const io=dependencies.fs??fs,platform=dependencies.platform??process.platform,geteuid=dependencies.geteuid??(()=>process.geteuid());
 assert(platform==='linux'&&Buffer.isBuffer(key)&&key.length===32&&hash(key)===binding.keyFingerprint,'HISTORICAL_PRIVATE_SINK_KEY_REQUIRED');
 let secret=Buffer.from(key),state='new',file=null,identity=null,directoryIdentity=null;
 const close=()=>{secret?.fill(0);secret=null;state='closed';};
 const directory=async()=>{assert(platform==='linux'&&geteuid()===binding.ownerUid);const s=await io.lstat(binding.directory);assert(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===binding.ownerUid&&(s.mode&0o777)===0o700);
  assert(await io.realpath(binding.directory)===binding.directory&&Number.isSafeInteger(s.dev)&&Number.isSafeInteger(s.ino)&&s.ino>0);
  const id={dev:s.dev,ino:s.ino};assert(!directoryIdentity||stable(id)===stable(directoryIdentity));return id;};
 const openDirectory=async expected=>{const handle=await io.open(binding.directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  try{const s=await handle.stat();assert(s.isDirectory()&&s.uid===binding.ownerUid&&(s.mode&0o777)===0o700&&stable({dev:s.dev,ino:s.ino})===stable(expected)&&Number.isSafeInteger(handle.fd)&&handle.fd>=0);return handle;}catch{await handle.close().catch(()=>{});throw error();}};
 const receiptIdentity=r=>{assert(r?.schema==='sg-historical-private-evidence-receipt-v1'&&stable(r.context)===stable(context)&&r.fullReadback===true
  &&/^[a-f0-9]{64}$/.test(r.challengeHash)&&/^[a-f0-9]{64}$/.test(r.evidenceSha256)&&Number.isSafeInteger(r.evidenceBytes)&&r.evidenceBytes>0&&r.evidenceBytes<=4*1024*1024);};
 return Object.freeze({close,async prepare(){let dir;try{assert(state==='new');state='prepare-consumed';const id=await directory();
   dir=await openDirectory(id);await dir.sync();await dir.close();dir=null;directoryIdentity=id;state='ready';
  }catch{close();throw error();}finally{await dir?.close().catch(()=>{});}},async writePrivate(plain,receipt){let packed,handle,dir;
  try{assert(state==='ready');state='write-consumed';receiptIdentity(receipt);assert(Buffer.isBuffer(plain)&&plain.length===receipt.evidenceBytes&&hash(plain)===receipt.evidenceSha256);
   const id=await directory();dir=await openDirectory(id);identity=structuredClone(receipt);file=receipt.challengeHash+'.encrypted-evidence.json';
   const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(Buffer.from(stable(identity)));
   const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
   packed=Buffer.from(JSON.stringify({schema:'sg-historical-encrypted-evidence-v1',receipt:identity,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),ciphertext:ciphertext.toString('base64url')}));
   handle=await io.open('/proc/self/fd/'+dir.fd+'/'+file,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
   const stat=await handle.stat();assert(stat.isFile()&&stat.uid===binding.ownerUid&&(stat.mode&0o777)===0o600);
   await handle.writeFile(packed);await handle.sync();await handle.close();handle=null;
   await dir.sync();await dir.close();dir=null;state='written';
  }catch{close();throw error();}finally{packed?.fill(0);await handle?.close().catch(()=>{});await dir?.close().catch(()=>{});}
 },async readPrivate(receipt){let handle,dir,packed,plain;
  try{assert(state==='written');state='read-consumed';receiptIdentity(receipt);assert(stable(receipt)===stable(identity));dir=await openDirectory(await directory());
   handle=await io.open('/proc/self/fd/'+dir.fd+'/'+file,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=await handle.stat();assert(stat.isFile()&&stat.uid===binding.ownerUid&&(stat.mode&0o777)===0o600&&stat.size>0&&stat.size<6*1024*1024);
   packed=await handle.readFile();assert(packed.length===stat.size);await handle.close();handle=null;await dir.close();dir=null;const v=JSON.parse(packed);
   assert(Object.keys(v).sort().join(',')==='ciphertext,iv,receipt,schema,tag'&&v.schema==='sg-historical-encrypted-evidence-v1'&&stable(v.receipt)===stable(identity));
   const decode=(b,n)=>{assert(typeof b==='string'&&/^[A-Za-z0-9_-]+$/.test(b));const bytes=Buffer.from(b,'base64url');assert(bytes.toString('base64url')===b&&(!n||bytes.length===n));return bytes;};
   const decipher=createDecipheriv('aes-256-gcm',secret,decode(v.iv,12));decipher.setAAD(Buffer.from(stable(identity)));decipher.setAuthTag(decode(v.tag,16));
   plain=Buffer.concat([decipher.update(decode(v.ciphertext)),decipher.final()]);assert(plain.length===receipt.evidenceBytes&&hash(plain)===receipt.evidenceSha256);close();return plain;
  }catch{plain?.fill(0);close();throw error();}finally{packed?.fill(0);await handle?.close().catch(()=>{});await dir?.close().catch(()=>{});}
 }});
}
