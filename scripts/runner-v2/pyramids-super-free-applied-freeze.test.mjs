import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

test('applied SFGT repair admission preserves the immutable remaining target',()=>{
 const profile=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-super-free-20261002.json','utf8'));
 assert.equal(hash(profile),'ea7929295dc8f5098b2d392262b563cf4158c87051987c8c71e62cd9b727fcf9');
 assert.equal(profile.completePreserved,5713);
 assert.equal(profile.remainingComplete,294137);
 assert.equal(profile.sourceRun,'36946815410:1');
});
