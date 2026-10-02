import assert from 'node:assert/strict';
import {pyramidsActionRepairPlan} from './pyramids-action-repair-profile.mjs';
import {pyramidsDirectActionPlan,DIRECT_ACTION_PROFILE,RESUME_ACTION_PROFILE} from './pyramids-direct-action-profile.mjs';
import {DIRECT_ACTION_RELAY_RUNTIME,RESUME_ACTION_RELAY_RUNTIME,RESUME_ACTION_CONTINUOUS_RUNTIME,RESUME_ACTION_NETWORK_RUNTIME} from './action-direct-relay-runtime.mjs';
import {ACTION_CANARY_RUNTIME} from './action-canary-contract.mjs';
import {ACTION_CONTINUOUS_RUNTIME} from './action-continuous-runtime.mjs';
export function actionAnalysisPlan({base,profile,name,runtimeName}){
 const old=name==='formal-repair-pyramids-action-20261002.json',direct=name===DIRECT_ACTION_PROFILE,resumed=name===RESUME_ACTION_PROFILE;
 assert(old||direct||resumed,'ACTION_ANALYSIS_PROFILE');
 const allowed=old?[ACTION_CANARY_RUNTIME,ACTION_CONTINUOUS_RUNTIME]:(resumed?[RESUME_ACTION_RELAY_RUNTIME,RESUME_ACTION_CONTINUOUS_RUNTIME,RESUME_ACTION_NETWORK_RUNTIME]:[DIRECT_ACTION_RELAY_RUNTIME]);
 assert(!runtimeName||allowed.includes(runtimeName),'ACTION_ANALYSIS_RUNTIME_SCOPE');
 return (old?pyramidsActionRepairPlan:pyramidsDirectActionPlan)(base,profile);
}
