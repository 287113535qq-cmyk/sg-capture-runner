import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

test('applied retrigger repair admission keeps the original remaining target and closed parent',()=>{
 const profile=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-retrigger-20261002.json','utf8'));
 assert.equal(hash(profile),'9b5be7e5e018d9be4c7c09adda0dcac84bbae82c75e3d3c4d5c1fcc1b4982a34');
 assert.equal(profile.completePreserved,5787);
 assert.equal(profile.remainingComplete,294063);
 assert.equal(profile.sourceRun,'36951574835:1');
 assert.equal(profile.recordsHash,'656c64a4430f731a2afb31110756bb79a01988bb5602f7c6edb29d0b1dbb8433');
});
