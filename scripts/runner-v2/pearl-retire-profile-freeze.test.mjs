import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Pearl stopped formal retirement remains immutable and grants no source',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-retire-pearl-20260930.json','utf8'));
 assert.equal(hash(p),'7571afc6341359182be924be7cfd91c20c9d277a2af8f104d0b740c01dfbd959');assert.equal(p.sourceAllowance,0);assert.equal(p.completePreserved,961);
});
