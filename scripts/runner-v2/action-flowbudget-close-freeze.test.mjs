import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied flow-counter closure preserves the original allocation and ended attempts',()=>{
 const p=JSON.parse(fs.readFileSync('config/count-close-pyramids-evidence-20261002-flowbudget.json','utf8'));
 assert.equal(hash(p),'796e445b4dd8f20e1e8c7500d01d9c899b725526781ba7f809842eff48c39468');
 assert.equal(p.sourceRun,'36973608232:1');
 assert.equal(p.sourceCommit,'9aafef9ac94300c02ce74bb83db7eb97dfcef00d');
 assert.equal(p.sourceProfileHash,'c86e5cb9a5c68b9952497503accbdd107c3f89d86395063513c77914b377355b');
 assert.equal(p.completePreserved,49593);assert.equal(p.abandonedAttempts,5);
 assert.equal(p.sourceAllowance,0);
 assert.equal(p.disposition,'interrupted-abandoned-without-replay');
});
