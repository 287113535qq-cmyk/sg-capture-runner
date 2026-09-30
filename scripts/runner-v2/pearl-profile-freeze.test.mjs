import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Pearl profile and generation remain permanently frozen',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-pilot-pearl-20260930.json','utf8'));
 assert.equal(hash(p),'135cf98bdca0329fa370a8d48dabc1246222d564e6e2f5090f5310410b94db73');
 assert.equal(p.generation,'adcc5cb4ee01608043791e18944313b7b7a967ac70235ffc7390568db9e47f36');
 assert.equal(p.gameId,32795);assert.equal(p.fromGameId,32636);assert.equal(p.newBetAllowance,100);
 assert.equal(p.sourceClosureHash,'50bcc842f9a56b070608cfd2b41afe9d2dee1b576b34840a95ed89b36b2c1a11');
});
