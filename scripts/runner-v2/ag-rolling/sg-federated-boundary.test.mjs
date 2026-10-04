import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {companionBoundary} from './sg-federated-boundary.mjs';import {cohortRepos} from './sg-federation.mjs';
import {stalled} from '../demo-run-fence.mjs';import {original} from '../expired-run-review.mjs';
function setup(mode){
 const commit='a'.repeat(40),identity={run_attempt:1,head_sha:commit,head_branch:'main',event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',status:'in_progress'};
 const primary={...identity,id:101,repository:{full_name:cohortRepos.primary}},secondary={...identity,id:102,repository:{full_name:cohortRepos.secondary}};
 const ghost={...identity,id:original.id,head_sha:original.commit,status:'queued',conclusion:null,repository:{full_name:cohortRepos.primary}};
 const old={...ghost,id:stalled.id,head_sha:stalled.commit};
 const read=async path=>{
  if(path.includes('/actions/runs?')){let rows=[];
   if(path.includes('status=in_progress'))rows=path.includes(cohortRepos.primary)?[primary]:[secondary];
   if(path.includes('status=queued')&&path.includes(cohortRepos.primary))rows=[ghost,old];
   if(mode==='other'&&path.includes('status=waiting'))rows.push({...identity,id:103});
   return {total_count:rows.length,workflow_runs:rows};}
  if(path.endsWith('/102'))return {...secondary,...(mode==='changed'?{head_sha:'b'.repeat(40)}:{})};
  if(path.endsWith('/101'))return primary;
  if(path.includes('/jobs?'))return mode==='old-job'&&path.includes('/'+stalled.id+'/')?{total_count:1,jobs:[{}]}:{total_count:0,jobs:[]};
  return path.endsWith('/'+stalled.id)?old:ghost;
 };
 const profile={payload:{games:[{gameId:'32441'},{gameId:'32442'}]},federation:{schema:'sg-ag-two-cohort-v1',lanesPerCohort:20,totalLanes:40,namespace:'primary',assignments:[{gameId:'32441',cohort:'primary'},{gameId:'32442',cohort:'secondary'}]}};
 return companionBoundary({read,profile,store:{get:async()=>null,getMany:async keys=>keys.map(()=>null)},transport:{request:async()=>[]},
  oldProfile:JSON.parse(fs.readFileSync('config/demo-pilot-beaver-20260930.json','utf8')),run:'102:1',coordinatorRun:'101:1',commit});
}
test('only the exact authenticated companion is admitted beside its primary; fixed historical source fences remain checked',async()=>{await setup()();});
for(const mode of ['other','changed','old-job'])test('companion boundary rejects '+mode,async()=>{await assert.rejects(setup(mode)());});
