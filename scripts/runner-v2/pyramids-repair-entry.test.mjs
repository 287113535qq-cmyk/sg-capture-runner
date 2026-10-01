import test from 'node:test';import assert from 'node:assert/strict';
import {pyramidsRepairEntry} from './pyramids-repair-entry.mjs';
import {rhinoTwoPrimary,observationPrimary} from './secondary-parallel-boundary.mjs';
test('display repair binds failed coins parent and reviewed independent Rhino peer',()=>{
 for(const mode of ['retire','activate','admit']){const e=pyramidsRepairEntry(mode,'formal-repair-pyramids-display-20261001.json');
  assert.equal(e.oldName,'formal-repair-pyramids-coins-20261001.json');assert.equal(e.sourceId,36791455132);
  assert.equal(e.primaryRun,rhinoTwoPrimary);assert.equal(e.allowEndedPrimary,true);
 }
});
test('old repair entry retains its original source and peer; arbitrary scope refuses',()=>{
 assert.equal(pyramidsRepairEntry('retire','formal-count-pyramids-20261001.json').primaryRun,observationPrimary);
 assert.equal(pyramidsRepairEntry('activate','formal-repair-pyramids-coins-20261001.json').sourceId,36778619850);
 for(const [mode,name] of [['resume','formal-repair-pyramids-display-20261001.json'],['retire','formal-repair-pyramids-coins-20261001.json'],['admit','other.json']])assert.throws(()=>pyramidsRepairEntry(mode,name));
});
