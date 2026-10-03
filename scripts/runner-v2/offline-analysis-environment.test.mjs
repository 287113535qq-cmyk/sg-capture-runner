import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {offlineAnalysisEnvironment} from './offline-analysis-environment.mjs';
import {actionAnalysisPlan} from './action-analysis-binding.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {analyzer} from './analyzer.mjs';
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
test('formal repair analysis uses its exact registered count profile without granting source permission',()=>{
 const root=process.cwd(),read=n=>JSON.parse(fs.readFileSync(path.join(root,'config',n),'utf8'));
 const [name,authorization]=Object.entries(read('prepared-count-authorizations.json').profiles).find(([,a])=>a.gameId===32714);
 const plan=preparedCountPlan(read('round-one-plans.json')[32714],read(name),authorization);
 const env=offlineAnalysisEnvironment(root,plan,{SG_FORMAL_COUNT_PROFILE:'unrelated',SG_DEMO_PILOT_PROFILE:'unrelated'});
 assert.equal(env.SG_FORMAL_COUNT_PROFILE,name);assert.equal(env.SG_DEMO_PILOT_PROFILE,undefined);
 assert.throws(()=>offlineAnalysisEnvironment(root,{...plan,target:plan.target+1}),/ANALYSIS_PREPARED_PLAN_CHANGED/);
});

test('each registered formal repair plan enters the independent Python parser',async()=>{
 const root=process.cwd(),read=n=>JSON.parse(fs.readFileSync(path.join(root,'config',n),'utf8'));
 for(const [name,authorization] of Object.entries(read('prepared-count-authorizations.json').profiles)){
  const plan=preparedCountPlan(read('round-one-plans.json')[authorization.gameId],read(name),authorization);
  const parser=analyzer({python:process.env.PYTHON||'python3',env:offlineAnalysisEnvironment(root,plan)});
  try{assert.deepEqual(await parser.call({op:'plan',plan}),{validated:true});}
  finally{parser.close();}
 }
});
