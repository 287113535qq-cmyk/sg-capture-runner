import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function pyramidsRetriggerRepairPlan(base,p){
 assert(p?.schema==='sg-formal-repair-pyramids-v8'&&p.gameId===32721&&p.group==='secondary'&&p.workerOffset===20
  &&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0&&base.target===299850
  &&p.basePlanHash===hash(base)&&p.completePreserved===5787&&p.remainingComplete===294063&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash==='ea7929295dc8f5098b2d392262b563cf4158c87051987c8c71e62cd9b727fcf9'
  &&p.sourceRun==='36951574835:1'&&p.sourceCommit==='e2383403cb09d36c34aafcdbc49d9a1948831a06'
  &&p.retirementKey==='count-shared-close:sg_r1_20260928_32721:36951574835:1:complete'
  &&p.controlReadMode==='compact-worker-v1'&&p.gatewayHash==='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
  &&p.recordsHash==='656c64a4430f731a2afb31110756bb79a01988bb5602f7c6edb29d0b1dbb8433'
  &&p.featureProfile==='pyramids-ten-retrigger-v1'&&p.stateWriteMode==='versioned-delta-v1'
  &&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_RETRIGGER_REPAIR_SCOPE');
 const plan={...base,countAllocation:p.activation,featureProfile:p.featureProfile};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_RETRIGGER_REPAIR_PLAN');return plan;
}
