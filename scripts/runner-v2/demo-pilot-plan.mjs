import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
export function applyDemoPilot(plans,profile){
 const residual=profile.schema==='sg-demo-residual-pilot-v1',next=profile.schema==='sg-demo-next-game-v1';
 assert((next?Number.isInteger(profile.gameId)&&!!plans[profile.gameId]&&!!plans[profile.fromGameId]&&profile.gameId!==profile.fromGameId:
  (profile.schema==='sg-demo-pilot-v1'||residual)&&profile.gameId===32820&&profile.fromGameId===(residual?32820:32739))&&profile.perWorker===5&&profile.workers===20,'DEMO_PILOT_SCOPE');
 if(residual)assert(Array.isArray(profile.budgets)&&profile.budgets.length===20&&profile.budgets.every(n=>Number.isInteger(n)&&n>=0&&n<=5)&&profile.budgets.reduce((a,b)=>a+b,0)===profile.newBetAllowance&&profile.newBetAllowance+profile.usedBetAllowance===100&&profile.usedBetAllowance>0,'DEMO_RESIDUAL_SCOPE');
 else assert(profile.newBetAllowance===100,'DEMO_PILOT_SCOPE');
 const original=plans[profile.gameId];assert(hash(original)===profile.oldPlanHash&&/^[a-f0-9]{64}$/.test(profile.generation),'DEMO_PILOT_PLAN');
 const plan={...original,demoGeneration:profile.generation};assert(hash(plan)===profile.planHash,'DEMO_PILOT_PLAN');
 return {...plans,[profile.gameId]:plan};
}
