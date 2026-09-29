import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';import {applyDemoPilot} from './demo-pilot-plan.mjs';
test('applied Luxor independent100 profile stays frozen and rejects later runtime binding',()=>{
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),p=read('config/demo-pilot-luxor-20260930.json'),plans=read('config/round-one-plans.json');
 assert.equal(hash(p),'308018e257496dd02091d523b605e32d13c60b73227720f41076ff823e932375');
 assert.equal(p.gameId,32835);assert.equal(p.fromGameId,32820);assert.equal(p.newBetAllowance,100);assert.equal(p.perWorker,5);assert.equal(p.workers,20);
 assert.equal(applyDemoPilot(plans,p)[32835].demoGeneration,p.generation);assert.throws(()=>applyDemoPilot(plans,{...p,newBetAllowance:101}));
 assert(Object.entries(p.files).some(([file,h])=>createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex')!==h));
 assert.equal(hash(read('service/round_types.json').profiles[plans[32835].sourceKey]),'6c451dc606f8818315a31908dec4c6868ddfb74f6115f05b92e1e5b6efcae313');
});
