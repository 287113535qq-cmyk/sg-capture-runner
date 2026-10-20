'use strict';
// Native direct base -> LIL_SPIN_SETUP -> LIL_SPIN. No BonusChoice is inserted.
exports.createOwn32788DirectLilProtocolDATA=function({DOM,game}){
 const need=(v,m)=>{if(!v)throw Object.assign(new Error('OWN32788_DIRECT_LIL_HOLD_'+m),{retryAllowed:false,newRequestNotSent:true});};
 need(game?.gameId==='32788'&&game.dbName==='sg_lockitlink'&&game.sg?.runtimeGameId===33010&&game.sg.betRaw===50&&game.sg.header?.gameID==='20158','OWN_IDENTITY');
 const rounds=new WeakMap(),seen=new WeakMap(),children=(n,t)=>Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===t);
 const one=(n,t)=>{const a=children(n,t);need(a.length===1,'ONE_'+t);return a[0];},integer=(n,k)=>{const a=n?.attributes?.getNamedItem(k);need(a&&/^(0|[1-9][0-9]*)$/.test(a.value)&&Number.isSafeInteger(Number(a.value)),'ACTUAL_'+k);return Number(a.value);},flag=(n,k)=>{const a=n?.getAttribute(k);need(a==='Y'||a==='N','ACTUAL_'+k);return a==='Y';};
 return Object.freeze({prepare({session,round,source,frame}){
  need(session&&round&&source?.has(frame)&&source.readCurrent(session,round)===frame&&frame.game===game&&frame.sessionScope===session&&frame.roundScope===round&&frame.msgId==='Logic'&&frame.httpStatus===200,'CURRENT_OWN_FRAME');
  if(seen.has(frame))return seen.get(frame);
  need(typeof frame.responsePayload==='string'&&!/<!DOCTYPE/i.test(frame.responsePayload),'RAW_XML');
  const d=new DOM.DOMParser().parseFromString(frame.responsePayload,'text/xml'),root=d.documentElement;
  need(root?.nodeName==='GameResponse'&&root.getAttribute('type')==='Logic'&&!d.getElementsByTagName('Error').length&&!d.getElementsByTagName('Errors').length&&!d.getElementsByTagName('parsererror').length,'OWN_SUCCESS_ENVELOPE');
  const h=one(root,'Header');need(h.getAttribute('gameID')==='20158'&&h.getAttribute('versionID')==='1_0'&&h.getAttribute('isRecovering')==='N','OWN_NORMAL_HEADER');
  const g=one(root,'GameResult'),features=children(g,'Feature'),lil=features.filter(x=>x.getAttribute('index')==='3'&&x.getAttribute('name')==='LilGame'),active=rounds.get(round);
  if(!active&&lil.length===0)return undefined; // Existing normal/choice consumers retain their own paths.
  need(lil.length===1&&!children(g,'BaseGameRecoveryInfo').length&&!children(g,'LilRecoveryInfo').length,'ONE_NORMAL_LIL_FEATURE');
  need(integer(g,'stake')===50,'OWN_STAKE');const cash=one(g,'GameWinInfo');need(cash.getAttribute('isMaxWin')==='N','MAX_STAYS_UNMAPPED');
  const win=integer(cash,'totalWagerWin');let event,route;
  if(!active){
   need(source.readOriginalPhase(session,round)==='base','ACTUAL_DIRECT_BASE_ENTRY');const reel=one(g,'ReelResults'),spins=children(reel,'ReelSpin');need(spins.length>0,'ACTUAL_NATIVE_FIRST_SPIN');
   need(!flag(spins[0],'freeSpin')&&!flag(spins[0],'bonusAwarded'),'NATIVE_BASE_NOT_BONUS_CHOICE');const bg=one(lil[0],'BGInfo');
   need(flag(bg,'isLilTriggered')&&integer(bg,'numTotalLilSpinsAwarded')>0,'NATIVE_DIRECT_LIL_TRIGGER');
   event='Logic';route='native-BASE_TO_LIL_INTRO-to-LIL_SPIN_SETUP-to-LIL_SPIN';rounds.set(round,Object.freeze({session}));
  }else{
   need(active.session===session,'SAME_PRIVATE_ROUND');const info=one(lil[0],'LilInfo');
   // The original client chooses its next request from lastLilSpin, including
   // its display-only tally/outro path. No remaining-count or display gate.
   const last=flag(info,'lastLilSpin');event=last?'EndGame':'Logic';route=last?'native-lastLilSpin-tally-outro-to-End':'native-lastLilSpin-false-to-LIL_SPIN';
  }
  const result=Object.freeze({event,action:event==='Logic'?'FREE_SPIN':'PLAY',sourceCumulativeWin:win,sourceProtocolKind:'own-native-direct-LIL',sourceRoute:route,requestNotSent:true,actualEndACK:false});seen.set(frame,result);return result;
 }});
};
