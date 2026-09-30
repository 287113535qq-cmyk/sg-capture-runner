import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {githubBoundary} from './github-boundary.mjs';
export const stalled=Object.freeze({id:36612306276,repository:'zyzuoyang/sg-capture-runner',commit:'c433f74c5ef4bda1cbe3cbde9ec17fffe0122b44',profileHash:'9a4d0db5fa18564d9cee14c1b6c7891217b23dd77027d5c656b9328831deee22',generation:'53448c2a8f711899004d05c065f947cd8fb737f9da8152f69ccd7f4da7d53ed2'});
export const revokedMarker=Object.freeze({schema:'sg-demo-run-revoked-v1',run:stalled.id+':1',commit:stalled.commit,profileHash:stalled.profileHash});
export function maintenanceBoundary({read,store,oldProfile,run,commit,now=Date.now,workflowPath='.github/workflows/demo-maintenance.yml'}){
 assert(['.github/workflows/demo-maintenance.yml','.github/workflows/trial-300k.yml'].includes(workflowPath),'CURRENT_WORKFLOW_CHANGED');
 assert(hash(oldProfile)===stalled.profileHash&&run!==stalled.id+':1'&&commit!==stalled.commit,'FENCE_BINDING_CHANGED');
 const key='demo-generation:sg_r1_20260928_32820:'+stalled.generation;
 const review=async()=>{
  const self=await read(`repos/${stalled.repository}/actions/runs/${run.split(':')[0]}`);
  assert(self.id===Number(run.split(':')[0])&&self.run_attempt===1&&self.head_sha===commit&&self.status==='in_progress'&&self.path===workflowPath&&self.repository?.full_name===stalled.repository,'MAINTENANCE_NOT_ACTIVE');
  const r=await read(`repos/${stalled.repository}/actions/runs/${stalled.id}`),jobs=await read(`repos/${stalled.repository}/actions/runs/${stalled.id}/jobs?filter=all&per_page=100`);
  assert(r.id===stalled.id&&r.run_attempt===1&&r.head_sha===stalled.commit&&r.repository?.full_name===stalled.repository&&r.event==='workflow_dispatch'&&r.path==='.github/workflows/trial-300k.yml'&&r.status==='queued'&&r.conclusion===null,'STALLED_RUN_CHANGED');
  assert(jobs.total_count===0&&Array.isArray(jobs.jobs)&&jobs.jobs.length===0,'STALLED_JOB_EXISTS');
  const rows=await store.getMany('journal',[key,key+':before',key+':complete',key+':parked-source']);assert(rows.length===4&&rows.every(r=>r===null),'STALLED_HAS_WRITES');
 };
 const filtered=async path=>{
  const r=await read(path);
  if(!path.startsWith(`repos/${stalled.repository}/actions/runs?`))return r;
  assert(Number.isInteger(r.total_count)&&r.total_count<100&&Array.isArray(r.workflow_runs)&&r.workflow_runs.length===r.total_count,'GITHUB_RUN_LIST_TRUNCATED');
  const found=r.workflow_runs.filter(x=>x.id===stalled.id);assert(found.length<=1,'STALLED_DUPLICATE');
  if(found.length)assert(path.includes('status=queued')&&found[0].head_sha===stalled.commit&&found[0].run_attempt===1&&found[0].path==='.github/workflows/trial-300k.yml','STALLED_LIST_CHANGED');
  return {...r,total_count:r.total_count-found.length,workflow_runs:r.workflow_runs.filter(x=>x.id!==stalled.id)};
 };
 const base=githubBoundary({read:filtered,run,commit,now,workflowPath});
 return async()=>{const start=now();await review();await base();await review();assert(now()-start<=30000,'GITHUB_EVIDENCE_STALE');};
}
// Only changes a campaign fence. Completed data, sessions and quota are untouched.
// While this authenticated maintenance is active, the old boundary rejects it.
// Afterwards this marker makes the old immutable snapshot binding fail.
export async function revokeQueuedDemo({store,boundary,expectedCampaignHash,commit,run,now=Date.now}){
 const key='demo-run-revoked:'+stalled.id;
 await boundary();assert(!await store.get('journal',key+':before'),'FENCE_ALREADY_STARTED');
 const before=await store.get('state','campaign');assert(before&&hash(before.value)===expectedCampaignHash&&!before.value.demoRunRevoked,'FENCE_CAMPAIGN_CHANGED');
 await store.create('journal',key+':before',{campaign:before.value,marker:revokedMarker,commit,run,at:now()},{immutable:true});
 await boundary();const after=await store.cas('state','campaign',before,{...before.value,demoRunRevoked:revokedMarker});assert(after,'FENCE_CAS_CONFLICT');
 const actual=await store.get('state','campaign');assert(hash(actual.value)===hash({...before.value,demoRunRevoked:revokedMarker}),'FENCE_READBACK');
 const result={schema:'sg-demo-run-revoked-complete-v1',marker:revokedMarker,beforeHash:hash(before.value),afterHash:hash(actual.value),commit,run,at:now(),sourceRequests:0};
 await store.create('journal',key+':complete',result,{immutable:true});return result;
}
