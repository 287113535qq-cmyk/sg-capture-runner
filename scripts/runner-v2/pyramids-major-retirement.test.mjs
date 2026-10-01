import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewPyramidsMajorRetirement} from './pyramids-major-retirement.mjs';
function fixture(){
 const key='count-shared-close:sg_r1_20260928_32721:36848037333:1',oldProfile={activation:'a'.repeat(64)};
 const full={schema:'sg-retired-count-result-v1',trialId:'sg_r1_20260928_32721',completePreserved:3211,abandonedAttempts:2,recordsHash:'b'.repeat(64),sourceRequests:0,newBetAllowance:0};
 const retired={schema:'sg-count-shared-close-v1',profileHash:'1d21c06584f4752c16daff71373c3abb7d5bcc89c67aca5f5043e89c5c82ac0a',sourceRun:'36848037333:1',sourceCommit:'4c13485557529aba9dc7657487e7d9b75634f2b4',trialId:full.trialId,activation:oldProfile.activation,completePreserved:3211,abandonedAttempts:2,unknownAttempts:0,recordsHash:full.recordsHash,repairKey:'game-repair:fixture',sourceRequests:0,newBetAllowance:0,requiresNewSession:true,group:'secondary',retirement:'retired:fixture',retirementHash:hash(full),commit:'c'.repeat(40),run:'123:1'};
 const profile={retirementKey:key+':complete',retirementHash:hash(retired),sourceRun:retired.sourceRun,sourceCommit:retired.sourceCommit,recordsHash:full.recordsHash,repairKey:retired.repairKey};
 const before={schema:'sg-count-shared-before-v1',profileHash:retired.profileHash,commit:retired.commit,run:retired.run},rows=[{value:retired},{value:before},{value:full}];
 return {profile,retired,oldProfile,pool:{countSharedClosure:key,retiredCount:retired.retirement},rows,store:{getMany:async(c,ks)=>{assert.equal(c,'journal');assert.deepEqual(ks,[key+':settled',key+':before','retired:fixture:complete']);return rows;}}};
}
test('major repair consumes the real shared-stop schema and full proof',async()=>{const f=fixture();assert.equal(await reviewPyramidsMajorRetirement(f),f.retired);});
for(const reason of ['schema','head','run','quota','count','unknown','full','before','settled','pool','records'])test('shared stop cannot be substituted: '+reason,async()=>{
 const f=fixture();if(reason==='schema')f.retired.schema='sg-formal-stopped-retire-v1';if(reason==='head')f.retired.sourceCommit='0'.repeat(40);if(reason==='run')f.retired.sourceRun='999:1';if(reason==='quota')f.retired.newBetAllowance=1;if(reason==='count')f.retired.completePreserved=3210;if(reason==='unknown')f.retired.unknownAttempts=1;if(reason==='full')f.rows[2].value={...f.rows[2].value,recordsHash:'0'.repeat(64)};if(reason==='before')f.rows[1].value.run='999:1';if(reason==='settled')f.rows[0]={value:{...f.retired,extra:true}};if(reason==='pool')f.pool.retiredCount='other';if(reason==='records')f.profile.recordsHash='0'.repeat(64);
 await assert.rejects(reviewPyramidsMajorRetirement(f));
});
