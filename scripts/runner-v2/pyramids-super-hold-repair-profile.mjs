import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function pyramidsSuperHoldRepairPlan(base,p){
 assert(p?.schema==='sg-formal-repair-pyramids-v6'&&p.gameId===32721&&p.group==='secondary'&&p.workerOffset===20
  &&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0&&base.target===299850
  &&p.basePlanHash===hash(base)&&p.completePreserved===5111&&p.remainingComplete===294739&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash==='f9fe107deffc81d8ebc86a00d9819987001e599bfe115890e4705f3bc8eb82a8'
  &&p.sourceRun==='36941485498:1'&&p.sourceCommit==='6a9d39684e1433cbba1c361044f57c8ee25787d3'
  &&p.retirementKey==='count-shared-close:sg_r1_20260928_32721:36941485498:1:complete'
  &&p.controlReadMode==='compact-worker-v1'&&p.gatewayHash==='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
  &&p.recordsHash==='4fb9e24fb9ded80ff45904791293a52742aa2a063572f83529b83d5611675d6a'
  &&p.featureProfile==='pyramids-super-hold-cash-v1'&&p.stateWriteMode==='versioned-delta-v1'
  &&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_SUPER_HOLD_REPAIR_SCOPE');
 const plan={...base,countAllocation:p.activation,featureProfile:p.featureProfile};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_SUPER_HOLD_REPAIR_PLAN');return plan;
}
