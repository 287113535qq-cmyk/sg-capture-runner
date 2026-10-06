import assert from 'node:assert/strict';

export const SG_AG_GAME_BUDGET_MS=30*60*1000;
const exhausted=()=>Object.assign(new Error('SG_AG_GAME_BUDGET_EXHAUSTED'),{code:'SG_AG_GAME_BUDGET_EXHAUSTED'});

// A cooperative per-game deadline, checked only between awaited operations.
// No timer races a database write; AG's existing per-game catch advances to
// the next game only after the blocked state has a durable full readback.
export function createGameBudget({state,persist,flush,now=Date.now}){
 assert(Array.isArray(state?.games)&&typeof persist==='function'&&typeof flush==='function'&&typeof now==='function','SG_AG_GAME_BUDGET_PORTS');
 let poison;
 async function save(){
  try{
   const receipt=persist('own-control-state',structuredClone(state));
   assert(!receipt?.then&&receipt?.fullReadback===true,'SG_AG_GAME_BUDGET_LOCAL_READBACK');
   await flush();
  }catch(cause){
   poison=Object.assign(new Error('SG_AG_GAME_BUDGET_PERSIST_UNKNOWN',{cause}),{code:'SG_AG_GAME_BUDGET_PERSIST_UNKNOWN',outcomeUnknown:true});
   throw poison;
  }
 }
 return {async check(phase,g){
  if(poison)throw poison;
  assert(typeof phase==='string','SG_AG_GAME_BUDGET_PHASE');
  // Ended-node settlement belongs to cohort lifecycle, not business delivery.
  if(!g||phase.startsWith('settle-ended'))return;
  assert(state.games.includes(g),'SG_AG_GAME_BUDGET_GAME_SCOPE');
  if(g.phase==='complete')return;
  if(g.phase==='blocked'){
   if(g.reason==='SG_AG_GAME_BUDGET_EXHAUSTED')throw exhausted();
   throw Object.assign(new Error('SG_AG_GAME_ALREADY_BLOCKED'),{code:'SG_AG_GAME_ALREADY_BLOCKED'});
  }
  if(!g.sgGameBudget){
   if(phase!=='full-prefix-validation')return;
   const startedAt=now();assert(Number.isSafeInteger(startedAt)&&startedAt>=0,'SG_AG_GAME_BUDGET_CLOCK');
   g.sgGameBudget={schema:'sg-ag-game-budget-v1',startedAt,deadlineAt:startedAt+SG_AG_GAME_BUDGET_MS};
   await save();
  }
  const budget=g.sgGameBudget,at=now();
  assert(budget.schema==='sg-ag-game-budget-v1'&&Number.isSafeInteger(budget.startedAt)&&budget.startedAt>=0
   &&Number.isSafeInteger(budget.deadlineAt)&&budget.deadlineAt-budget.startedAt===SG_AG_GAME_BUDGET_MS
   &&Number.isSafeInteger(at)&&at>=budget.startedAt,'SG_AG_GAME_BUDGET_STATE');
  if(at<budget.deadlineAt)return;
  const stoppedGamePhase=g.phase;
  g.phase='blocked';g.reason='SG_AG_GAME_BUDGET_EXHAUSTED';
  g.sgGameBudget={...budget,exhaustedAt:at,stoppedPhase:phase,stoppedGamePhase};
  await save();throw exhausted();
 }};
}
