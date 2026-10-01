import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied thirty-minute observation permission remains immutable',()=>{
 const profile=JSON.parse(fs.readFileSync('config/count-runtime-rhino-two-observation-20261001.json','utf8'));
 assert.equal(hash(profile),'b849d1acbf61fbb05bc79529d34be388c621c04f5e8f99bb85922909a01ab767');
});
