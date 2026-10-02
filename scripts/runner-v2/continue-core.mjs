import assert from 'node:assert/strict';

export async function continueAfterGame({store,transport,runId,attempt,github,preparedSelector=null,group,now=Date.now}){
  assert(/^[0-9]+$/.test(runId) && /^[0-9]+$/.test(attempt));
  const c=(await store.get('state','campaign'))?.value;
  const bound=(await store.get('state',`capture-run:${runId}:${attempt}`))?.value;
  const holds=await transport.request('global_holds');
  if(!c?.enabled || c.validationLimit || holds.length!==2 || holds.some(x=>!x||x.value.active))return {continued:false,reason:'CONTROL_PAUSED'};
  const finished=c.games.find(g=>g.game_id===bound?.gameId);
  if(!finished || !['complete','parked-protocol'].includes(finished.status))return {continued:false,reason:'GAME_NOT_FINISHED'};
  if(!c.games.some(g=>g.status==='ready'||g.status==='active'))return {continued:false,reason:'NO_READY_GAMES'};
  let preparedGame;
  if(preparedSelector){
    preparedGame=await preparedSelector({group,readyGameIds:c.games.filter(g=>['ready','active'].includes(g.status)).map(g=>g.game_id)});
    if(preparedGame===null)return {continued:false,reason:'PREPARED_INVENTORY_EMPTY'};
    assert(c.games.some(g=>g.game_id===preparedGame&&['ready','active'].includes(g.status)),'CONTINUATION_GAME_NOT_ADMITTED');
  }
  if(await github.hasOtherRun())return {continued:false,reason:'CONTINUATION_ALREADY_QUEUED'};
  await store.writable();
  const intent=await transport.request('create',{collection:'journal',key:`continuation:${runId}:${attempt}`,
    value:{finishedGame:bound.gameId,requestedAt:now(),runId,attempt,...(preparedSelector?{preparedGame}:{})}});
  if(!intent.created)return {continued:false,reason:'DISPATCH_ALREADY_ATTEMPTED'};
  // An unknown dispatch acknowledgement is never blindly retried. The existing
  // schedule can continue after its normal check and per-repository concurrency.
  await github.dispatch();
  return {continued:true,finishedGame:bound.gameId};
}
