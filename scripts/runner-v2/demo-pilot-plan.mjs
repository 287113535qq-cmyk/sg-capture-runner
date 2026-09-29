import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
export function applyDemoPilot(plans,profile){
 assert(profile.schema==='sg-demo-pilot-v1'&&profile.gameId===32820&&profile.fromGameId===32739&&profile.perWorker===5&&profile.workers===20&&profile.newBetAllowance===100,'DEMO_PILOT_SCOPE');
 const original=plans[profile.gameId];assert(hash(original)===profile.oldPlanHash&&/^[a-f0-9]{64}$/.test(profile.generation),'DEMO_PILOT_PLAN');
 const plan={...original,demoGeneration:profile.generation};assert(hash(plan)===profile.planHash,'DEMO_PILOT_PLAN');
 return {...plans,[profile.gameId]:plan};
}
