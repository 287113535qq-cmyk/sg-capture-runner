import assert from 'node:assert/strict';

// One original AG loop owns one resource slot. A different game can use that
// slot only after its predecessor's parser and Mongo connection have closed.
// A poisoned game is retained permanently; switching games never retries it.
export function createGameResources({gameIds,open}){
 assert(Array.isArray(gameIds)&&gameIds.length>0&&new Set(gameIds).size===gameIds.length
  &&gameIds.every(id=>/^32\d{3}$/.test(id))&&typeof open==='function','SG_AG_RESOURCE_SCOPE');
 const allowed=new Set(gameIds),retained=new Map();
 let active=null,tail=Promise.resolve(),closing=null,closed=false,closeUnknown=null;
 const ordered=call=>{const next=tail.then(call);tail=next.catch(()=>{});return next;};
 async function release(){
  if(closeUnknown)throw closeUnknown;
  if(!active)return;
  const previous=active;
  try{previous.value.assertUsable();}catch(error){retained.set(previous.gameId,error);}
  try{await previous.value.close();active=null;}
  catch(error){closeUnknown=Object.assign(new Error('SG_AG_RESOURCE_CLOSE_UNCONFIRMED',{cause:error}),
    {code:'SG_AG_RESOURCE_CLOSE_UNCONFIRMED',outcomeUnknown:true});throw closeUnknown;}
 }
 return {
  get(gameId){
   assert(allowed.has(gameId),'SG_AG_RESOURCE_OWN_GAME');
   if(closed)return Promise.reject(Error('SG_AG_RESOURCES_CLOSED'));
   return ordered(async()=>{
    if(closed)throw Error('SG_AG_RESOURCES_CLOSED');
    if(closeUnknown)throw closeUnknown;
    if(retained.has(gameId))throw retained.get(gameId);
    if(active?.gameId===gameId){
     try{active.value.assertUsable();return active.value;}
     catch(error){retained.set(gameId,error);throw error;}
    }
    await release();
    try{
     const value=await open(gameId);
     assert(value&&typeof value.close==='function'&&typeof value.assertUsable==='function','SG_AG_RESOURCE_PORTS');
     active={gameId,value};value.assertUsable();return value;
    }catch(error){
     retained.set(gameId,error);
     if(error.code==='SG_AG_RESOURCE_CLOSE_UNCONFIRMED')closeUnknown=error;
     throw error;
    }
   });
  },
  // Native metadata/transport are deliberately not owned or closed here.
  close(){
   if(closing)return closing;
   closed=true;closing=ordered(release);return closing;
  },
  status:()=>({activeGame:active?.gameId??null,retainedGames:[...retained.keys()],closed,
   closureConfirmed:closed&&!active&&!closeUnknown,closeUnknown:!!closeUnknown}),
 };
}
