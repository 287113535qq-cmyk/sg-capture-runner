import assert from 'node:assert/strict';
import {closeInterruptedPilot,interruptedScene} from './demo-interrupted-close.mjs';
import {readClosedPilot} from './demo-pilot-close.mjs';
import {nextDemoGame} from './demo-next-game.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

// Maintenance only. Preparing the next independent, approved profile does not
// wait for adapter repair. Absence of such a profile cannot mint source quota.
// A later invocation can use a completed closure; incomplete stages refuse.
export async function advanceAgPilot({closeArgs,prepareNext=async()=>null}){
 const {store,plan,profile}=closeArgs,key=`closed-demo-pilot:${plan.trialId}:${plan.demoGeneration}`;
 let closed=(await store.get('journal',key+':complete'))?.value;
 if(closed){
  const s=await interruptedScene(store,plan);
  await readClosedPilot({store,plan,profile:{...profile,sourceClosureHash:hash(closed)},scene:{campaign:s.campaign,fromPool:s.pool,sourceBatches:s.batches}});
 }else closed=await closeInterruptedPilot(closeArgs);
 const nextArgs=await prepareNext({closed,repairKey:closed.repairKey});
 if(!nextArgs)return {action:'waiting-ready',repairKey:closed.repairKey,closed,sourceRequests:0,newBetAllowance:0};
 assert(nextArgs.store===store&&nextArgs.profile.fromGameId===plan.gameId&&nextArgs.profile.gameId!==plan.gameId
  &&nextArgs.profile.sourceGeneration===plan.demoGeneration&&nextArgs.profile.sourceClosureHash===hash(closed),'AG_NEXT_PROFILE_BINDING');
 const next=await nextDemoGame(nextArgs);
 return {action:'next-ready',repairKey:closed.repairKey,closed,next,sourceRequests:0,newBetAllowance:next.newBetAllowance};
}
