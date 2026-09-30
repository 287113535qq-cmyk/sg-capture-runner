import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

export function reviewPyramidsPilotJobs(jobs){
 assert(jobs.total_count===jobs.jobs.length&&jobs.total_count<100
  &&jobs.jobs.every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion)), 'PYRAMIDS_COUNT_SOURCE_JOBS');
 const capture=jobs.jobs.filter(j=>/^fresh-capture-(?:[0-9]|1[0-9])$/.test(j.name));
 assert(capture.length===20&&new Set(capture.map(j=>j.name)).size===20
  &&capture.every(j=>j.conclusion==='success')
  &&jobs.jobs.some(j=>j.name==='secondary-admit'&&j.conclusion==='success'), 'PYRAMIDS_COUNT_SOURCE_JOBS');
}

// Independent complete-count scope; this does not renew the spent 100 BET pilot.
export function pyramidsCountPlan(base, p){
 assert(p?.schema==='sg-formal-count-pyramids-v1'&&p.gameId===32721&&p.group==='secondary'&&p.workerOffset===20
  &&base?.trialId==='sg_r1_20260928_32721'&&base.gameId===32721&&base.target===299850&&base.buy===0&&base.phase===1
  &&p.basePlanHash===hash(base)&&p.completePreserved===1362&&p.remainingComplete===298488
  &&p.historicalBaseline===150&&p.totalTarget===300000&&p.maxSequence===600000
  &&p.sessionRotation==='closed-batches-v1'&&/^[a-f0-9]{64}$/.test(p.activation??'')
  &&p.sourceGeneration==='85eeac22df0369e166f1c1b31dd4f38a222aeb5910903ee59208800df54a3783'
  &&p.sourceProfileHash==='93d4cf52cdec03b69e48f078f2ce0fd014165bd0791efa620ae46ec0a8cea339'
  &&p.sourceRunKey==='capture-run:36774221164:1'&&/^[a-f0-9]{40}$/.test(p.sourceCommit??''),'PYRAMIDS_COUNT_PROFILE_SCOPE');
 const plan={...base,countAllocation:p.activation};
 assert(p.planHash===hash(plan)&&!plan.demoGeneration,'PYRAMIDS_COUNT_PLAN_CHANGED');return plan;
}
