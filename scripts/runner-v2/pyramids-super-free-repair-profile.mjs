import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function pyramidsSuperFreeRepairPlan(base,p){
 assert(p?.schema==='sg-formal-repair-pyramids-v7'&&p.gameId===32721&&p.group==='secondary'&&p.workerOffset===20
  &&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0&&base.target===299850
  &&p.basePlanHash===hash(base)&&p.completePreserved===5713&&p.remainingComplete===294137&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash==='140025dee8b6f121c08e3f8b71d50c326db627c556529049ba850e64d249294f'
  &&p.sourceRun==='36946815410:1'&&p.sourceCommit==='72b02e1a85d9bcfa92e246dd3dbedffefa38568e'
  &&p.retirementKey==='count-parked-close:sg_r1_20260928_32721:36946815410:1:complete'
  &&p.controlReadMode==='compact-worker-v1'&&p.gatewayHash==='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
  &&p.recordsHash==='16db53f48d254a8ba850a3628859693ff4096dfeaeefac39f47833b3327be432'
  &&p.featureProfile==='pyramids-super-free-v1'&&p.stateWriteMode==='versioned-delta-v1'
  &&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_SUPER_FREE_REPAIR_SCOPE');
 const plan={...base,countAllocation:p.activation,featureProfile:p.featureProfile};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_SUPER_FREE_REPAIR_PLAN');return plan;
}
