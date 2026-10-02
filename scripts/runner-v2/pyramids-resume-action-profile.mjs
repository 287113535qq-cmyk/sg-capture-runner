import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/pyramids-resume-action-protocol.mjs';
export const RESUME_ACTION_PROFILE='formal-repair-pyramids-resume-action-20261002.json';
export function pyramidsResumeActionPlan(base,p){
 const required={schema:'sg-formal-direct-action-profile-v2',gameId:32721,group:'secondary',workerOffset:20,
  basePlanHash:hash(base),completePreserved:143794,remainingComplete:156056,historicalBaseline:150,totalTarget:300000,
  maxSequence:600000,sessionRotation:'closed-batches-v1',sourceAllowance:0,
  oldProfileHash:'2bde56b5d7af4086256d3e3912630a1b6d137e751ab0ef34024ebb7b21d51f33',
  sourceRun:'37008008283:1',sourceCommit:'68c1632aa90ad3219ab3dc9d686caeb585c0677a',
  retirementKey:'count-shared-close:sg_r1_20260928_32721:37008008283:1:complete',
  closureProfileHash:'6b27d1953e56bfbcbc840ca130963190c63a62b926c3ecbfd39b40299a91ccc8',
  controlReadMode:'compact-worker-v1',stateWriteMode:'versioned-delta-v1',
  gatewayHash:'a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',
  featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH,classificationMode:'independent-journal'};
 assert(base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0&&base.target===299850
  &&Object.entries(required).every(([k,v])=>p?.[k]===v),'RESUME_ACTION_SCOPE');
 for(const k of ['activation','retirementHash','nativeRetirementHash','recordsHash','oldSpecHash'])assert(/^[a-f0-9]{64}$/.test(p[k]??''),'RESUME_ACTION_CLOSURE_BINDING');
 assert(hash(p.actionResourceBudget)===hash({maxFrames:1026,maxRawBytes:4194304})
  &&hash(p.canary)===hash({captureMinutes:5,observationMinutes:5,maxWorkers:20,maxBatchesPerWorker:1,
   maxPaidPerWorker:100,maxPaidRequests:2000,lanesPerHost:1,automaticRelay:false,requiresNewSession:true}),'RESUME_ACTION_RESOURCE');
 const plan={...base,countAllocation:p.activation,featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH,
  maxSteps:1026,actionResourceBudget:{maxFrames:1026,maxRawBytes:4194304}};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'RESUME_ACTION_PLAN');return plan;
}
