import assert from 'node:assert/strict';
import {original} from './expired-run-review.mjs';
import {stalled,revokedMarker} from './demo-run-fence.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {readParentTailFailure,checkParentTailFailure} from './parent-tail-failure.mjs';
export const parallelPrimary=Object.freeze({repository:'zyzuoyang/sg-capture-runner',id:36753473985,commit:'5c513a6f55dfaccfc0e5e8f13b30ab7c3ab18c7a',gameId:32795,trialId:'sg_r1_20260930_32795',activation:'3ae07c69f6e136c49c01296472b7dda6fbce5dab04e68d25e34914d331be4e8f',profileHash:'22bbf03bc897b793f4e67cf6417be6277216f5e01ba912024f49336e4080982e'});
export const observationPrimary=Object.freeze({...parallelPrimary,id:36782298458,commit:'6ee2a619acc11702211b130563a5625be5806a54',operation:'parallel_primary_observation_boundary'});
export const rhinoTwoPrimary=Object.freeze({repository:'zyzuoyang/sg-capture-runner',id:36835017232,commit:'47f2a64680d021e244f8fe8f4500edd9c6742458',gameId:32799,trialId:'sg_r1_20261001_32799',activation:'891db4a4e7a4313b985c3310f8783a7300d3c8aaf1cba458f8a75e0871af71f5',profileHash:'19ac6545a091eb5b79f4d8d075ae5c78e58883309f39373f80237c20e0b588f3',operation:'parallel_primary_rhino_two_boundary'});
export const secondaryRepository='287113535qq-cmyk/sg-capture-runner';
function identity(r,repository,id,commit,path,status,conclusion=status==='completed'?'success':null){
 assert(r?.id===id&&r.run_attempt===1&&r.repository?.full_name===repository&&r.head_sha===commit
  &&r.path===path&&r.event==='workflow_dispatch'&&r.status===status&&r.conclusion===conclusion,'PARALLEL_RUN_IDENTITY_CHANGED');
}
export function checkPrimaryReadonlyEvidence(evidence,now=Date.now(),primaryRun=parallelPrimary,parentTailFailure){
 const p=primaryRun;
 const rhino=p===rhinoTwoPrimary;
 assert(Array.isArray(evidence?.state)&&evidence.state.length===3&&Array.isArray(evidence.journal)&&evidence.journal.length===(rhino?1:0),'PARALLEL_PRIMARY_EVIDENCE_MISSING');
 if(rhino){const doc=evidence.journal[0],v=doc.value;assert(doc._id===`primary/count-run:${p.trialId}:${p.id}:1`&&v.schema==='sg-count-run-v1'&&v.activation===p.activation&&v.profileHash===p.profileHash&&v.commit===p.commit&&v.run===p.id+':1','PARALLEL_PRIMARY_PERMISSION');}
 const ids=[`primary/campaign`,`primary/pool:${p.trialId}`,`primary/capture-run:${p.id}:1`];
 assert(new Set(evidence.state.map(d=>d._id)).size===3&&evidence.state.every(d=>ids.includes(d._id)),'PARALLEL_PRIMARY_EVIDENCE_SCOPE');
 const [c,pool,bound]=ids.map(id=>evidence.state.find(d=>d._id===id).value);
 if(parentTailFailure)assert(rhino&&pool.confirmed===18694&&pool.countAllocation?.reserved===0
  &&evidence.journal[0].value.completeBefore+parentTailFailure.childComplete===pool.confirmed
  &&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now),'PARALLEL_PARENT_FAILURE_UNSETTLED');
 assert(c.group==='primary'&&c.enabled&&c.activeGame===p.gameId&&!c.protocolValidation&&c.validationLimit===0
  &&c.formalCount?.activation===p.activation&&c.formalCount.profileHash===p.profileHash&&c.formalCount.trialId===p.trialId
  &&hash(c.demoRunRevoked)===hash(revokedMarker)&&bound.gameId===p.gameId
  &&pool.enabled&&!pool.failure&&pool.countAllocation&&Object.keys(pool.workers).length<=(rhino?40:20)
  &&Object.entries(pool.workers).every(([w,v])=>/^(?:[0-9]|1[0-9])$/.test(w)||(rhino&&/^(?:4[0-9]|5[0-9])$/.test(w)))
  &&Object.entries(pool.workers).every(([w,v])=>
   Number.isFinite(v.leaseUntil)&&(v.leaseUntil<=now||v.owner?.startsWith(p.id+':1:formal-capture:'))),'PARALLEL_PRIMARY_STATE_CHANGED');
}
// Only this independently identified healthy primary run may coexist. No ignore list.
export function secondaryParallelBoundary({read,transport,run,commit,workflowPath='.github/workflows/demo-maintenance.yml',now=Date.now,primaryRun=parallelPrimary,allowEndedPrimary=false,readTailProof=readParentTailFailure}){
 assert(primaryRun===parallelPrimary||primaryRun===observationPrimary||primaryRun===rhinoTwoPrimary,'PARALLEL_REVIEWED_RUN_REQUIRED');
 assert(!allowEndedPrimary||primaryRun===rhinoTwoPrimary,'PARALLEL_ENDED_SCOPE');
 assert(/^\d+:1$/.test(run)&&/^[a-f0-9]{40}$/.test(commit)
  &&['.github/workflows/demo-maintenance.yml','.github/workflows/trial-300k.yml'].includes(workflowPath),'PARALLEL_SELF_SCOPE');
 const id=Number(run.split(':')[0]),repos=[primaryRun.repository,secondaryRepository];
 let cachedTailProof;
 return async()=>{
  let parentTailFailure;
  const started=now();
  const queries=repos.flatMap(repository=>['in_progress','queued','pending','waiting','requested'].map(status=>({repository,status})));
  for(let n=0;n<queries.length;n+=5){const wave=queries.slice(n,n+5),results=await Promise.allSettled(wave.map(q=>read(`repos/${q.repository}/actions/runs?status=${q.status}&per_page=100`)));
   for(let i=0;i<results.length;i++){assert(results[i].status==='fulfilled','PARALLEL_LIST_READ_FAILED');const r=results[i].value,q=wave[i];
    assert(Number.isInteger(r.total_count)&&r.total_count<100&&Array.isArray(r.workflow_runs)&&r.workflow_runs.length===r.total_count,'GITHUB_RUN_LIST_TRUNCATED');
    for(const item of r.workflow_runs){const primary=q.repository===primaryRun.repository;
     const expected=primary?[primaryRun,original,stalled].find(x=>x.id===item.id):item.id===id?{commit}:null;
     assert(expected&&item.head_sha===expected.commit&&item.run_attempt===1
      &&item.path===(primary?'.github/workflows/trial-300k.yml':workflowPath)
      &&q.status===(primary&&item.id!==primaryRun.id?'queued':'in_progress'),'OTHER_RUN_ACTIVE');
    }
   }
  }
  const refs=[{repository:secondaryRepository,id,commit,path:workflowPath,status:'in_progress'},
   {...primaryRun,path:'.github/workflows/trial-300k.yml',status:'in_progress'},
   ...[original,stalled].map(x=>({...x,path:'.github/workflows/trial-300k.yml',status:'queued'}))];
  for(const ref of refs){const r=await read(`repos/${ref.repository}/actions/runs/${ref.id}`),status=allowEndedPrimary&&ref.id===primaryRun.id&&r.status==='completed'?'completed':ref.status;
   const tailCandidate=allowEndedPrimary&&ref.id===primaryRun.id&&status==='completed'&&r.conclusion==='failure';
   identity(r,ref.repository,ref.id,ref.commit,ref.path,status,tailCandidate?'failure':status==='completed'?'success':null);
   if(ref.id===id)continue;
   const jobs=await read(`repos/${ref.repository}/actions/runs/${ref.id}/jobs?filter=all&per_page=100`);
   assert(Array.isArray(jobs.jobs)&&Number.isInteger(jobs.total_count)&&jobs.total_count<100&&jobs.jobs.length===jobs.total_count,'PARALLEL_JOBS_TRUNCATED');
   if(ref.id!==primaryRun.id)assert(jobs.total_count===0,'OLD_JOB_EXISTS');
   else if(tailCandidate){cachedTailProof??=readTailProof(r,jobs);parentTailFailure=checkParentTailFailure({ended:r,jobs,evidence:cachedTailProof});}
   else {const captures=jobs.jobs.filter(j=>/^capture-(?:[0-9]|1[0-9])$/.test(j.name));
    assert(captures.length===20&&new Set(captures.map(j=>j.name)).size===20
     &&(status!=='completed'||captures.every(j=>j.status==='completed'&&j.conclusion==='success'))
     &&captures.every(j=>['in_progress','completed'].includes(j.status)&&(j.status!=='completed'||j.conclusion==='success'))
     &&jobs.jobs.some(j=>j.name==='formal-admit'&&j.status==='completed'&&j.conclusion==='success')
     &&jobs.jobs.filter(j=>!captures.includes(j)).every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion)), 'PARALLEL_PRIMARY_JOBS_CHANGED');
   }
  }
  checkPrimaryReadonlyEvidence(await transport.request(primaryRun.operation??'parallel_primary_boundary'),now(),primaryRun,parentTailFailure);
  const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(h=>h?.value?.active===false),'GLOBAL_HOLD');
  assert(now()-started<=30000,'GITHUB_EVIDENCE_STALE');
 };
}
