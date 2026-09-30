import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Piggies profile and zero historical credit stay frozen',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-pilot-piggies-20260930.json','utf8'));
 assert.equal(hash(p),'6f1f982a6906e68c73411eddb7ee1ed1ad56d985f2820dbec2d825e3ddbfc029');
 assert.equal(p.gameId,32636);assert.equal(p.fromGameId,32714);assert.equal(p.completePreserved,0);assert.equal(p.abandonedAttempts,0);
 assert.equal(p.sourceClosureHash,'88e2975a2c0a011c73e6b2cb9475dd297059f410570808c1f3e2ae5878895ca5');
 assert.equal(p.newBetAllowance,100);assert.equal(p.workers,20);assert.equal(p.perWorker,5);
});
