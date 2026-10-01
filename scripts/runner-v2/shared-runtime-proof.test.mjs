import test from 'node:test';import assert from 'node:assert/strict';
import {readSharedRuntimeProof} from './shared-runtime-proof.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const docs=new Map(),trial='sg_r1_20261001_32799',sourceRun='36844672513:1',sourceCommit='586d34262675ea5b09fc7bbe6475ec696e706885',activation='a'.repeat(64);
 const plan={trialId:trial},profile={schema:'sg-session-layout-rhino-v1',activation,sessionLayout:{lanesPerHost:2}},jobs={total_count:20,jobs:[]},
  originalPool={confirmed:51122},campaign={activeGame:32799},hold={active:true,details:{code:'GLOBAL_SOURCE_STOPPED'}};
 const approved={schema:'sg-count-shared-close-profile-v1',group:'primary',gameId:32799,trialId:trial,completePreserved:52897,abandonedAttempts:28,sourceRun,sourceCommit,sourceAllowance:0,jobsHash:hash(jobs),poolHash:hash(originalPool),campaignHash:hash(campaign),holdHash:hash(hold)};
 const key=`count-shared-close:${trial}:${sourceRun}`,retirement='retired-count:test',retired={schema:'sg-retired-count-result-v1',recordsHash:'b'.repeat(64),completePreserved:52897,abandonedAttempts:28,sourceRequests:0,newBetAllowance:0};
 const close={schema:'sg-count-shared-close-v1',profileHash:hash(approved),activation,trialId:trial,sourceRun,sourceCommit,group:'primary',completePreserved:52897,abandonedAttempts:28,unknownAttempts:0,sourceRequests:0,newBetAllowance:0,requiresNewSession:true,repairKey:null,retirement,retirementHash:hash(retired),recordsHash:retired.recordsHash};
 const put=(c,k,v)=>docs.set(c+'/'+k,{value:structuredClone(v)});
 put('journal',key+':complete',close);put('journal',key+':settled',close);put('journal',key+':before',{schema:'sg-count-shared-before-v1',profileHash:hash(approved),pool:originalPool,campaign,hold});put('journal',retirement+':complete',retired);
 put('state','pool:'+trial,{enabled:true,failure:null,countSharedClosure:key,retiredCount:retirement});put('state','global-hold',{active:false,countSharedClosure:key});
 const revision={sharedClosureKey:key+':complete',sharedCloseProfileHash:hash(approved),sharedClosureHash:hash(close),sourceRun,fromCommit:sourceCommit,newBetAllowance:0,completePreserved:52897};
 const args={store:{get:async(c,k)=>structuredClone(docs.get(c+'/'+k))},plan,profile,revision,approved,jobs,ended:{id:36844672513,run_attempt:1,status:'completed',conclusion:'failure',head_sha:sourceCommit}};
 return {args,docs,key,retirement};
}
test('exact settled shared stop allows read-only runtime continuation proof',async()=>{const f=fixture(),before=hash([...f.docs]);assert.equal((await readSharedRuntimeProof(f.args)).completePreserved,52897);assert.equal(hash([...f.docs]),before);});
for(const bad of ['missing-close','changed-close','unsettled','wrong-source','changed-jobs','hold','missing-retirement','record-hash','wrong-count','extra-quota','disabled'])test('shared continuation refuses '+bad,async()=>{
 const f=fixture(),a=f.args;
 if(bad==='missing-close')f.docs.delete('journal/'+f.key+':complete');
 if(bad==='changed-close')f.docs.get('journal/'+f.key+':complete').value.unknownAttempts=1;
 if(bad==='unsettled')f.docs.get('journal/'+f.key+':settled').value.abandonedAttempts=27;
 if(bad==='wrong-source')a.ended.id++;
 if(bad==='changed-jobs')a.jobs.total_count++;
 if(bad==='hold')f.docs.get('state/global-hold').value.active=true;
 if(bad==='missing-retirement')f.docs.delete('journal/'+f.retirement+':complete');
 if(bad==='record-hash')f.docs.get('journal/'+f.retirement+':complete').value.recordsHash='c'.repeat(64);
 if(bad==='wrong-count')a.revision.completePreserved--;
 if(bad==='extra-quota')a.revision.newBetAllowance=1;
 if(bad==='disabled')f.docs.get('state/pool:'+a.plan.trialId).value.enabled=false;
 await assert.rejects(readSharedRuntimeProof(a));
});
