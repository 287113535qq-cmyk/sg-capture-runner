import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/pyramids-action-protocol.mjs';
export function pyramidsActionRepairPlan(base,p){
 assert(p?.schema==='sg-formal-action-profile-v1'&&p.gameId===32721&&p.group==='secondary'&&p.workerOffset===20
  &&base?.gameId===32721&&base.trialId==='sg_r1_20260928_32721'&&base.phase===1&&base.buy===0&&base.target===299850
  &&p.basePlanHash===hash(base)&&p.completePreserved===16913&&p.remainingComplete===282937&&p.historicalBaseline===150
  &&p.totalTarget===300000&&p.maxSequence===600000&&p.sessionRotation==='closed-batches-v1'
  &&p.oldProfileHash==='758c973008b947c479c083b7eae4d1592fd23ae16022891162a17f1e015dc094'
  &&p.sourceRun==='36963756989:1'&&p.sourceCommit==='4c22abda58d86233776496c2d05942a9a4ef5a62'
  &&p.retirementKey==='count-shared-close:sg_r1_20260928_32721:36963756989:1:complete'
  &&p.retirementHash==='cf8acdd48080eb818de3afc2a3ccdf4667e91f90c1b65b0a918ee1360d4b1517'
  &&p.recordsHash==='493099eb67e9e5ef20346762ba3098707adda51460a4e6f4dbc256a62cc091e4'
  &&p.controlReadMode==='compact-worker-v1'&&p.stateWriteMode==='versioned-delta-v1'
  &&p.gatewayHash==='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e'
  &&p.featureProfile===ACTION_VERSION&&p.actionContractHash===ACTION_CONTRACT_HASH
  &&p.classificationMode==='independent-journal'&&/^[a-f0-9]{64}$/.test(p.activation??''),'PYRAMIDS_ACTION_REPAIR_SCOPE');
 const plan={...base,countAllocation:p.activation,featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH};
 assert(hash(plan)===p.planHash&&!plan.demoGeneration&&!plan.sessionLayout,'PYRAMIDS_ACTION_REPAIR_PLAN');return plan;
}
