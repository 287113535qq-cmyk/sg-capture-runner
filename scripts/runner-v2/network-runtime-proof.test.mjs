import test from 'node:test';import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';import {readNetworkRuntimeProof} from './network-runtime-proof.mjs';
function fixture(){
 const plan={gameId:32799,trialId:'sg_r1_20261001_32799'},profile={schema:'sg-session-layout-rhino-v1',sessionLayout:{lanesPerHost:2},activation:'a'.repeat(64)};
 const jobs={total_count:22,jobs:[]},oldPool={confirmed:198649},campaign={activeGame:32799},hold={active:true,details:{code:'SOURCE_NETWORK_OUTCOME_UNKNOWN'}};
 const approved={schema:'sg-count-network-close-profile-v1',trialId:plan.trialId,sourceRun:'36886658723:1',sourceCommit:'14c2d194c2ae48525bafdfebd4fd30cea036b948',
  sourceProfileHash:hash(profile),completePreserved:199775,abandonedAttempts:14,unknownAttempts:1,sourceAllowance:0,jobsHash:hash(jobs),poolHash:hash(oldPool),campaignHash:hash(campaign),holdHash:hash(hold)};
 const key=`count-network-close:${plan.trialId}:${approved.sourceRun}`,retirement='retired-count:fixture',retired={schema:'sg-retired-count-result-v1',completePreserved:199775,abandonedAttempts:14,sourceRequests:0,newBetAllowance:0};
 const close={schema:'sg-count-network-close-v1',profileHash:hash(approved),activation:profile.activation,trialId:plan.trialId,sourceRun:approved.sourceRun,sourceCommit:approved.sourceCommit,
  completePreserved:199775,abandonedAttempts:14,unknownAttempts:1,sourceRequests:0,newBetAllowance:0,requiresNewSession:true,retirement,retirementHash:hash(retired)};
 const docs=new Map([['journal/'+key+':complete',close],['journal/'+key+':settled',close],['journal/'+key+':before',{schema:'sg-count-network-before-v1',profileHash:hash(approved),pool:oldPool,campaign,hold}],
  ['journal/'+retirement+':complete',retired],['state/pool:'+plan.trialId,{countNetworkClosure:key,retiredCount:retirement,enabled:true,failure:null,confirmed:199775}],['state/global-hold',{active:false,countNetworkClosure:key}]]);
 const revision={networkClosureKey:key+':complete',networkCloseProfileHash:hash(approved),sourceRun:approved.sourceRun,fromCommit:approved.sourceCommit,completePreserved:199775,newBetAllowance:0,networkClosureHash:hash(close)};
 return {args:{store:{get:async(c,k)=>docs.has(c+'/'+k)?{value:structuredClone(docs.get(c+'/'+k))}:null},plan,profile,revision,approved,jobs,ended:{id:36886658723,run_attempt:1,status:'completed',conclusion:'failure',head_sha:approved.sourceCommit}},docs,key};
}
test('a failed source becomes eligible only through its exact settled no-source closure',async()=>{const f=fixture();const before=hash([...f.docs]);const r=await readNetworkRuntimeProof(f.args);assert.equal(r.completePreserved,199775);assert.equal(hash([...f.docs]),before);});
for(const cause of ['missing-complete','missing-settled','active-hold','different-jobs','changed-before','wrong-activation','quota','count','changed-retirement'])test('reject network runtime '+cause,async()=>{
 const f=fixture();if(cause==='missing-complete')f.docs.delete('journal/'+f.key+':complete');if(cause==='missing-settled')f.docs.delete('journal/'+f.key+':settled');
 if(cause==='active-hold')f.docs.get('state/global-hold').active=true;if(cause==='different-jobs')f.args.jobs.total_count=23;
 if(cause==='changed-before')f.docs.get('journal/'+f.key+':before').pool.confirmed++;
 if(cause==='wrong-activation')f.args.profile.activation='b'.repeat(64);if(cause==='quota')f.args.revision.newBetAllowance=1;
 if(cause==='count')f.args.revision.completePreserved++;if(cause==='changed-retirement')f.docs.get('journal/retired-count:fixture:complete').abandonedAttempts++;
 await assert.rejects(readNetworkRuntimeProof(f.args));});
