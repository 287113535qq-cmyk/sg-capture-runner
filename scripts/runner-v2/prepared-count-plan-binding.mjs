import fs from 'node:fs';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparedCountAuthorization} from './prepared-count-authorization.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';

// Lease checks and repair reviews must use the same immutable plan as capture.
// A native plan hash alone cannot authorize a different action contract.
export function bindPreparedCountPlan({base,activation,spec,
 read=file=>JSON.parse(fs.readFileSync(file,'utf8'))}){
 const legacy={...base,target:300000,countAllocation:activation};
 if(spec?.planHash===hash(legacy))return legacy;
 const registry=read('config/prepared-count-authorizations.json');
 assert(registry?.schema==='sg-prepared-count-authorizations-v1'&&registry.sourceAllowance===0,
  'LEASE_COUNT_SCOPE');
 const matches=Object.entries(registry.profiles??{}).filter(([,a])=>
  a.gameId===base.gameId&&a.activation===activation&&a.profileHash===spec?.profileHash);
 assert(matches.length===1,'LEASE_COUNT_SCOPE');
 const name=matches[0][0],authorization=preparedCountAuthorization(name,read),profile=read('config/'+name);
 assert(profile.group==='primary'&&hash(profile)===spec.profileHash&&spec.activation===activation,
  'LEASE_COUNT_SCOPE');
 const plan=preparedCountPlan(base,profile,authorization);
 assert(hash(plan)===spec.planHash,'LEASE_COUNT_SCOPE');return plan;
}
