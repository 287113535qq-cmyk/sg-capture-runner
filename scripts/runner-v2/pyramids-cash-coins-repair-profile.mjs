import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function pyramidsCashCoinsRepairPlan(base,p){
 assert(p?.schema==='sg-formal-repair-pyramids-v9'&&p.gameId===32721&&p.group==='secondary'&&p.workerOffset===20
  &&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0&&base.target===299850
  &&p.basePlanHash===hash(base)&&p.completePreserved===7503&&p.remainingComplete===292347&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash==='9b5be7e5e018d9be4c7c09adda0dcac84bbae82c75e3d3c4d5c1fcc1b4982a34'
  &&p.sourceRun==='36955443358:1'&&p.sourceCommit==='3a4efb77f104cb23306b635ccfdddbd1daa5340d'
  &&p.retirementKey==='count-parked-close:sg_r1_20260928_32721:36955443358:1:complete'
  &&p.controlReadMode==='compact-worker-v1'&&p.gatewayHash==='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
  &&p.recordsHash==='11f76cc6db83acfc439ddb4cea67ed1e842fc2312db2d3ee03c6a1fc38cbe5f6'
  &&p.featureProfile==='pyramids-cash-coins-v1'&&p.stateWriteMode==='versioned-delta-v1'
  &&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_CASH_COINS_REPAIR_SCOPE');
 const plan={...base,countAllocation:p.activation,featureProfile:p.featureProfile};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_CASH_COINS_REPAIR_PLAN');return plan;
}
