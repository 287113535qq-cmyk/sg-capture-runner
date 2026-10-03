import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
// Incremental bounded chunks, not an end-of-run archive of every raw round.
// Unknown artifact acknowledgement never retries a different name. Full
// original records/receipts remain in native storage for read-only recovery.
export async function publishSealedChunks({dir,staging,origin,shard,attempted,upload}){
 assert(typeof upload==='function'&&attempted instanceof Set&&/^(?:recovery|[0-9]{1,3})$/.test(shard),'SEALED_UPLOAD_SCOPE');
 if(!fs.existsSync(dir))return {uploaded:0,deliveryPending:0};
 const files=fs.readdirSync(dir).filter(n=>/^(?:evidence|[a-f0-9]{64})\.json$/.test(n));
 const chunks=[];let current=[],bytes=0;
 for(const name of files){
  const file=path.join(dir,name),data=fs.readFileSync(file),id=digest(data);
  if(attempted.has(id))continue;
  assert(data.length<=24*1024*1024,'SEALED_UPLOAD_SIZE');
  const value=JSON.parse(data);assert(value.schema==='sg-work-line-sealed-v1'
   &&Object.keys(value).sort().join(',')==='ciphertext,iv,key,recipient,schema,tag'
   &&/^[a-f0-9]{64}$/.test(value.recipient)&&['ciphertext','iv','key','tag'].every(k=>typeof value[k]==='string'),'SEALED_UPLOAD_CIPHERTEXT_ONLY');
  if(current.length&&(current.length===100||bytes+data.length>24*1024*1024)){chunks.push(current);current=[];bytes=0;}
  current.push({name,data,id});bytes+=data.length;
 }
 if(current.length)chunks.push(current);let uploaded=0,deliveryPending=0;
 for(const chunk of chunks){
  const id=digest(Buffer.from(chunk.map(f=>f.id).join('\n'))),folder=path.join(staging,id);
  fs.mkdirSync(folder,{recursive:true});for(const f of chunk)fs.writeFileSync(path.join(folder,f.name),f.data,{flag:'wx'});
  for(const f of chunk)attempted.add(f.id);
  try{await upload({name:`sg-work-line-${origin.runId}-${origin.attempt}-${shard}-${id}`,folder});uploaded+=chunk.length;}
  catch{deliveryPending+=chunk.length;}
 }
 return {uploaded,deliveryPending};
}
