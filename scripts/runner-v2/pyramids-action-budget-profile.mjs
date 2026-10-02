import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/pyramids-action-protocol.mjs';

export const ACTION_RESOURCE_BUDGET=Object.freeze({maxFrames:1026,maxRawBytes:4194304});
// Independent authorization. The applied parent and its discarded attempts
// remain immutable; this plan inherits only its verified completed records.
export function pyramidsActionBudgetPlan(base,p){
 const required={schema:'sg-formal-action-budget-profile-v1',gameId:32721,group:'secondary',workerOffset:20,
  basePlanHash:hash(base),completePreserved:49593,remainingComplete:250257,historicalBaseline:150,
  totalTarget:300000,maxSequence:600000,sessionRotation:'closed-batches-v1',sourceAllowance:0,
  oldProfileHash:'c86e5cb9a5c68b9952497503accbdd107c3f89d86395063513c77914b377355b',
  sourceRun:'36973608232:1',sourceCommit:'9aafef9ac94300c02ce74bb83db7eb97dfcef00d',
  retirementKey:'count-shared-close:sg_r1_20260928_32721:36973608232:1:complete',
  retirementHash:'25ca1a912e0c94f80ca4bf2ba735f442302441da92345e1dadd9bac90397a32a',
  nativeRetirementHash:'7f6ab90a6fab39b0e7c045fecaf0201b6550b09b4d4ce0cc65af6fdcee63516e',
  closureProfileHash:'796e445b4dd8f20e1e8c7500d01d9c899b725526781ba7f809842eff48c39468',
  recordsHash:'e448065b7a853be8a0f9fa269ca367858945453b5c14b1f9af277dc4b7f05cc7',
  oldSpecHash:'21e39490c85e4653474db892a6485cf21ad9865ef08ea65afdffbf36823d8307',
  controlReadMode:'compact-worker-v1',stateWriteMode:'versioned-delta-v1',
  gatewayHash:'a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',
  featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH,classificationMode:'independent-journal'};
 assert(base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0
  &&base.target===299850&&Object.entries(required).every(([k,v])=>p?.[k]===v)
  &&/^[a-f0-9]{64}$/.test(p.activation??'')&&hash(p.actionResourceBudget)===hash(ACTION_RESOURCE_BUDGET),'ACTION_BUDGET_SCOPE');
 const plan={...base,countAllocation:p.activation,featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH,
  maxSteps:ACTION_RESOURCE_BUDGET.maxFrames,actionResourceBudget:{...ACTION_RESOURCE_BUDGET}};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'ACTION_BUDGET_PLAN');return plan;
}
