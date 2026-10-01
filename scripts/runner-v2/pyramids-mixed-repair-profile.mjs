import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function pyramidsMixedRepairPlan(base,p){
 assert(p?.schema==='sg-formal-repair-pyramids-v4'&&p.gameId===32721&&p.group==='secondary'&&p.workerOffset===20
  &&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0&&base.target===299850
  &&p.basePlanHash===hash(base)&&p.completePreserved===3627&&p.remainingComplete===296223&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash==='5c7278ed911ed73ca082e611e8556909704e979b9b6447d29591ec8f8cf6a411'
  &&p.sourceRun==='36860241790:1'&&p.sourceCommit==='d2d38028883eef3a609ba3209e19785857a54e56'
  &&p.retirementKey==='formal-stopped-retire:sg_r1_20260928_32721:23a2419605be82e9bf0b6c359a501bc47b0c2b1015e7b9de8ceb5d88c03f7c62:complete'
  &&p.featureProfile==='pyramids-free-hold-v1'&&p.stateWriteMode==='versioned-delta-v1'
  &&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_MIXED_REPAIR_SCOPE');
 const plan={...base,countAllocation:p.activation,featureProfile:p.featureProfile};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_MIXED_REPAIR_PLAN');return plan;
}
