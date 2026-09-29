// Portable control tests; no private protocol frames or source calls.
import test from 'node:test';import assert from 'node:assert/strict';
import {requireShortRun} from './protocol-recovery-core.mjs';
import {reviewProtocolResume} from './protocol-resume.mjs';
import {PendingFirst} from './pending-first.mjs';
import {BeaverPendingOnly} from './beaver-pending-only.mjs';
const commit='a'.repeat(40),run='capture-run:123456:1';
const campaign=()=>({activeGame:32820,validationLimit:1,protocolValidation:{phase:'short',gameId:32820,commit,runKey:null,beaverPending:'b'.repeat(64)}});
test('Beaver finite run binds once and rejects another run; other games retain ten-round contract',()=>{
 const c=campaign();assert.equal(requireShortRun(c,run,commit),true);assert.equal(requireShortRun(c,run,commit),false);assert.throws(()=>requireShortRun(c,'capture-run:123457:1',commit),/REVIEW_REQUIRED/);
 for(const mutate of [c=>c.validationLimit=10,c=>c.protocolValidation.gameId=32739,c=>c.protocolValidation.freshStart='c'.repeat(64),c=>c.protocolValidation.beaverPending='unknown']){const bad=campaign();mutate(bad);assert.throws(()=>requireShortRun(bad,run,commit),/SHORT_CHANGED/);}
 const old={activeGame:32739,validationLimit:10,protocolValidation:{phase:'short',gameId:32739,commit,runKey:null}};assert.equal(requireShortRun(old,run,commit),true);
});
test('legacy generic resume grant cannot authorize Beaver',()=>{
 assert.throws(()=>reviewProtocolResume({plan:{gameId:32820,phase:1,buy:0},batch:{protocolResume:{}},grant:{schema:'sg-protocol-resume-v1'},worker:7,sessionHash:'s',commit,now:1}),/BEAVER_RESUME_SCOPE/);
});
test('Beaver pending stage does not permit BET or capture stage',async()=>{
 const p=new BeaverPendingOnly({store:{get:async()=>({value:campaign()})},plan:{gameId:32820,phase:1,buy:0},stage:'capture',runKey:run,now:()=>1});
 await assert.rejects(p.load({commitSha:commit}),/SCOPE/);assert.throws(()=>p.beforeNewRequest(),/NEW_BET_FORBIDDEN/);
});
test('production PendingFirst routes Beaver marker to independent proof checks',async()=>{
 const c=campaign();c.enabled=true;c.protocolValidation.runKey=run;
 const pending=new PendingFirst({store:{get:async(kind,key)=>key==='campaign'?{value:c}:null},plan:{gameId:32820,phase:1,buy:0},stage:'resume',runKey:run,now:()=>1});
 await assert.rejects(pending.admit({commitSha:commit,shardId:7},7),/BEAVER_PENDING_PROOF/);
 assert(pending.beaver instanceof BeaverPendingOnly);assert.equal(pending.admission,null);
});
