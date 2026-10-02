import {pyramidsSuperHoldRepairPlan} from './pyramids-super-hold-repair-profile.mjs';
import {pyramidsFifteenRepairPlan} from './pyramids-fifteen-repair-profile.mjs';
import {pyramidsMajorRepairPlan} from './pyramids-major-repair-profile.mjs';
import {pyramidsMixedRepairPlan} from './pyramids-mixed-repair-profile.mjs';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {pyramidsSuperFreeRepairPlan} from './pyramids-super-free-repair-profile.mjs';
import {pyramidsRetriggerRepairPlan} from './pyramids-retrigger-repair-profile.mjs';
import {pyramidsCashCoinsRepairPlan} from './pyramids-cash-coins-repair-profile.mjs';
import {pyramidsSuperCoinsRepairPlan} from './pyramids-super-coins-repair-profile.mjs';
import {pyramidsActionRepairPlan} from './pyramids-action-repair-profile.mjs';
import {pyramidsActionBudgetPlan} from './pyramids-action-budget-profile.mjs';
import {pyramidsDirectActionPlan} from './pyramids-direct-action-profile.mjs';
export function pyramidsRepairPlan(base,p){
 if(['sg-formal-direct-action-profile-v1','sg-formal-direct-action-profile-v2'].includes(p?.schema))return pyramidsDirectActionPlan(base,p);
 if(p?.schema==='sg-formal-action-budget-profile-v1')return pyramidsActionBudgetPlan(base,p);
 if(p?.schema==='sg-formal-action-profile-v1')return pyramidsActionRepairPlan(base,p);
 if(p?.schema==='sg-formal-repair-pyramids-v10')return pyramidsSuperCoinsRepairPlan(base,p);
 if(p?.schema==='sg-formal-repair-pyramids-v9')return pyramidsCashCoinsRepairPlan(base,p);
 if(p?.schema==='sg-formal-repair-pyramids-v8')return pyramidsRetriggerRepairPlan(base,p);
 if(p?.schema==='sg-formal-repair-pyramids-v7')return pyramidsSuperFreeRepairPlan(base,p);
 if(p?.schema==='sg-formal-repair-pyramids-v6')return pyramidsSuperHoldRepairPlan(base,p);
 if(p?.schema==='sg-formal-repair-pyramids-v5')return pyramidsFifteenRepairPlan(base,p);
 if(p?.schema==='sg-formal-repair-pyramids-v4')return pyramidsMixedRepairPlan(base,p);
 if(p?.schema==='sg-formal-repair-pyramids-v3')return pyramidsMajorRepairPlan(base,p);
 const continuation=p?.sourceRun==='36842835455:1';
 const v2=p?.schema==='sg-formal-repair-pyramids-v2';
 assert((!continuation||v2)&&(v2||p?.schema==='sg-formal-repair-pyramids-v1')&&p.gameId===32721&&p.group==='secondary'
  &&p.workerOffset===20&&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'
  &&base.phase===1&&base.buy===0&&base.target===299850&&p.basePlanHash===hash(base)
  &&p.completePreserved===(continuation?2590:v2?2127:1658)&&p.remainingComplete===(continuation?297260:v2?297723:298192)&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash===(continuation?'ad341baba9491cb4ca804074fec940f1a85b12ea8df454eeacdddf4c6ff42e8b':v2?'93fef71918ebb6ad0d08e546b3ec13a2964b8493b8f860306e99564899808533':'989d114146fc85a759015ead8fa46c0f7d89c19d29f590ac849c9ff059ffdb9c')
  &&p.sourceRun===(continuation?'36842835455:1':v2?'36791455132:1':'36778619850:1')&&p.sourceCommit===(continuation?'819b429562e3c011305b2366e8ceac7354999dec':v2?'876797180569bb1134fd7cc6c6934dc347cd0cb1':'c3e172c9712084034ddd34d69ab51071d78cb1a4')
  &&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_REPAIR_PROFILE_SCOPE');
 const plan={...base,countAllocation:p.activation};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_REPAIR_PLAN_CHANGED');return plan;
}
