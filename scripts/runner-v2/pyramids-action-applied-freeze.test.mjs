import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied action allocation preserves the exact parent closure and original target',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-action-20261002.json','utf8'));
 assert.equal(hash(p),'c86e5cb9a5c68b9952497503accbdd107c3f89d86395063513c77914b377355b');
 assert.equal(p.activation,'c47170077c468925d1150c49d51033fe05b8365e5b5c49e2b85f7faea2e0868f');
 assert.equal(p.completePreserved,16913);assert.equal(p.remainingComplete,282937);
 assert.equal(p.completePreserved+p.remainingComplete+p.historicalBaseline,300000);
 assert.equal(p.retirementHash,'cf8acdd48080eb818de3afc2a3ccdf4667e91f90c1b65b0a918ee1360d4b1517');
 assert.equal(p.sourceRun,'36963756989:1');assert.equal(p.classificationMode,'independent-journal');
});
