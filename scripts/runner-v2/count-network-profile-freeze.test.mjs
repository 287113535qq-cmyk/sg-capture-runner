import fs from 'node:fs';import assert from 'node:assert/strict';import test from 'node:test';import{protocolHash as hash}from './protocol-resume.mjs';
test('applied count network closure remains frozen without new source quota',()=>{
 const p=JSON.parse(fs.readFileSync('config/count-network-pearl-20261001.json'));assert.equal(hash(p),'579e74efd39bffad6eab96c92625ce556655c47f5fb5909880e4d1d69d0a74e1');assert.equal(p.completePreserved,25392);assert.equal(p.abandonedAttempts,14);assert.equal(p.unknownAttempts,1);assert.equal(p.sourceAllowance,0);
});
