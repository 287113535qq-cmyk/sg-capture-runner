import test from 'node:test';import assert from 'node:assert/strict';
import {queueHash as hash} from './ag-rolling/sg-queue-profile.mjs';
import {verifyEndedFederation,participantKey,cohortRepos} from './ag-rolling/sg-historical-starmania-ended-federation.mjs';
function fixture(){
 const games=['32441','32442'].map(gameId=>({gameId,campaignId:'fixture-'+gameId,baseline:0}));
 const previous={activation:'a'.repeat(64),payload:{queueId:'fixture-queue',games},federation:{schema:'sg-ag-two-cohort-v1',lanesPerCohort:20,totalLanes:40,namespace:'primary',assignments:[{gameId:'32441',cohort:'primary'},{gameId:'32442',cohort:'secondary'}]}};
 const prior={schema:'sg-ag-rolling-permit-v1',activation:previous.activation,profileHash:hash(previous),queueId:'fixture-queue',run:'100:1',commit:'b'.repeat(40)};
 const participant={schema:'sg-ag-cohort-joined-v1',cohort:'secondary',repository:cohortRepos.secondary,run:'101:1',coordinatorRun:prior.run,commit:prior.commit,activation:previous.activation,profileHash:hash(previous),queueId:prior.queueId,assignmentHash:hash(previous.federation),sourceRequests:0};
 const receipt={schema:'sg-ag-rolling-window-ended-v1',activation:previous.activation,profileHash:hash(previous),queueId:prior.queueId,run:prior.run,commit:prior.commit,sourceRequests:0,federationHash:hash(previous.federation),participant};
 const jobs=cohort=>{const controls=cohort==='primary'?['ag-rolling-admit','ag-rolling-finalize']:['ag-rolling-join'];const rows=[...Array.from({length:20},(_,i)=>({name:'AG rolling lane '+(i+1),status:'completed',conclusion:'success'})),...controls.map(name=>({name,status:'completed',conclusion:'success'}))];return {total_count:rows.length,jobs:rows};};
 const runs={primary:{id:100},secondary:{id:101}},allJobs={primary:jobs('primary'),secondary:jobs('secondary')};
 for(const r of Object.values(runs))Object.assign(r,{run_attempt:1,status:'completed',head_branch:'main',head_sha:prior.commit,event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml'});
 const cohort=repo=>Object.keys(cohortRepos).find(k=>cohortRepos[k]===repo);
 const args={previous,prior,receipt,store:{get:async(c,k)=>{assert.equal(c,'journal');assert.equal(k,participantKey(previous));return {value:participant};}},
  readEnded:async(id,repo)=>{assert.equal(String(runs[cohort(repo)].id),id);return runs[cohort(repo)];},readEndedJobs:async(id,repo)=>allJobs[cohort(repo)]};
 return {args,runs,allJobs,participant};
}
test('the copied production verifier independently checks both ended source inventories',async()=>{
 const f=fixture(),v=await verifyEndedFederation(f.args);assert.equal(v.primaryRun,'100:1');assert.equal(v.secondaryRun,'101:1');assert.equal(v.sourceRequests,0);
});
test('active companion, incomplete inventory or failed control cannot grant a historical window',async()=>{
 for(const alter of [f=>f.runs.secondary.status='in_progress',f=>f.allJobs.secondary.total_count++,f=>f.allJobs.primary.jobs.find(j=>j.name==='ag-rolling-finalize').conclusion='cancelled',f=>f.allJobs.secondary.jobs[19].name='AG rolling lane 19']){
  const f=fixture();alter(f);await assert.rejects(verifyEndedFederation(f.args));
 }
});
test('an unknown inventory read is issued once and cannot produce an ended proof',async()=>{
 const f=fixture();let reads=0;f.args.readEndedJobs=async()=>{reads++;throw Error('UNKNOWN_READ');};await assert.rejects(verifyEndedFederation(f.args),/UNKNOWN_READ/);assert.equal(reads,1);
});
test('a claimed recovery ending needs its own profile and durable closure proof',async()=>{
 const f=fixture();f.args.receipt.closure={schema:'sg-ag-window-closure-actor-v1',operation:'close-ended-window',run:'102:1',commit:'c'.repeat(40)};
 await assert.rejects(verifyEndedFederation(f.args),/SG_AG_WINDOW_CLOSURE_ACTOR_REQUIRED/);
});

test('the own historical admission requires the exact recovered original pair; missing federation cannot pass',async()=>{
 const {assertOwnHistoricalClosedWindow}=await import('./ag-rolling/sg-historical-starmania-actor.mjs');
 const v={primaryRun:'37314031299:1',secondaryRun:'37321135064:1',sourceRequests:0,closure:{run:'99126:1',commit:'a'.repeat(40),sourceRequests:0}};
 assert.equal(assertOwnHistoricalClosedWindow(v),v);
 for(const value of [null,{...v,primaryRun:'foreign:1'},{...v,secondaryRun:'foreign:1'},{...v,closure:null},{...v,closure:{...v.closure,sourceRequests:1}}])assert.throws(()=>assertOwnHistoricalClosedWindow(value));
});
