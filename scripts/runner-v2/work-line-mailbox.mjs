import fs from 'node:fs';import path from 'node:path';
import {protocolHash as hash} from './protocol-resume.mjs';
import assert from 'node:assert/strict';

export function publishImmutableInbox(dir,value){
 const encoded=JSON.stringify(value),id=hash(value);
 assert(hash(JSON.parse(encoded))===id,'WORK_LINE_INBOX_SERIALIZATION_CHANGED');
 fs.mkdirSync(dir,{recursive:true});const dest=path.join(dir,id+'.json');
 if(fs.existsSync(dest)){assert(hash(JSON.parse(fs.readFileSync(dest,'utf8')))===id,'WORK_LINE_INBOX_CHANGED');return id;}
 const temp=dest+'.'+process.pid+'.tmp',fd=fs.openSync(temp,'wx');
 try{fs.writeFileSync(fd,encoded+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 fs.renameSync(temp,dest);return id;
}
export function publishCaptureFailure(root,{gameId,proofHash,reason,evidence}){
 assert(Number.isSafeInteger(gameId)&&/^[a-f0-9]{64}$/.test(proofHash)
  &&typeof reason==='string'&&reason.length>0&&evidence,'WORK_LINE_FAILURE_SCOPE');
 const rawHash=hash(evidence),event={schema:'sg-work-line-event-v1',kind:'capture-failed',gameId,
  proofHash,reason,evidenceHash:rawHash,sourceAllowance:0};
 const receipts={};
 // Keep original flow evidence in the repair lane as well. A digest-only event
 // lets it revoke a proof, but cannot let it independently diagnose the route.
 receipts.flow=publishImmutableInbox(path.join(root,'.local','preparation-worker','repair','evidence-inbox'),
  {schema:'sg-flow-repair-task-v1',gameId,evidenceHash:rawHash,evidence,sourceAllowance:0});
 for(const lane of ['admission','repair'])receipts[lane]=publishImmutableInbox(path.join(root,'.local','preparation-worker',lane,'inbox'),event);
 receipts.protocol=publishImmutableInbox(path.join(root,'.local','protocol-analysis-worker','inbox'),
  {schema:'sg-offline-protocol-task-v1',gameId,rawHash,evidence});
 return receipts;
}
