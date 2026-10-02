import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {actionFinalAuditEnvironment} from './action-final-audit-runtime.mjs';
import {pyramidsDirectActionPlan,RESUME_ACTION_PROFILE} from './pyramids-direct-action-profile.mjs';import {analyzer} from './analyzer.mjs';
test('independent final audit explicitly binds the real Python plan with absent or wrong ambient profile',async()=>{
 const base=JSON.parse(fs.readFileSync('config/round-one-plans.json'))[32721],profile=JSON.parse(fs.readFileSync('config/'+RESUME_ACTION_PROFILE)),plan=pyramidsDirectActionPlan(base,profile);
 for(const ambient of [undefined,'formal-count-pyramids-20261001.json']){
  const inherited={...process.env};if(ambient===undefined)delete inherited.SG_FORMAL_COUNT_PROFILE;else inherited.SG_FORMAL_COUNT_PROFILE=ambient;
  const env=actionFinalAuditEnvironment(inherited);assert.equal(env.SG_FORMAL_COUNT_PROFILE,RESUME_ACTION_PROFILE);assert.equal(inherited.SG_FORMAL_COUNT_PROFILE,ambient);
  const parser=analyzer({python:process.env.PYTHON||'python3',auditWorkers:2,env});
  try{assert.deepEqual(await parser.call({op:'plan',plan}),{validated:true});await assert.rejects(parser.call({op:'plan',plan:{...plan,target:300000}}));}finally{parser.close();}
 }
 const yaml=createRequire(process.cwd()+'/collector/package.json')('js-yaml'),workflow=yaml.load(fs.readFileSync('.github/workflows/demo-maintenance.yml','utf8'));
 assert(workflow.on.workflow_dispatch.inputs.direct_audit_profile.options.includes('count-audit-pyramids-network-entryfix-20261002.json'));
 const control=fs.readFileSync('scripts/runner-v2/action-final-audit-control.mjs','utf8');assert(control.includes('env:actionFinalAuditEnvironment()'));
 assert(workflow.jobs['pyramids-direct-final-audit'].steps.some(s=>s.run==='node scripts/runner-v2/action-final-audit-control.mjs ${{ inputs.direct_audit_profile }}'));
});
