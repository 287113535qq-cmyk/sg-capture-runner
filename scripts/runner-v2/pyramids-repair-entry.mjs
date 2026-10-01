import assert from 'node:assert/strict';
import {observationPrimary,rhinoTwoPrimary} from './secondary-parallel-boundary.mjs';

// An entry selects immutable parent evidence; it never creates quota or chooses a peer dynamically.
export function pyramidsRepairEntry(mode,name,retireName){
 assert(['retire','activate','admit'].includes(mode),'PYRAMIDS_REPAIR_OPERATION');
 if(['formal-repair-pyramids-major-20261001.json','formal-repair-pyramids-major-entryfix-20261001.json'].includes(name)){assert(mode!=='retire'&&!retireName,'PYRAMIDS_MAJOR_ALREADY_RETIRED');return {v2:true,v3:true,oldName:'formal-repair-pyramids-continuation-20261001.json',parserProfile:name,newName:name,sourceId:36848037333};}
 const continuation=name==='formal-repair-pyramids-continuation-20261001.json';
 const v2=continuation||name==='formal-repair-pyramids-display-20261001.json';
 assert(v2||name===(mode==='retire'?'formal-count-pyramids-20261001.json':'formal-repair-pyramids-coins-20261001.json'),'PYRAMIDS_REPAIR_PROFILE_PATH');
 const oldName=continuation?'formal-repair-pyramids-display-20261001.json':v2?'formal-repair-pyramids-coins-20261001.json':'formal-count-pyramids-20261001.json';
 assert(!retireName||mode==='retire'&&(continuation?['formal-retire-pyramids-continuation-20261001.json','formal-retire-pyramids-continuation-entryfix-20261001.json']:v2?['formal-retire-pyramids-display-20261001.json','formal-retire-pyramids-display-entryfix-20261001.json']:['formal-retire-pyramids-coins-20261001.json']).includes(retireName),'PYRAMIDS_RETIRE_PROFILE_PATH');
 return {v2,oldName,parserProfile:mode==='retire'?oldName:name,
  newName:v2?name:'formal-repair-pyramids-coins-20261001.json',
  retireName:retireName??(continuation?'formal-retire-pyramids-continuation-20261001.json':v2?'formal-retire-pyramids-display-20261001.json':'formal-retire-pyramids-coins-20261001.json'),
  sourceId:continuation?36842835455:v2?36791455132:36778619850,primaryRun:v2?rhinoTwoPrimary:observationPrimary,allowEndedPrimary:v2};
}
