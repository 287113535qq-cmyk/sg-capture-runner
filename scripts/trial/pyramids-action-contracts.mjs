import assert from 'node:assert/strict';
import * as original from './pyramids-action-protocol.mjs';
import * as resumed from './pyramids-resume-action-protocol.mjs';
import * as direct from './pyramids-direct-action-protocol.mjs';
import * as veryfruity from './veryfruity-action-protocol.mjs';
// Selection never authorizes a plan. Independent on-disk admission remains mandatory.
export function actionContract(plan){
 if(plan?.featureProfile===veryfruity.ACTION_VERSION){
  assert(plan.gameId===32812&&plan.sourceKey===veryfruity.VERYFRUITY_SOURCE
   &&plan.actionContractHash===veryfruity.ACTION_CONTRACT_HASH,'ACTION_PROFILE_REQUIRED');
  return {version:veryfruity.ACTION_VERSION,hash:veryfruity.ACTION_CONTRACT_HASH,
   next:veryfruity.veryFruityActionNext,collectorKind:'veryFruityAction'};
 }
 const selected=plan?.featureProfile===original.ACTION_VERSION?original:plan?.featureProfile===direct.ACTION_VERSION?direct:plan?.featureProfile===resumed.ACTION_VERSION?resumed:null;
 if(!selected)return null;
 assert(plan.gameId===32721&&plan.actionContractHash===selected.ACTION_CONTRACT_HASH,'ACTION_PROFILE_REQUIRED');
 return {version:selected.ACTION_VERSION,hash:selected.ACTION_CONTRACT_HASH,next:selected.pyramidsActionNext,
  collectorKind:selected===original?'pyramidsAction':selected===direct?'pyramidsDirectAction':'pyramidsResumeAction'};
}
