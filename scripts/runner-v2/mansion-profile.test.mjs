import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {applyDemoPilot} from './demo-pilot-plan.mjs';import {demoPilotProfilePath} from './demo-pilot-profile.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('Mansion has independent 20x5 scope bound to the closed More Puff generation',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-pilot-mansion-20260930.json')),plans=JSON.parse(fs.readFileSync('config/round-one-plans.json'));
 assert.equal(p.gameId,32714);assert.equal(p.fromGameId,32718);assert.equal(p.completePreserved,103);assert.equal(p.abandonedAttempts,2);
 assert.equal(p.newBetAllowance,100);assert.equal(p.perWorker,5);assert.equal(p.workers,20);
 assert.equal(p.sourceClosureHash,'73a71436e57a076bfba810b3bcd35f52afb76c1c32b26d0ad7ed8b0aecf438e4');
 assert.equal(p.sourceProfileHash,hash(JSON.parse(fs.readFileSync('config/demo-pilot-morepuff-20260930.json'))));
 assert.equal(p.legacyImport.archiveHash,'54ca2fd0aba5ba804c6d501c9809d0bf171238daa789302039b761cda3001659');
 const plan=applyDemoPilot(plans,p)[32714];assert.equal(plan.demoGeneration,p.generation);
 assert.throws(()=>applyDemoPilot(plans,{...p,newBetAllowance:101}));
 assert.equal(demoPilotProfilePath({SG_DEMO_PILOT_PROFILE:'demo-pilot-mansion-20260930.json'}),'config/demo-pilot-mansion-20260930.json');
 const r=spawnSync(process.env.PYTHON||'python3',['-c',`import sys,json,os
sys.path.insert(0,'service')
from pool_plan import validate_pool_plan
p=json.load(sys.stdin);assert validate_pool_plan(p)==p
os.environ['SG_DEMO_PILOT_PROFILE']='demo-pilot-morepuff-20260930.json'
try:validate_pool_plan(p)
except Exception:pass
else:raise AssertionError('OLD_PROFILE_ACCEPTED_NEXT_GAME')`],{env:{...process.env,SG_DEMO_PILOT_PROFILE:'demo-pilot-mansion-20260930.json'},input:JSON.stringify(plan),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
});
