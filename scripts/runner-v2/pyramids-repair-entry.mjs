import assert from 'node:assert/strict';
import {observationPrimary,rhinoTwoPrimary} from './secondary-parallel-boundary.mjs';

// An entry selects immutable parent evidence; it never creates quota or chooses a peer dynamically.
export function pyramidsRepairEntry(mode,name,retireName){
 assert(['retire','activate','admit'].includes(mode),'PYRAMIDS_REPAIR_OPERATION');
 const v2=name==='formal-repair-pyramids-display-20261001.json';
 assert(v2||name===(mode==='retire'?'formal-count-pyramids-20261001.json':'formal-repair-pyramids-coins-20261001.json'),'PYRAMIDS_REPAIR_PROFILE_PATH');
 const oldName=v2?'formal-repair-pyramids-coins-20261001.json':'formal-count-pyramids-20261001.json';
 assert(!retireName||mode==='retire'&&(v2?['formal-retire-pyramids-display-20261001.json','formal-retire-pyramids-display-entryfix-20261001.json']:['formal-retire-pyramids-coins-20261001.json']).includes(retireName),'PYRAMIDS_RETIRE_PROFILE_PATH');
 return {v2,oldName,parserProfile:mode==='retire'?oldName:name,
  newName:v2?name:'formal-repair-pyramids-coins-20261001.json',
  retireName:retireName??(v2?'formal-retire-pyramids-display-20261001.json':'formal-retire-pyramids-coins-20261001.json'),
  sourceId:v2?36791455132:36778619850,primaryRun:v2?rhinoTwoPrimary:observationPrimary,allowEndedPrimary:v2};
}
