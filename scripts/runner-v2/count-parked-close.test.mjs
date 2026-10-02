import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {closeParkedCount} from './count-parked-close.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
const load=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const profile=load('config/count-close-pyramids-sfgt-20261002.json');
const plan=applyFormalCount(load('config/round-one-plans.json'),load('config/formal-repair-pyramids-super-hold-20261002.json'))[32721];
test('parked count maintenance rejects altered authority before reading or writing',async()=>{
 const forbid=async()=>{throw Error('UNEXPECTED_IO');};
 for(const changed of [{...profile,sourceAllowance:1},{...profile,sourceRun:'36946815410:2'},
  {...profile,sourceCommit:'a'.repeat(40)},{...profile,completePreserved:5714},{...profile,expiresAt:profile.createdAt}]){
  await assert.rejects(closeParkedCount({profile:changed,plan,commit:'f'.repeat(40),run:'999:1',
   boundary:forbid,store:{get:forbid},now:()=>profile.createdAt}),/^AssertionError.*PARKED_COUNT_CLOSE_SCOPE/);
 }
});
test('fixed parked maintenance is separate from source and preserves legacy defaults',()=>{
 const w=fs.readFileSync('.github/workflows/demo-maintenance.yml','utf8');
 assert(w.includes("inputs.operation != 'close-pyramids-parked'"));
 const job=w.slice(w.indexOf('  pyramids-parked-close:'));assert(job.includes('count-parked-close-control.mjs'));
 assert(!job.includes('trial-300k.yml')&&!job.includes('SG_TRIAL_ENABLED'));
 assert.equal(hash(profile),'d39d64fcde3d6f9a98516e7b93ff8abb560eef5c43da74655486e9f0ac194bda');
});
