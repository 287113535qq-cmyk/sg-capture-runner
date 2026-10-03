import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {publishImmutableInbox} from './work-line-mailbox.mjs';

// Two offline lanes may finish the same checks concurrently. Atomically select
// one complete successful receipt, then publish that same immutable value from
// both lanes. Different timing log hashes must not manufacture conflicting gates.
export function publishCanonicalLocalCheck({dir,receipt,expectedChecks}){
 const valid=r=>r?.schema==='sg-preparation-gate-v1'&&r.gate==='local'&&r.verified===true
  &&r.sourceAllowance===0&&r.gameId===receipt.gameId&&r.revisionHash===receipt.revisionHash
  &&Array.isArray(r.supportingHashes)&&r.supportingHashes.length===expectedChecks
  &&r.supportingHashes.every(h=>/^[a-f0-9]{64}$/.test(h));
 assert(Number.isSafeInteger(receipt.gameId)&&/^[a-f0-9]{64}$/.test(receipt.revisionHash??'')
  &&Number.isSafeInteger(expectedChecks)&&expectedChecks>0&&valid(receipt),'LOCAL_CHECK_PUBLICATION_SCOPE');
 fs.mkdirSync(dir,{recursive:true});
 const dest=path.join(dir,`local-${receipt.gameId}-${receipt.revisionHash}.json`);
 const temp=dest+'.'+randomUUID()+'.tmp',fd=fs.openSync(temp,'wx');
 try{fs.writeFileSync(fd,JSON.stringify(receipt)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 try{fs.linkSync(temp,dest);}catch(error){if(error.code!=='EEXIST')throw error;}
 finally{fs.unlinkSync(temp);}
 const winner=JSON.parse(fs.readFileSync(dest,'utf8'));
 assert(valid(winner),'LOCAL_CHECK_CANONICAL_CHANGED');
 publishImmutableInbox(dir,winner);return winner;
}
