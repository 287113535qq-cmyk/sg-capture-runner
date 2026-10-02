import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protocolHash} from './protocol-resume.mjs';

test('applied fifteen-minute action-budget runtime revision remains immutable',()=>{
 const revision=JSON.parse(fs.readFileSync('config/count-runtime-pyramids-action-budget-continuous-20261002.json','utf8'));
 assert.equal(protocolHash(revision),'86b84cf2f88de2c5e76fcb23a1da11c08d228666cf2c4bdb69e1ad1b34af653f');
});
