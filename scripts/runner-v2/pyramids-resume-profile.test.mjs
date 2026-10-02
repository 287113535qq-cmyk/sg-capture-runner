import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {pyramidsResumeActionPlan,RESUME_ACTION_PROFILE} from './pyramids-resume-action-profile.mjs';
import {pyramidsRepairEntry} from './pyramids-repair-entry.mjs';
test('independent resume permission inherits actual closed count and never changes the applied parent',()=>{
 const base=JSON.parse(fs.readFileSync('config/round-one-plans.json'))[32721];
 const p=JSON.parse(fs.readFileSync('config/'+RESUME_ACTION_PROFILE)),parent=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-direct-action-20261002.json'));
 assert.equal(hash(parent),'2bde56b5d7af4086256d3e3912630a1b6d137e751ab0ef34024ebb7b21d51f33');
 assert.equal(p.retirementHash,'6c44645db3111765134cd6f7024e1669a0e1caeb926a9afd4fd4b9e3ace9a16a');
 assert.equal(p.nativeRetirementHash,'e3a897500ce6ab44544aa44bcefcf6807a4c65bd15bcba326e15009e7c3ba80c');
 const plan=pyramidsResumeActionPlan(base,p);assert.equal(plan.target-p.completePreserved,156056);
 const entry=pyramidsRepairEntry('activate',RESUME_ACTION_PROFILE);assert.equal(entry.sourceId,37008008283);assert.equal(entry.resumed,true);
 for(const [k,v]of Object.entries({remainingComplete:156057,sourceAllowance:1,sourceRun:'37008008283:2',featureProfile:'pyramids-action-v2'}))
 assert.throws(()=>pyramidsResumeActionPlan(base,{...p,[k]:v}));
});
