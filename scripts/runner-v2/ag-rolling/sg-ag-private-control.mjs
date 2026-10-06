import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
export function createPrivateControlWriter({directoryFd,key,context}){
 assert(process.platform==='linux'&&typeof process.geteuid==='function'&&Buffer.isBuffer(key)&&key.length===32,'SG_AG_PRIVATE_CONTROL_LINUX_MEMORY_KEY');
 const uid=process.geteuid(),dir=fs.fstatSync(directoryFd);
 assert(uid!==0&&dir.isDirectory()&&dir.uid===uid&&(dir.mode&0o777)===0o700,'SG_AG_PRIVATE_CONTROL_APPROVED_DIRECTORY');
 assert(context?.run&&context.commit&&context.queueId&&context.approvedEntrySha256&&/^[a-f0-9]{64}$/.test(context.approvedEntrySha256),'SG_AG_PRIVATE_CONTROL_CONTEXT');
 const aad=Buffer.from(stable(context)),root='/proc/self/fd/'+directoryFd;
 let sequence=0,poison=false;
 return function persist(file,value){
  const allowed=file==='own-control-state'||file==='own-exception-state'||(context.campaigns??[]).some(c=>file==='private-control-evidence/'+c+'-merge-evidence.json');
  assert(!poison&&allowed,'SG_AG_PRIVATE_CONTROL_CONSUMED');
  poison=true;const bytes=Buffer.from(stable(value)),nonce=randomBytes(12),hash=createHash('sha256').update(bytes).digest('hex');
  let fd;
  try{
   const current=fs.fstatSync(directoryFd);assert(current.dev===dir.dev&&current.ino===dir.ino&&current.uid===uid&&(current.mode&0o777)===0o700,'SG_AG_PRIVATE_CONTROL_DIRECTORY_CHANGED');
   const cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(aad);
   const sealed=Buffer.concat([nonce,cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);
   const name=String(++sequence).padStart(10,'0')+'-'+randomBytes(16).toString('hex')+'.sealed';
   fd=fs.openSync(root+'/'+name,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_RDWR|fs.constants.O_NOFOLLOW,0o600);
   const stat=fs.fstatSync(fd);assert(stat.uid===uid&&stat.isFile()&&(stat.mode&0o777)===0o600,'SG_AG_PRIVATE_CONTROL_FILE');
   let written=0;while(written<sealed.length){const n=fs.writeSync(fd,sealed,written,sealed.length-written,written);assert(n>0,'SG_AG_PRIVATE_CONTROL_PARTIAL_WRITE');written+=n;}
   fs.fsyncSync(fd);fs.fsyncSync(directoryFd);
   const saved=Buffer.alloc(sealed.length);let read=0;while(read<saved.length){const n=fs.readSync(fd,saved,read,saved.length-read,read);assert(n>0,'SG_AG_PRIVATE_CONTROL_PARTIAL_READ');read+=n;}
   assert(saved.equals(sealed)&&fs.fstatSync(fd).size===sealed.length,'SG_AG_PRIVATE_CONTROL_CIPHERTEXT_READBACK');
   const decrypt=createDecipheriv('aes-256-gcm',key,saved.subarray(0,12));decrypt.setAAD(aad);decrypt.setAuthTag(saved.subarray(-16));
   const full=Buffer.concat([decrypt.update(saved.subarray(12,-16)),decrypt.final()]);
   assert(full.equals(bytes),'SG_AG_PRIVATE_CONTROL_FULL_READBACK');full.fill(0);poison=false;
   return {fullReadback:true,durable:true,privateOnly:true,valueHash:hash,sealedName:name};
  }finally{if(fd!==undefined)fs.closeSync(fd);bytes.fill(0);}
 };
}
