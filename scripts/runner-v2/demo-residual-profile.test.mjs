import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {applyDemoPilot} from './demo-pilot-plan.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
test('residual profile binds only39 remaining BETs, new generation and versioned CFG1 mapping',()=>{
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),p=read('config/demo-residual-beaver-20260930.json'),plans=read('config/round-one-plans.json');
 assert.equal(p.usedBetAllowance,61);assert.equal(p.newBetAllowance,39);assert.deepEqual(p.budgets,[4,0,0,5,5,5,5,0,0,5,0,0,5,0,0,0,0,0,0,5]);
 assert.notEqual(p.generation,p.parentGeneration);assert.equal(applyDemoPilot(plans,p)[32820].demoGeneration,p.generation);
 assert.throws(()=>applyDemoPilot(plans,{...p,newBetAllowance:40}));assert.throws(()=>applyDemoPilot(plans,{...p,usedBetAllowance:60}));
 const registry=read('service/round_types.json').profiles,source=plans[32820].sourceKey;
 assert.equal(hash(registry[source]),'6db98f6e7320c671cedcb90dafb947ca4908f682945dba8264c2f41f2c86914e');
 assert.equal(hash(registry[source+'-beaver-free-v1']),'d540cb0a5c7b966068664a6ed4b0610f9effee48202a0869a85b34ba3e994f89');
 assert.equal(hash(registry[source+'-beaver-free-cfg1-v2']),'f246a08b5ac2efeb5bca81a8b2af1d730953cee7d6f3051021aa5bc31324ec91');
});
