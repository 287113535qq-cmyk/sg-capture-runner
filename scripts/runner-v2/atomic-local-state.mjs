import fs from 'node:fs';
import {randomUUID} from 'node:crypto';

// Mutable local state only. The caller must own the producer/claim lock.
// Immutable receipts and online source permissions use their separate APIs.
export function replaceLocalJson(file,value,io=fs){
 const temp=file+'.'+process.pid+'.'+randomUUID()+'.tmp';let fd;
 try{
  fd=io.openSync(temp,'wx');
  io.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');io.fsyncSync(fd);
  io.closeSync(fd);fd=undefined;
  // Windows readers can briefly deny replacement. Retry only this identical
  // local rename, not a task, request, receipt or database operation.
  for(let attempt=0;;attempt++){
   try{io.renameSync(temp,file);break;}
   catch(error){
    if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt===4)throw error;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25);
   }
  }
 }finally{
  if(fd!==undefined)io.closeSync(fd);
  // Remove only this call's private temporary file. Old files stay untouched.
  if(io.existsSync(temp))io.unlinkSync(temp);
 }
}
