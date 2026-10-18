'use strict';
// Only the fields read by the own Z8 request selector. This is not an End serializer.
function createScopedFeatureEd({DOM,source,game,sessionScope,proofForFrame}){
 const need=(ok,s)=>{if(!ok)throw Object.assign(new Error('OWN32803_ED_HOLD_'+s),{retryAllowed:false,newRequestNotSent:true})};
 need(game?.gameId==='32803'&&game.dbName==='sg_rrraceday'&&game.sg?.runtimeGameId===33163&&game.sg?.nativeGameID==='20456'&&sessionScope,'OWN_SCOPE');
 const child=(n,k)=>Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===k);
 const one=(n,k)=>{const a=child(n,k);need(a.length===1,'ONE_'+k);return a[0]};
 const index=n=>{const a=n.attributes.getNamedItem('spinIndex');need(a&&a.value.trim()!==''&&Number.isSafeInteger(Number(a.value)),'ACTUAL_INDEX');return Number(a.value)};
 let sealed=false;
 return Object.freeze({project(frame,roundScope){
  need(proofForFrame(frame),'CURRENT_OWN_FEATURE_OR_NATIVE_FREE_ACK');need(!sealed&&source.has(frame)&&source.readCurrent(sessionScope,roundScope)===frame&&source.readCurrentRound(sessionScope)===roundScope&&source.hasOriginalRound(roundScope),'CURRENT_OWN_FRAME_ROUND');
  need(frame.game===game&&frame.sessionScope===sessionScope&&frame.roundScope===roundScope&&source.isAcceptedOriginalACK(frame)===true&&source.originalMoneyCommitted(frame)===true&&source.ownCurrentEdWasCleared(frame)===true,'ACCEPTED_ACK_AFTER_MONEY_AND_NATIVE_CLEAR');
  need(frame.msgId==='Logic'&&frame.httpStatus>=200&&frame.httpStatus<300&&typeof frame.responsePayload==='string'&&!/<!DOCTYPE/i.test(frame.responsePayload),'SUCCESSFUL_RAW');
  const d=new DOM.DOMParser().parseFromString(frame.responsePayload,'text/xml'),r=d.documentElement;
  need(r?.nodeName==='GameResponse'&&r.getAttribute('type')==='Logic'&&!d.getElementsByTagName('parsererror').length&&!d.getElementsByTagName('Error').length,'SUCCESSFUL_ENVELOPE');
  const h=one(r,'Header');need(h.getAttribute('gameID')==='20456'&&h.getAttribute('versionID')==='1_0'&&h.getAttribute('isRecovering')==='N','OWN_HEADER');
  const g=one(r,'GameResult');
  const reels=one(g,'ReelResults'),spins=child(reels,'ReelSpin'),horses=child(reels,'HorseLandedInfo'),frames=[];
  // Gpa is a nested loop: preserve order and duplicates; never reduce it to a set/max/index whitelist.
  for(const spin of spins){const i=index(spin),stops=child(spin,'ReelStops');need(stops.length<=1,'UNMAPPED_DUPLICATE_STOPS');
   for(const horse of horses){const j=index(horse);if(i===j&&horse.attributes.getNamedItem('landed')&&stops.length===1)frames.push(Object.freeze({index:i}));}}
  need(frames.length>0,'NATIVE_CURRENT_ED_EMPTY');
  return Object.freeze({game,sessionScope,roundScope,originalResponseFrame:frame,frames:Object.freeze(frames),transportReady:false,actualEndACK:false,remainingBindings:'original Init/current free+FreeRounds+max state, native request-open lifecycle, original request/End serialization and matching ACK'});
 },seal(){sealed=true}})
};

// The normal factory is authenticated unchanged code. Only an actual owned feature ACK or freshly updated native free state selects this current-Ed projection.
exports.createOwn32803FreeAwareEdFactoryDATA=function({normalFactory,ownerSlot}){
 if(typeof normalFactory!=='function'||!ownerSlot)throw Error('OWN32803_FREE_ED_OWN_SLOT_REQUIRED');
 return function(args){
  const proofForFrame=frame=>{
   const s=args.source;if(!s.has(frame)||s.readCurrent(args.sessionScope,frame.roundScope)!==frame||s.readCurrentRound(args.sessionScope)!==frame.roundScope||!s.hasOriginalRound(frame.roundScope)||s.isAcceptedOriginalACK(frame)!==true||s.originalMoneyCommitted(frame)!==true||frame.game!==args.game||frame.sessionScope!==args.sessionScope||frame.roundScope!==ownerSlot.roundScope)return false;
   const chain=ownerSlot.freeChain,p=chain?.readOwnedFeaturePlanForACK(frame);if(p)return p.stage==='choice-request'||p.stage==='free-request';
   if(chain?.status().pendingOriginalIntentRetained)return false;
   const state=ownerSlot.nativeCaller?.readDerivedState();return !!state&&state.state===0&&typeof state.max==='boolean'&&(0<state.free?.Lg||0<state.free?.Vi);
  };
  const normal=normalFactory(args),feature=createScopedFeatureEd({...args,proofForFrame});
  return Object.freeze({project(frame,roundScope){return proofForFrame(frame)?feature.project(frame,roundScope):normal.project(frame,roundScope)},seal(){normal.seal();feature.seal()}});
 };
};
