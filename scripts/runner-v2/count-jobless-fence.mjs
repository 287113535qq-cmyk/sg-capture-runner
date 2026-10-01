import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export const joblessCount=Object.freeze({id:36854881370,commit:'38465d0872529e80bc09c60218892c14581162c0',trialId:'sg_r1_20261001_32799',repository:'zyzuoyang/sg-capture-runner',revisionHash:'7557938642322bf75bc7339092cbb4d4416351661d598db6cd28b16a608b6122'});
export const joblessKey=`count-run:${joblessCount.trialId}:${joblessCount.id}:1`;
const fenceKey=`count-jobless-revocation:${joblessCount.trialId}:${joblessCount.id}:1`;
async function identity(read){
 const [r,j]=await Promise.all([read(`repos/${joblessCount.repository}/actions/runs/${joblessCount.id}`),read(`repos/${joblessCount.repository}/actions/runs/${joblessCount.id}/jobs?filter=all&per_page=100`)]);
 assert(r.id===joblessCount.id&&r.run_attempt===1&&r.head_sha===joblessCount.commit&&r.repository?.full_name===joblessCount.repository&&r.event==='workflow_dispatch'&&r.path==='.github/workflows/trial-300k.yml'&&r.status==='queued'&&r.conclusion===null&&j.total_count===0&&Array.isArray(j.jobs)&&j.jobs.length===0,'COUNT_JOBLESS_IDENTITY');
 return {run:r.id+':1',commit:r.head_sha,jobs:0};
}
export async function fenceJoblessCount({store,read,profile,commit,run,boundary,now=Date.now}){
 assert(profile.schema==='sg-count-jobless-fence-profile-v1'&&profile.sourceRun===joblessCount.id+':1'&&profile.sourceCommit===joblessCount.commit&&profile.sourceRevisionHash===joblessCount.revisionHash&&profile.trialId===joblessCount.trialId&&/^[a-f0-9]{64}$/.test(profile.activation??'')&&profile.runtimeKey===`count-runtime:${profile.trialId}:${profile.activation}:${profile.sourceCommit}`&&profile.completePreserved===52897&&profile.newBetAllowance===0&&profile.createdAt<=now()&&now()<profile.expiresAt&&profile.expiresAt-profile.createdAt<=7200000&&/^\d+:1$/.test(run)&&run!==profile.sourceRun,'COUNT_JOBLESS_PROFILE');
 await identity(read);await boundary();
 const pool=(await store.get('state','pool:'+profile.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 assert(hash(pool)===profile.poolHash&&hash(campaign)===profile.campaignHash&&pool.enabled&&!pool.failure&&pool.confirmed===52897&&pool.countAllocation.reserved===0&&Object.values(pool.countAllocation.batches).every(b=>b.closed)&&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now()),'COUNT_JOBLESS_NOT_IDLE');
 assert(!(await store.get('journal',joblessKey))&&!(await store.get('journal',fenceKey+':before')),'COUNT_JOBLESS_ALREADY_USED');
 const old=(await store.get('journal',profile.runtimeKey))?.value;
 assert(old?.schema==='sg-count-runtime-v2'&&old.commit===joblessCount.commit&&old.revisionHash===joblessCount.revisionHash&&old.completePreserved===52897&&old.newBetAllowance===0,'COUNT_JOBLESS_RUNTIME');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'COUNT_JOBLESS_READBACK');};
 await save(fenceKey+':before',{schema:'sg-count-jobless-fence-before-v1',profileHash:hash(profile),poolHash:hash(pool),campaignHash:hash(campaign),sourceRun:profile.sourceRun,commit,run});
 await identity(read);await boundary();
 assert(hash((await store.get('state','pool:'+profile.trialId))?.value)===profile.poolHash&&!(await store.get('journal',joblessKey)),'COUNT_JOBLESS_RACE');
 // Exact admission-key tombstone: even the old immutable checkout refuses
 // RUN_ALREADY_ADMITTED. It is explicitly NOT a source permission receipt.
 const denial={schema:'sg-count-run-revoked-v1',sourceRun:profile.sourceRun,sourceCommit:profile.sourceCommit,trialId:profile.trialId,revisionHash:profile.sourceRevisionHash,profileHash:hash(profile),completePreserved:52897,sourceRequests:0,newBetAllowance:0,commit,run};
 await save(joblessKey,denial);
 const result={schema:'sg-count-jobless-fence-complete-v1',denialHash:hash(denial),sourceRun:profile.sourceRun,sourceCommit:profile.sourceCommit,profileHash:hash(profile),completePreserved:52897,sourceRequests:0,newBetAllowance:0,commit,run};
 await save(fenceKey+':complete',result);return result;
}
// One exact reviewed identity, not an arbitrary ignore list or age-based bypass.
export function joblessFencedRead({read,store,preFence=false}){
 return async path=>{
  const value=await read(path);
  if(!path.startsWith(`repos/${joblessCount.repository}/actions/runs?`)&&!path.startsWith(`repos/${joblessCount.repository}/actions/workflows/trial-300k.yml/runs?`))return value;
  assert(value.total_count===value.workflow_runs?.length&&value.total_count<100,'COUNT_JOBLESS_LIST');
  const found=value.workflow_runs.filter(r=>r.id===joblessCount.id);if(!found.length)return value;
  assert(found.length===1&&path.includes('status=queued'),'COUNT_JOBLESS_CHANGED');await identity(read);
  const denial=(await store.get('journal',joblessKey))?.value,done=(await store.get('journal',fenceKey+':complete'))?.value;
  if(preFence)assert(!denial&&!done,'COUNT_JOBLESS_PREFENCE_SPENT');
  else assert(denial?.schema==='sg-count-run-revoked-v1'&&denial.sourceRun===joblessCount.id+':1'&&denial.sourceCommit===joblessCount.commit&&denial.trialId===joblessCount.trialId&&denial.revisionHash===joblessCount.revisionHash&&denial.newBetAllowance===denial.sourceRequests&&denial.sourceRequests===0&&done?.schema==='sg-count-jobless-fence-complete-v1'&&done.denialHash===hash(denial)&&done.profileHash===denial.profileHash,'COUNT_JOBLESS_REVOCATION_REQUIRED');
  return {...value,total_count:value.total_count-1,workflow_runs:value.workflow_runs.filter(r=>r.id!==joblessCount.id)};
 };
}
