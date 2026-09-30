import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';import {applyDemoPilot} from './demo-pilot-plan.mjs';
test('Jinzita legacy import and new100 scope are independent from spent Luxor',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-pilot-jinzita-20260930.json','utf8')),plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'));
 assert.equal(hash(p),'203435ad5507c7196d6596d95a8590583df234c37051b42eaf86e45780eafbbf');
 assert.equal(p.gameId,32720);assert.equal(p.fromGameId,32835);assert.equal(p.completePreserved,320);assert.equal(p.abandonedAttempts,2);
 assert.equal(p.newBetAllowance,100);assert.equal(p.workers,20);assert.equal(p.perWorker,5);
 assert.equal(p.legacyImport.archiveHash,'e80429b3d847427c1519e035938931ad832b9dcce1e5fe035c8b810573809efa');
 assert.equal(p.legacyImport.mongoCount,314);assert.equal(p.legacyImport.complete,320);assert.equal(p.legacyImport.pending,2);
 assert.equal(applyDemoPilot(plans,p)[32720].demoGeneration,p.generation);
 assert.throws(()=>applyDemoPilot(plans,{...p,newBetAllowance:101}));
 assert.equal(hash(JSON.parse(fs.readFileSync('service/round_types.json','utf8')).profiles[plans[32720].sourceKey]),'b8c2ad67152633870401788d541b21624b54a03f7140ba6757505039f9bb56b5');
});
