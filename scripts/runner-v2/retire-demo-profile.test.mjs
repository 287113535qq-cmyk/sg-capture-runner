import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';

test('applied demo retirement profile remains immutable and grants no source requests',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-retire-beaver-20260930.json','utf8'));
 assert.equal(hash(p),'73feb8a1e3c25a3887f7351247826812f47b909cdf6f865dee9ed6c783340e14');
 assert.equal(p.schema,'sg-demo-retire-v1');assert.equal(p.gameId,32820);
 assert.equal(p.complete,38);assert.equal(p.pending,1);assert.equal(p.newBetAllowance,0);
 assert.equal(p.expiresAt-p.createdAt,7200000);assert.equal(p.batches.length,3);
 assert(p.files['scripts/runner-v2/retire-demo-control.mjs']);
 assert(p.files['scripts/runner-v2/retire-demo-pool.mjs']);
});
