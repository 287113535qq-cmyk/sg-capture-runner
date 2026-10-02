import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {checkVeryFruityNextProfile} from './veryfruity-next-profile.mjs';import {applyDemoPilot} from './demo-pilot-plan.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[32812];
function fixture(){const from={...plans[32721],countAllocation:'c'.repeat(64)},generation='d'.repeat(64);return {schema:'sg-demo-next-game-v1',group:'secondary',workerOffset:20,gameId:32812,fromGameId:32721,completePreserved:0,abandonedAttempts:0,newBetAllowance:100,perWorker:5,workers:20,oldPlanHash:hash(base),planHash:hash({...base,demoGeneration:generation}),generation,createdAt:1000,expiresAt:7201000,sourcePlanHash:hash(from),sourceCommit:'a'.repeat(40),sourceRunKey:'capture-run:123:1',emptyCandidate:{schema:'sg-empty-demo-candidate-v1',campaignHash:'b'.repeat(64)},sourceFormal:{schema:'sg-formal-source-boundary-v1',kind:'complete',plan:from,planHash:hash(from),commit:'a'.repeat(40),run:'123:1',proofKey:'game-audit:sg_r1_20260928_32721',...Object.fromEntries(['proofHash','campaignHash','poolHash','specHash','runPermitHash'].map(k=>[k,'e'.repeat(64)]))}};}
test('independent JS and Python accept only bounded next pilot from an audited complete source',()=>{
 const p=fixture();assert(checkVeryFruityNextProfile(p,base));assert.deepEqual(applyDemoPilot(plans,p)[32812],{...base,demoGeneration:p.generation});
 const py=process.env.PYTHON??(process.platform==='win32'?'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe':'python3');
 const r=spawnSync(py,['-c','import sys,json;from veryfruity_demo_plan import veryfruity_demo_plan;q=json.load(sys.stdin);print(json.dumps(veryfruity_demo_plan(q["base"],q["profile"])))'],{encoding:'utf8',env:{...process.env,PYTHONPATH:'service'},input:JSON.stringify({base,profile:p})});
 assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),applyDemoPilot(plans,p)[32812]);
});
test('old source, historical credit, unlimited quota and wrong complete proof never grant the new pilot',()=>{
 const p=fixture();for(const change of [{newBetAllowance:101},{completePreserved:1},{sourceClosureHash:'f'.repeat(64)},{workerOffset:0},{sourceFormal:{...p.sourceFormal,kind:'retired'}},{sourceFormal:{...p.sourceFormal,proofKey:'other'}}])assert.throws(()=>checkVeryFruityNextProfile({...p,...change},base));
});
