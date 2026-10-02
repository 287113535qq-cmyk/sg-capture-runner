import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {closeParkedCount} from './count-parked-close.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
const load=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const profile=load('config/count-close-pyramids-super-coin-20261002.json');
const plan=applyFormalCount(load('config/round-one-plans.json'),load('config/formal-repair-pyramids-cash-coins-20261002.json'))[32721];
test('already parked Super Free Mini combination close rejects changed target or source authority before any I/O',async()=>{
 const forbid=async()=>{throw Error('UNEXPECTED_IO');};
 for(const change of [{sourceAllowance:1},{sourceRun:'36961087858:2'},{sourceCommit:'a'.repeat(40)},
  {completePreserved:8392},{sourceProfileHash:'0'.repeat(64)},{abandonedAlready:2}]){
  await assert.rejects(closeParkedCount({profile:{...profile,...change},plan,commit:'f'.repeat(40),run:'999:1',
   boundary:forbid,store:{get:forbid},now:()=>profile.createdAt}),/PARKED_COUNT_CLOSE_SCOPE/);
 }
});
test('coin closure uses an explicit no-source choice and preserves old default',()=>{
 const wf=fs.readFileSync('.github/workflows/demo-maintenance.yml','utf8');
 assert(wf.includes('default: count-close-pyramids-sfgt-20261002.json'));
 assert(wf.includes("SG_PARKED_CLOSE_PROFILE: ${{ inputs.parked_close_profile || 'count-close-pyramids-sfgt-20261002.json' }}"));
 const job=wf.slice(wf.indexOf('  pyramids-parked-close:'));
 assert(!job.includes('trial-300k.yml')&&!job.includes('SG_TRIAL_ENABLED'));
});
