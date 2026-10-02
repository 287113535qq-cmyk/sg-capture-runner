import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function pyramidsSuperCoinsRepairPlan(base,p){
 assert(p?.schema==='sg-formal-repair-pyramids-v10'&&p.gameId===32721&&p.group==='secondary'&&p.workerOffset===20
  &&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0&&base.target===299850
  &&p.basePlanHash===hash(base)&&p.completePreserved===8391&&p.remainingComplete===291459&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash==='8f387e5caf6a563cb10cab7fc62f657ed4af3eaae280844f3cf1a8297ff90f0d'
  &&p.sourceRun==='36961087858:1'&&p.sourceCommit==='dd058f848725f776ae7d8eb1e37b31a2000d9b20'
  &&p.retirementKey==='count-parked-close:sg_r1_20260928_32721:36961087858:1:complete'
  &&p.controlReadMode==='compact-worker-v1'&&p.gatewayHash==='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
  &&p.recordsHash==='f776cc0581b6e43c96d72987a1ceaf56ec24470933566cbb44229fdb284bbef1'
  &&p.featureProfile==='pyramids-super-cash-coins-v1'&&p.stateWriteMode==='versioned-delta-v1'
  &&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_SUPER_COINS_REPAIR_SCOPE');
 const plan={...base,countAllocation:p.activation,featureProfile:p.featureProfile};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_SUPER_COINS_REPAIR_PLAN');return plan;
}
