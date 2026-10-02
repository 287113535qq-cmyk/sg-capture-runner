import assert from 'node:assert/strict';
import {protocolHash as hash} from '../runner-v2/protocol-resume.mjs';
import {PYRAMIDS_SOURCE} from './pyramids-hold-review.mjs';
import {reviewPyramidsFlow} from './pyramids-flow-review.mjs';
export const ACTION_VERSION='pyramids-action-v1';
export const EVIDENCE_VERSION='sg-round-evidence-v2';
export const ACTION_CONTRACT={schema:'sg-action-contract-v1',gameId:32721,
 sourceKey:PYRAMIDS_SOURCE,protocol:'nextgen',betRaw:20,version:ACTION_VERSION,
 clientHash:'fd11152a04daf94fa730bcdd4a4309085fb5a7d1aac93c7a1a8c055369942cfc',
 supportedActions:['BET','FREE_GAME'],classification:'independent-journal'};
export const ACTION_CONTRACT_HASH=hash(ACTION_CONTRACT);
export function actionScope(plan,raw){
 assert(plan.gameId===32721&&plan.sourceKey===PYRAMIDS_SOURCE&&plan.betRaw===20
  &&plan.featureProfile===ACTION_VERSION&&plan.actionContractHash===ACTION_CONTRACT_HASH,'ACTION_PROFILE_REQUIRED');
 assert(raw.requestFlowVersion===ACTION_VERSION&&raw.actionContractHash===ACTION_CONTRACT_HASH,'ACTION_RAW_CONTRACT_REQUIRED');
}
export function pyramidsActionNext(plan,raw){
 actionScope(plan,raw);
 if(Array.isArray(raw.steps)&&raw.steps.length===0){
  assert(Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=20,'ACTION_START_REQUIRED');return {MSGID:'BET'};
 }
 return reviewPyramidsFlow(plan,raw).next;
}
