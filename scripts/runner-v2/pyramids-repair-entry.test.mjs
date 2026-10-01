import test from 'node:test';import assert from 'node:assert/strict';
import {pyramidsRepairEntry} from './pyramids-repair-entry.mjs';
import {rhinoTwoPrimary,observationPrimary} from './secondary-parallel-boundary.mjs';
test('display repair binds failed coins parent and reviewed independent Rhino peer',()=>{
 for(const mode of ['retire','activate','admit']){const e=pyramidsRepairEntry(mode,'formal-repair-pyramids-display-20261001.json');
  assert.equal(e.oldName,'formal-repair-pyramids-coins-20261001.json');assert.equal(e.sourceId,36791455132);
  assert.equal(e.primaryRun,rhinoTwoPrimary);assert.equal(e.allowEndedPrimary,true);
  assert.equal(e.parserProfile,mode==='retire'?e.oldName:e.newName);
 }
});
test('old repair entry retains its original source and peer; arbitrary scope refuses',()=>{
 assert.equal(pyramidsRepairEntry('retire','formal-count-pyramids-20261001.json').primaryRun,observationPrimary);
 assert.equal(pyramidsRepairEntry('activate','formal-repair-pyramids-coins-20261001.json').sourceId,36778619850);
 for(const [mode,name] of [['resume','formal-repair-pyramids-display-20261001.json'],['retire','formal-repair-pyramids-coins-20261001.json'],['admit','other.json']])assert.throws(()=>pyramidsRepairEntry(mode,name));
});
test('entry correction selects a new retirement profile while keeping the old Python plan',()=>{
 const e=pyramidsRepairEntry('retire','formal-repair-pyramids-display-20261001.json','formal-retire-pyramids-display-entryfix-20261001.json');
 assert.equal(e.parserProfile,'formal-repair-pyramids-coins-20261001.json');assert.equal(e.retireName,'formal-retire-pyramids-display-entryfix-20261001.json');
 assert.throws(()=>pyramidsRepairEntry('admit','formal-repair-pyramids-display-20261001.json',e.retireName));
 assert.throws(()=>pyramidsRepairEntry('retire','formal-count-pyramids-20261001.json',e.retireName));
});


test('continuation repair keeps the applied display parent and exact ended source',()=>{
 for(const mode of ['retire','activate','admit']){
  const e=pyramidsRepairEntry(mode,'formal-repair-pyramids-continuation-20261001.json');
  assert.equal(e.oldName,'formal-repair-pyramids-display-20261001.json');
  assert.equal(e.sourceId,36842835455);assert.equal(e.v2,true);
  assert.equal(e.parserProfile,mode==='retire'?e.oldName:e.newName);
 }
 assert.throws(()=>pyramidsRepairEntry('retire','formal-repair-pyramids-continuation-20261001.json','formal-retire-pyramids-display-20261001.json'));
});

test("continuation evidence correction keeps old parser and exact source binding",()=>{const e=pyramidsRepairEntry("retire","formal-repair-pyramids-continuation-20261001.json","formal-retire-pyramids-continuation-entryfix-20261001.json");assert.equal(e.parserProfile,"formal-repair-pyramids-display-20261001.json");assert.equal(e.sourceId,36842835455);assert.equal(e.retireName,"formal-retire-pyramids-continuation-entryfix-20261001.json");});
