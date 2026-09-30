import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Piggies profile and zero historical credit stay frozen',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-pilot-piggies-20260930.json','utf8'));
 assert.equal(hash(p),'6f1f982a6906e68c73411eddb7ee1ed1ad56d985f2820dbec2d825e3ddbfc029');
 assert.equal(p.gameId,32636);assert.equal(p.fromGameId,32714);assert.equal(p.completePreserved,0);assert.equal(p.abandonedAttempts,0);
 assert.equal(p.sourceClosureHash,'88e2975a2c0a011c73e6b2cb9475dd297059f410570808c1f3e2ae5878895ca5');
 assert.equal(p.newBetAllowance,100);assert.equal(p.workers,20);assert.equal(p.perWorker,5);
});
test('applied zero-source runtime rebind stays frozen',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-zero-source-piggies-20260930.json','utf8'));
 assert.equal(hash(p),'2e2989d7a47d2e2344e7e166500d2a4685629fa60581f3538a0f89b4a6350464');
});
test('applied Piggies closure preserves 34 used and 66 foregone',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-close-piggies-20260930.json','utf8'));
 assert.equal(hash(p),'74d35438a4d1bc94df786b59802d90fc7a6d156ff264212953b82d741cd762db');
 assert.equal(p.usedByWorker.reduce((a,b)=>a+b,0),34);
 assert.equal(p.completeByWorker.reduce((a,b)=>a+b,0),33);
 assert.equal(p.newBetAllowance,0);
});
