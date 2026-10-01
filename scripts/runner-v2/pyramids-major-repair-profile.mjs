import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function pyramidsMajorRepairPlan(base,p){
 assert(p?.schema==='sg-formal-repair-pyramids-v3'&&p.gameId===32721&&p.group==='secondary'&&p.workerOffset===20
  &&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0&&base.target===299850
  &&p.basePlanHash===hash(base)&&p.completePreserved===3211&&p.remainingComplete===296639&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash==='1c7f256253480053168458a38b49e133a76240448416f7689b14753f439c7552'
  &&p.sourceRun==='36848037333:1'&&p.sourceCommit==='4c13485557529aba9dc7657487e7d9b75634f2b4'
  &&p.retirementKey==='count-shared-close:sg_r1_20260928_32721:36848037333:1:complete'
  &&p.featureProfile==='pyramids-free-major-v1'&&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_MAJOR_REPAIR_SCOPE');
 const plan={...base,countAllocation:p.activation};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_MAJOR_REPAIR_PLAN');return plan;
}
