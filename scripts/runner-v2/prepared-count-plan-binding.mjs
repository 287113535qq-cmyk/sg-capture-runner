import fs from 'node:fs';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparedCountAuthorization} from './prepared-count-authorization.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';

// Lease checks and repair reviews must use the same immutable plan as capture.
// A native plan hash alone cannot authorize a different action contract.
const readLocal=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function bindingName({base,activation,spec},registry){
 assert(registry?.schema==='sg-prepared-count-authorizations-v1'&&registry.sourceAllowance===0,
  'LEASE_COUNT_SCOPE');
 const matches=Object.entries(registry.profiles??{}).filter(([,a])=>
  a.gameId===base.gameId&&a.activation===activation&&a.profileHash===spec?.profileHash);
 assert(matches.length===1,'LEASE_COUNT_SCOPE');
 return matches[0][0];
}
export function bindPreparedCountPlan({base,activation,spec,read=readLocal}){
 const legacy={...base,target:300000,countAllocation:activation};
 if(spec?.planHash===hash(legacy))return legacy;
 const name=bindingName({base,activation,spec},read('config/prepared-count-authorizations.json'));
 const authorization=preparedCountAuthorization(name,read),profile=read('config/'+name);
 assert(profile.group==='primary'&&hash(profile)===spec.profileHash&&spec.activation===activation,
  'LEASE_COUNT_SCOPE');
 const plan=preparedCountPlan(base,profile,authorization);
 assert(hash(plan)===spec.planHash,'LEASE_COUNT_SCOPE');return plan;
}

// Evidence readers may be asynchronous. Resolve the two immutable local inputs
// before applying the same binding checks used by synchronous lease review.
export async function bindPreparedCountPlanAsync({base,activation,spec,read=readLocal}){
 const legacy={...base,target:300000,countAllocation:activation};
 if(spec?.planHash===hash(legacy))return legacy;
 const registry=await read('config/prepared-count-authorizations.json');
 const name=bindingName({base,activation,spec},registry),profile=await read('config/'+name);
 return bindPreparedCountPlan({base,activation,spec,
  read:file=>file==='config/prepared-count-authorizations.json'?registry:profile});
}

// Historical analysis resolves a captured receipt against registered immutable
// profiles. Its plan hash never grants a new capture allowance or run permit.
export function bindPreparedPlanHash({base,planHash,read=readLocal}){
 const registry=read('config/prepared-count-authorizations.json'),matches=[];
 assert(registry?.schema==='sg-prepared-count-authorizations-v1'&&registry.sourceAllowance===0,'CAPTURE_PLAN_SCOPE');
 for(const [name,entry]of Object.entries(registry.profiles??{})){
  if(entry.gameId!==base.gameId)continue;
  const authorization=preparedCountAuthorization(name,read),profile=read('config/'+name);
  if(profile.planHash!==planHash)continue;
  const plan=preparedCountPlan(base,profile,authorization);
  assert(hash(plan)===planHash,'CAPTURE_PLAN_CHANGED');matches.push(plan);
 }
 assert(matches.length===1,'CAPTURE_PLAN_UNREGISTERED');return matches[0];
}
