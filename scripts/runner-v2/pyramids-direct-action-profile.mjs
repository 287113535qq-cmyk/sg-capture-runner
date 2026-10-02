export {RESUME_ACTION_PROFILE} from './pyramids-resume-action-profile.mjs';
import {pyramidsResumeActionPlan} from './pyramids-resume-action-profile.mjs';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/pyramids-direct-action-protocol.mjs';

export const ACTION_RESOURCE_BUDGET=Object.freeze({maxFrames:1026,maxRawBytes:4194304});
export const DIRECT_ACTION_PROFILE='formal-repair-pyramids-direct-action-20261002.json';
export const DIRECT_ACTION_CANARY=Object.freeze({captureMinutes:5,observationMinutes:5,maxWorkers:20,
 maxBatchesPerWorker:1,maxPaidPerWorker:100,maxPaidRequests:2000,lanesPerHost:1,
 automaticRelay:false,requiresNewSession:true});
// Independent authorization. The applied parent and its discarded attempts
// remain immutable; this plan inherits only its verified completed records.
export function pyramidsDirectActionPlan(base,p){
 if(p?.schema==='sg-formal-direct-action-profile-v2')return pyramidsResumeActionPlan(base,p);
 const required={schema:'sg-formal-direct-action-profile-v1',gameId:32721,group:'secondary',workerOffset:20,
  basePlanHash:hash(base),completePreserved:132846,remainingComplete:167004,historicalBaseline:150,
  totalTarget:300000,maxSequence:600000,sessionRotation:'closed-batches-v1',sourceAllowance:0,
  oldProfileHash:'d9ecf7db02603aab784d125c5a1721f5e9d62534f337f3846ad6d773e7281527',
  sourceRun:'36983664943:1',sourceCommit:'a4708c41fc9cf263cc1ca8849d2c4c8d9357e0b5',
  retirementKey:'count-shared-close:sg_r1_20260928_32721:36983664943:1:complete',
  retirementHash:'d4db796e229fcef91cccdc8325acf3fa0bb8f94b3ec260508252b8f2695fd720',
  nativeRetirementHash:'fd6e9bb3c75d077c0af84193ffa66cfb3eb9463bbeeeb2b135a1114d2709d0e0',
  closureProfileHash:'c37a373fbf4ee1e38b63f1d8051ff4786b6cc13e20521c50ea175ef7062f8658',
  recordsHash:'e7897eb2d190bd18222c0146fe24ae6c395f885ea76a87d5c176dba8cc7bd8e2',
  oldSpecHash:'e15d9b016f8ea3e183899779483b555b185ce70d49172c5811038c3c1006a111',
  controlReadMode:'compact-worker-v1',stateWriteMode:'versioned-delta-v1',
  gatewayHash:'a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',
  featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH,classificationMode:'independent-journal'};
 assert(base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0
  &&base.target===299850&&Object.entries(required).every(([k,v])=>p?.[k]===v)
  &&/^[a-f0-9]{64}$/.test(p.activation??'')&&hash(p.actionResourceBudget)===hash(ACTION_RESOURCE_BUDGET)
  &&hash(p.canary)===hash(DIRECT_ACTION_CANARY),'DIRECT_ACTION_SCOPE');
 const plan={...base,countAllocation:p.activation,featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH,
  maxSteps:ACTION_RESOURCE_BUDGET.maxFrames,actionResourceBudget:{...ACTION_RESOURCE_BUDGET}};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'DIRECT_ACTION_PLAN');return plan;
}
