import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function pyramidsFifteenRepairPlan(base,p){
 assert(p?.schema==='sg-formal-repair-pyramids-v5'&&p.gameId===32721&&p.group==='secondary'&&p.workerOffset===20
  &&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0&&base.target===299850
  &&p.basePlanHash===hash(base)&&p.completePreserved===5024&&p.remainingComplete===294826&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash==='f32e340466c2c02d725b93e87a92a493f013157275f6ea7ff699d47712ee8892'
  &&p.sourceRun==='36937673870:1'&&p.sourceCommit==='a66e2c7ac642c87ecedbbe9ddde5194bcae4de36'
  &&p.retirementKey==='count-shared-close:sg_r1_20260928_32721:36937673870:1:complete'
  &&p.controlReadMode==='compact-worker-v1'&&p.gatewayHash==='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
  &&p.recordsHash==='a030ea2977061f63db69493a19fd09233fff9b784d49cf5b8ca448f3206c45aa'
  &&p.featureProfile==='pyramids-fifteen-free-v1'&&p.stateWriteMode==='versioned-delta-v1'
  &&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_FIFTEEN_REPAIR_SCOPE');
 const plan={...base,countAllocation:p.activation,featureProfile:p.featureProfile};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_FIFTEEN_REPAIR_PLAN');return plan;
}
