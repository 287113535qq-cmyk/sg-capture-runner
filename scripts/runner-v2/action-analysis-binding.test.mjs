import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {actionAnalysisPlan} from './action-analysis-binding.mjs';
import {RESUME_ACTION_RELAY_RUNTIME} from './action-direct-relay-runtime.mjs';
test('independent analysis selects the immutable resume plan and refuses mismatched runtime or parent',()=>{
 const base=JSON.parse(fs.readFileSync('config/round-one-plans.json'))[32721],name='formal-repair-pyramids-resume-action-20261002.json';
 const profile=JSON.parse(fs.readFileSync('config/'+name));
 assert.equal(actionAnalysisPlan({base,profile,name}).featureProfile,'pyramids-action-v3');
 assert.equal(actionAnalysisPlan({base,profile,name,runtimeName:RESUME_ACTION_RELAY_RUNTIME}).countAllocation,profile.activation);
 assert.throws(()=>actionAnalysisPlan({base,profile,name,runtimeName:'count-runtime-pyramids-direct-action-relay-historyfix-20261002.json'}));
 assert.throws(()=>actionAnalysisPlan({base,profile,name:'formal-repair-pyramids-action-20261002.json'}));
 assert.throws(()=>actionAnalysisPlan({base,profile,name:'unreviewed.json'}));
});
