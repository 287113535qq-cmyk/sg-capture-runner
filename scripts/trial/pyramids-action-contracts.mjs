import assert from 'node:assert/strict';
import * as original from './pyramids-action-protocol.mjs';
import * as direct from './pyramids-direct-action-protocol.mjs';
// Selection never authorizes a plan. Independent on-disk admission remains mandatory.
export function actionContract(plan){
 const selected=plan?.featureProfile===original.ACTION_VERSION?original:plan?.featureProfile===direct.ACTION_VERSION?direct:null;
 if(!selected)return null;
 assert(plan.gameId===32721&&plan.actionContractHash===selected.ACTION_CONTRACT_HASH,'ACTION_PROFILE_REQUIRED');
 return {version:selected.ACTION_VERSION,hash:selected.ACTION_CONTRACT_HASH,next:selected.pyramidsActionNext,
  collectorKind:selected===original?'pyramidsAction':'pyramidsDirectAction'};
}
