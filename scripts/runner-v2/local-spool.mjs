import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

// A response is fsynced on GitHub immediately, before waiting for Mongo's
// resource gate. Cross-run authority remains the already durable Mongo intent;
// temporary disk alone never authorizes replay after an interrupted job.
export function localSpool({root=process.env.RUNNER_TEMP||os.tmpdir()}={}){
  const directory=fs.mkdtempSync(path.join(root,'sg-private-response-'));fs.chmodSync(directory,0o700);
  const filename=path.join(directory,'response.json'),fd=fs.openSync(filename,'wx+',0o600);
  let pending=false;
  return {filename,append(response){
    assert(!pending,'UNCONFIRMED_LOCAL_RESPONSE');
    const bytes=Buffer.from(JSON.stringify(response));assert(bytes.length<=8*1024*1024,'RESPONSE_TOO_LARGE');
    let offset=0;while(offset<bytes.length)offset+=fs.writeSync(fd,bytes,offset,bytes.length-offset,offset);
    fs.ftruncateSync(fd,bytes.length);fs.fsyncSync(fd);pending=true;
  },confirmed(){assert(pending);fs.ftruncateSync(fd,0);fs.fsyncSync(fd);pending=false;},close(){fs.closeSync(fd);}};
}
