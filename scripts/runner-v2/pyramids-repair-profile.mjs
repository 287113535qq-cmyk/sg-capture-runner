import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function pyramidsRepairPlan(base,p){
 assert(p?.schema==='sg-formal-repair-pyramids-v1'&&p.gameId===32721&&p.group==='secondary'
  &&p.workerOffset===20&&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'
  &&base.phase===1&&base.buy===0&&base.target===299850&&p.basePlanHash===hash(base)
  &&p.completePreserved===1658&&p.remainingComplete===298192&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash==='989d114146fc85a759015ead8fa46c0f7d89c19d29f590ac849c9ff059ffdb9c'
  &&p.sourceRun==='36778619850:1'&&p.sourceCommit==='c3e172c9712084034ddd34d69ab51071d78cb1a4'
  &&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_REPAIR_PROFILE_SCOPE');
 const plan={...base,countAllocation:p.activation};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_REPAIR_PLAN_CHANGED');return plan;
}
