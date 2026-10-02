import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('independent direct action profile keeps its original actual closure and remaining target',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-direct-action-20261002.json','utf8'));
 assert.equal(hash(p),'2bde56b5d7af4086256d3e3912630a1b6d137e751ab0ef34024ebb7b21d51f33');
 assert.equal(p.completePreserved,132846);assert.equal(p.remainingComplete,167004);
 assert.equal(p.retirementHash,'d4db796e229fcef91cccdc8325acf3fa0bb8f94b3ec260508252b8f2695fd720');
 assert.equal(p.createdAt,1790934842208);assert.equal(p.expiresAt,1790942042208);
 assert.equal(p.sourceAllowance,0);assert.equal(p.canary.maxPaidRequests,2000);
});
