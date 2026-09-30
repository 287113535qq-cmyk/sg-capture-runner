import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {awardFixture} from './pearl-award-fixture.mjs';import {pearlAwardReview as review,pearlAwardMapping,PEARL_AWARD_EXTENSION,PEARL_SOURCE} from './pearl-award-protocol.mjs';
import {pearlRetriggerReview,PEARL_RETRIGGER_EXTENSION} from './pearl-retrigger-protocol.mjs';import {protocolHash as hash} from '../runner-v2/protocol-resume.mjs';
test('official supplied counts conserve progress for varied initial and repeated awards',()=>{
 for(const [initial,adds] of [[8,{}],[15,{}],[8,{7:8}],[15,{7:8}],[8,{7:15}],[15,{4:8,14:15}]]){
  const raw=awardFixture(initial,adds);assert.equal(review(raw).next,null);
  for(let n=0;n<raw.steps.length;n++)assert.equal(review({...raw,steps:raw.steps.slice(0,n)}).next,n===raw.steps.length-1?'EndGame':'Logic');
 }
 assert.equal(review(awardFixture(1024)).next,null);assert.throws(()=>review(awardFixture(1025)));
});
test('new award mapping is distinct while original eight-count mappings remain unchanged',()=>{
 const profiles=JSON.parse(fs.readFileSync('service/round_types.json','utf8')).profiles,base=hash(profiles[PEARL_SOURCE]),ext={retrigger:hash(profiles[PEARL_RETRIGGER_EXTENSION]),awards:hash(profiles[PEARL_AWARD_EXTENSION])};
 assert.equal(pearlAwardMapping(awardFixture(8),base,ext).typeMappingHash,base);
 assert.equal(pearlAwardMapping(awardFixture(8,{7:8}),base,ext).typeMappingHash,ext.retrigger);
 assert.equal(pearlAwardMapping(awardFixture(15),base,ext).typeMappingHash,ext.awards);
 assert.throws(()=>pearlRetriggerReview(awardFixture(15)));
 assert.throws(()=>pearlAwardMapping(awardFixture(15),base,{}));
});
test('variable counts do not permit counter tampering or premature terminal',()=>{
 for(const [index,a,b] of [[0,'freeSpinsTotal="15"','freeSpinsTotal="16"'],[0,'freeSpinsAwarded="15"','freeSpinsAwarded="0"'],[2,'readyForEndGame="N"','readyForEndGame="Y"'],[3,'freeSpinNumber="3"','freeSpinNumber="2"'],[3,'fsWinnings="400"','fsWinnings="0"'],[0,'bonusAwarded="Y"','bonusAwarded="N"']]){
  const raw=awardFixture(15),step=raw.steps[index];step.responseXml=step.responsePayload=step.responsePayload.replace(a,b);assert.throws(()=>review(raw));
 }
});
