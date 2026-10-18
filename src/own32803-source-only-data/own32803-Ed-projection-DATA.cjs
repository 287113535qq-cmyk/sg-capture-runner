'use strict';
// Only the fields read by the own Z8 request selector. This is not an End serializer.
exports.createOwn32803EdProjectionDATA=function({DOM,source,game,sessionScope}){
 const need=(ok,s)=>{if(!ok)throw Object.assign(new Error('OWN32803_ED_HOLD_'+s),{retryAllowed:false,newRequestNotSent:true})};
 need(game?.gameId==='32803'&&game.dbName==='sg_rrraceday'&&game.sg?.runtimeGameId===33163&&game.sg?.nativeGameID==='20456'&&sessionScope,'OWN_SCOPE');
 const child=(n,k)=>Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===k);
 const one=(n,k)=>{const a=child(n,k);need(a.length===1,'ONE_'+k);return a[0]};
 const index=n=>{const a=n.attributes.getNamedItem('spinIndex');need(a&&a.value.trim()!==''&&Number.isSafeInteger(Number(a.value)),'ACTUAL_INDEX');return Number(a.value)};
 let sealed=false;
 return Object.freeze({project(frame,roundScope){
  need(!sealed&&source.has(frame)&&source.readCurrent(sessionScope,roundScope)===frame&&source.readCurrentRound(sessionScope)===roundScope&&source.hasOriginalRound(roundScope),'CURRENT_OWN_FRAME_ROUND');
  need(frame.game===game&&frame.sessionScope===sessionScope&&frame.roundScope===roundScope&&source.isAcceptedOriginalACK(frame)===true&&source.originalMoneyCommitted(frame)===true&&source.ownCurrentEdWasCleared(frame)===true,'ACCEPTED_ACK_AFTER_MONEY_AND_NATIVE_CLEAR');
  need(frame.msgId==='Logic'&&frame.httpStatus>=200&&frame.httpStatus<300&&typeof frame.responsePayload==='string'&&!/<!DOCTYPE/i.test(frame.responsePayload),'SUCCESSFUL_RAW');
  const d=new DOM.DOMParser().parseFromString(frame.responsePayload,'text/xml'),r=d.documentElement;
  need(r?.nodeName==='GameResponse'&&r.getAttribute('type')==='Logic'&&!d.getElementsByTagName('parsererror').length&&!d.getElementsByTagName('Error').length,'SUCCESSFUL_ENVELOPE');
  const h=one(r,'Header');need(h.getAttribute('gameID')==='20456'&&h.getAttribute('versionID')==='1_0'&&h.getAttribute('isRecovering')==='N','OWN_HEADER');
  const g=one(r,'GameResult');need(!child(g,'BaseGameRecoveryInfo').length,'UNMAPPED_RECOVERY');
  const reels=one(g,'ReelResults'),spins=child(reels,'ReelSpin'),horses=child(reels,'HorseLandedInfo'),frames=[];
  // Gpa is a nested loop: preserve order and duplicates; never reduce it to a set/max/index whitelist.
  for(const spin of spins){const i=index(spin),stops=child(spin,'ReelStops');need(stops.length<=1,'UNMAPPED_DUPLICATE_STOPS');
   for(const horse of horses){const j=index(horse);if(i===j&&horse.attributes.getNamedItem('landed')&&stops.length===1)frames.push(Object.freeze({index:i}));}}
  need(frames.length>0,'NATIVE_CURRENT_ED_EMPTY');
  return Object.freeze({game,sessionScope,roundScope,originalResponseFrame:frame,frames:Object.freeze(frames),transportReady:false,actualEndACK:false,remainingBindings:'original Init/current free+FreeRounds+max state, native request-open lifecycle, original request/End serialization and matching ACK'});
 },seal(){sealed=true}})
};
