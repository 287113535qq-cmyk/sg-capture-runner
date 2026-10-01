import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied mixed repair keeps its exact quota parent identity and optimization mode',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-mixed-20261002.json'));
 assert.equal(hash(p),'f32e340466c2c02d725b93e87a92a493f013157275f6ea7ff699d47712ee8892');
 assert.equal(p.completePreserved,3627);assert.equal(p.remainingComplete,296223);
 assert.equal(p.completePreserved+p.remainingComplete+p.historicalBaseline,300000);
 assert.equal(p.stateWriteMode,'versioned-delta-v1');
 assert.equal(hash(JSON.parse(fs.readFileSync('config/formal-repair-pyramids-major-entryfix-20261001.json'))),p.oldProfileHash);
});
