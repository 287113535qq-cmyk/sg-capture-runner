import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied counter-driven Pearl repair keeps its original2596 baseline and allocation',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-repair-pearl-awards-20261001.json','utf8'));
 assert.equal(hash(p),'22bbf03bc897b793f4e67cf6417be6277216f5e01ba912024f49336e4080982e');
 assert.equal(p.completePreserved,2596);assert.equal(p.remainingComplete,297404);assert.equal(p.featureProfile,'additive-free-awards-v2');
});
test('applied Pearl repair permission retains its original count and feature scope',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-repair-pearl-20260930.json','utf8'));
 assert.equal(hash(p),'0da25be25599bb12118108c8a425aacddc54ef387822c355028e69c36954c1fc');
 assert.equal(p.completePreserved,961);assert.equal(p.featureProfile,'eight-free-retrigger-v1');
});
test('applied second Pearl retirement preserves2596 and grants no source allowance',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-retire-pearl-repair-20260930.json','utf8'));
 assert.equal(hash(p),'c9ada527078017d715955681edb23ae73c279cc5ddee7e5281244f54a630b780');
 assert.equal(p.completePreserved,2596);assert.equal(p.sourceAllowance,0);
});
