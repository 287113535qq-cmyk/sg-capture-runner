import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Pyramids retirement and repaired count profiles never reset history or quota',()=>{
 const read=name=>JSON.parse(fs.readFileSync('config/'+name,'utf8'));
 const retired=read('formal-retire-pyramids-coins-20261001.json'),repaired=read('formal-repair-pyramids-coins-20261001.json');
 assert.equal(hash(retired),'48aceae97f622d49f6aafe6193c739edb5c1933dc094d817a0b99dfada4927c4');
 assert.equal(hash(repaired),'93fef71918ebb6ad0d08e546b3ec13a2964b8493b8f860306e99564899808533');
 assert.equal(retired.sourceAllowance,0);assert.equal(retired.completePreserved,1658);
 assert.equal(repaired.completePreserved,1658);assert.equal(repaired.remainingComplete,298192);
 assert.equal(repaired.completePreserved+repaired.remainingComplete+repaired.historicalBaseline,300000);
 assert.equal(repaired.sourceRun,retired.sourceRun);assert.equal(repaired.sourceCommit,retired.sourceCommit);
 assert.equal(repaired.recordsHash,retired.recordsHash);assert.equal(repaired.group,'secondary');
 assert.equal(repaired.workerOffset,20);assert.equal(repaired.maxSequence,600000);
 assert.equal(repaired.oldProfileHash,hash(read('formal-count-pyramids-20261001.json')));
});
