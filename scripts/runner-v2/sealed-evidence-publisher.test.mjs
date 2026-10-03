import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {publishSealedChunks} from './sealed-evidence-publisher.mjs';
test('incremental uploads are bounded ciphertext only; unknown upload acknowledgements do not replay or block later evidence',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-cipher-publish-')),dir=path.join(root,'out'),staging=path.join(root,'staging');fs.mkdirSync(dir);
 const value=n=>({schema:'sg-work-line-sealed-v1',recipient:'a'.repeat(64),ciphertext:String(n),iv:'a',key:'b',tag:'c'});
 for(let n=0;n<101;n++)fs.writeFileSync(path.join(dir,n.toString(16).padStart(64,'0')+'.json'),JSON.stringify(value(n)));
 const attempted=new Set(),calls=[],options={dir,staging,origin:{runId:'123',attempt:'1'},shard:'20',attempted,
  upload:async r=>{calls.push(r);assert(fs.readdirSync(r.folder).length<=100);if(calls.length===1)throw Error('ACK_UNKNOWN');}};
 try{
  assert.deepEqual(await publishSealedChunks(options),{uploaded:1,deliveryPending:100});assert.equal(calls.length,2);
  assert.deepEqual(await publishSealedChunks(options),{uploaded:0,deliveryPending:0});
  fs.writeFileSync(path.join(dir,'f'.repeat(64)+'.json'),JSON.stringify({raw:'private plaintext'}));
  await assert.rejects(publishSealedChunks(options),/SEALED_UPLOAD_CIPHERTEXT_ONLY/);assert.equal(calls.length,2);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
