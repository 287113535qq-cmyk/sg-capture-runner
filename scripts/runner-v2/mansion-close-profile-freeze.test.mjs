import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Mansion adapter-stop closure preserves27 spent and73 foregone with zero new allowance',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-close-mansion-shared-20260930.json','utf8'));
 assert.equal(hash(p),'1f94b656fab3532778344074807d08e3de5f1fbf7b5f016cdb9778229a611cb6');
 assert.equal(p.sourceRunKey,'capture-run:36701107637:1');assert.equal(p.completePreserved,129);
 assert.equal(p.usedByWorker.reduce((n,v)=>n+v,0),27);assert.equal(p.completeByWorker.reduce((n,v)=>n+v,0),26);
 assert.equal(p.newBetAllowance,0);assert.equal(p.sourceProfileHash,'f7d70be05456a74883a1adc1b0d691d27be07d79f2845d5b799d681afed04741');
});
