import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// Opt-in only via a new plan AND its immutable complete-count activation.
// This cannot expand an existing applied profile through an environment variable.
export function sessionLayout(plan,spec){
 const layout=plan?.sessionLayout;
 if(layout===undefined){assert(spec?.sessionLayout===undefined,'SESSION_LAYOUT_PERMISSION');return null;}
 assert((plan.gameId===32795&&plan.adapter==='pearl-wms-v1'||plan.gameId===32799&&plan.adapter==='rhino-wms-v1')&&plan.phase===1&&plan.buy===0
  &&/^[a-f0-9]{64}$/.test(plan.countAllocation??'')&&!plan.demoGeneration
  &&layout?.schema==='sg-independent-sessions-v1'&&layout.group==='primary'
  &&layout.hosts===20&&[2,4].includes(layout.lanesPerHost)
  &&Object.keys(layout).sort().join(',')==='group,hosts,lanesPerHost,schema','SESSION_LAYOUT_SCOPE');
 if(spec!==undefined)assert(hash(spec.sessionLayout)===hash(layout),'SESSION_LAYOUT_PERMISSION');
 return layout;
}
export function sessionWorker(plan,host,group,lane=0){
 const layout=sessionLayout(plan);
 assert(['primary','secondary'].includes(group)&&Number.isInteger(host)&&host>=0&&host<20,'SESSION_HOST_SCOPE');
 assert(Number.isInteger(lane)&&lane>=0&&lane<(layout?.lanesPerHost??1),'SESSION_LANE_SCOPE');
 assert(!layout||layout.group===group,'SESSION_GROUP_SCOPE');
 return host+(group==='secondary'?20:0)+40*lane;
}
export function sessionWorkerAllowed(plan,worker,group){
 if(!Number.isInteger(worker)||worker<0)return false;
 const lane=Math.floor(worker/40),host=worker%40-(group==='secondary'?20:0);
 try{return sessionWorker(plan,host,group,lane)===worker;}catch{return false;}
}
