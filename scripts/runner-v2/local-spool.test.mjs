import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {localSpool} from './local-spool.mjs';
test('response remains in private fsynced spool until remote durability is confirmed',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-spool-test-'));
  try{
    const spool=localSpool({root});const response={msgId:'BET',responsePayload:'fixture'};
    spool.append(response);assert.deepEqual(JSON.parse(fs.readFileSync(spool.filename,'utf8')),response);
    assert.throws(()=>spool.append(response),/UNCONFIRMED_LOCAL_RESPONSE/);
    spool.close();assert.deepEqual(JSON.parse(fs.readFileSync(spool.filename,'utf8')),response);
    const next=localSpool({root});next.append(response);next.confirmed();assert.equal(fs.statSync(next.filename).size,0);next.close();
  }finally{
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
    assert(path.basename(root).startsWith('sg-spool-test-'));
    fs.rmSync(root,{recursive:true,force:true});
  }
});
