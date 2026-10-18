'use strict';
const {createOwn32812NativeWire}=require('./own32812-native-wire.cjs');
exports.createOwn32812SelectedProtocol=function({DOM,vm,data,game}){
 const need=(ok,s)=>{if(!ok)throw Object.assign(new Error('AG integrity: own32812 '+s),{retryAllowed:false})},native=createOwn32812NativeWire({DOM,vm,data,need});
 const children=(n,k)=>Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===k),one=(n,k)=>{const a=children(n,k);need(a.length===1,'ONE_'+k);return a[0]},num=(n,a)=>{const x=n?.attributes?.getNamedItem(a);need(x&&/^[0-9]+$/.test(x.value)&&Number.isSafeInteger(Number(x.value)),'ACTUAL_'+a);return Number(x.value)};
 let currentRound=null,mode=null,lastFrame=null,lastResult=null;
 return {
  acceptInit(raw){const result=native.configure(raw);currentRound=null;mode=null;lastFrame=lastResult=null;return result;},
  select({session,round,source,frame}){
   need(session&&round&&frame?.game===game&&frame.sessionScope===session&&frame.roundScope===round&&source.has(frame)&&source.readCurrent(session,round)===frame,'CURRENT_PRIVATE_FRAME');
   need(frame.msgId==='Logic'&&frame.httpStatus===200&&typeof frame.responsePayload==='string'&&!/<!DOCTYPE/i.test(frame.responsePayload),'RAW_LOGIC');
   if(currentRound!==round){currentRound=round;mode='base';lastFrame=lastResult=null;}else if(frame===lastFrame)return lastResult;else need(lastResult?.event!=='EndGame','ACTUAL_PREVIOUS_END_REQUIRES_ORIGINAL_ACK_AND_NEW_ROUND');
   const d=new DOM.DOMParser().parseFromString(frame.responsePayload,'text/xml'),r=d.documentElement;
   need(r?.nodeName==='GameResponse'&&r.getAttribute('type')==='Logic'&&!d.getElementsByTagName('Error').length&&!d.getElementsByTagName('Errors').length,'OWN_LOGIC');
   const h=one(r,'Header');need(h.getAttribute('gameID')==='20206'&&h.getAttribute('versionID')==='1_0'&&h.getAttribute('isRecovering')==='N','OWN_HEADER');
   const g=one(r,'GameResult'),bg=one(g,'BGInfo'),fs=children(g,'FSInfo');need(fs.length<=1,'ONE_OPTIONAL_FSInfo');
   const cash=num(bg,'totalWagerWin');need(num(g,'stake')===game.sg.betRaw,'ACTUAL_OWN_WAGER');
   let free;if(fs.length){const f=fs[0],total=num(f,'freeSpinsTotal'),used=num(f,'freeSpinNumber');free=Object.freeze({freeSpinsTotal:total,freeSpinsPlayed:used,freeSpinsRemaining:total-used});}
   const next=native.decide(frame.responsePayload,mode);
   need(next.bg.totalWagerWin===cash,'NATIVE_CURRENT_BG_CUMULATIVE_RAW_WIN');
   if(fs.length){const source=next.feature.freeSpinsData;need(next.feature.featureAwarded===true&&source?.freeSpinsTotal===free.freeSpinsTotal&&source.freeSpinNumber===free.freeSpinsPlayed,'NATIVE_ACTUAL_FREE_COUNTERS');mode='free';}
   else{need(next.feature.featureAwarded===false&&mode==='base'&&next.sourceMode==='base'&&next.event==='EndGame','NATIVE_BASE_NO_FEATURE_CLOSE');}
   need(['Logic','EndGame'].includes(next.event),'NATIVE_NEXT_END');
   lastFrame=frame;lastResult=Object.freeze({event:next.event,action:next.event==='Logic'?'FREE_SPIN':'PLAY',sourceCumulativeWin:cash,free,sourceProtocolKind:fs.length?'FSInfo':'BGInfo',sourceNativeMode:mode,requestNotSent:true,actualEndACK:false});return lastResult;
  }
 };
};
