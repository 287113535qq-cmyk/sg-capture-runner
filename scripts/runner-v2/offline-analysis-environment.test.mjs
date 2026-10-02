import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {offlineAnalysisEnvironment} from './offline-analysis-environment.mjs';
import {actionAnalysisPlan} from './action-analysis-binding.mjs';
test('historical analysis binds the exact applied plan and removes unrelated ambient permissions',()=>{
 const root=process.cwd(),read=n=>JSON.parse(fs.readFileSync(path.join(root,'config',n),'utf8'));
 const plan=actionAnalysisPlan({base:read('round-one-plans.json')[32721],
  profile:read('formal-repair-pyramids-action-20261002.json'),name:'formal-repair-pyramids-action-20261002.json'});
 const ambient={SG_DEMO_PILOT_PROFILE:'unrelated',SG_FORMAL_COUNT_PROFILE:'unrelated'};
 const env=offlineAnalysisEnvironment(root,plan,ambient);
 assert.equal(env.SG_FORMAL_COUNT_PROFILE,'formal-repair-pyramids-action-20261002.json');
 assert.equal(env.SG_DEMO_PILOT_PROFILE,undefined);assert.equal(ambient.SG_DEMO_PILOT_PROFILE,'unrelated');
 const changed=offlineAnalysisEnvironment(root,{...plan,target:plan.target+1},ambient);
 assert.equal(changed.SG_FORMAL_COUNT_PROFILE,undefined);assert.equal(changed.SG_DEMO_PILOT_PROFILE,undefined);
});
