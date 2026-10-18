'use strict';
// Own protocol DATA only. This module has no transport, timer actor, UI or DB.
exports.createOwn32757WireNextEndDATA=function({DOM,vm,data}){
 const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('OWN32757_WIRE_HOLD_'+code),{own32757WireHold:true,newRequestNotSent:true,retryAllowed:false})};
 need(data?.schema==='own32757-wheel-free-control-DATA-v1448'&&DOM?.DOMParser&&vm?.Script,'OWN_SOURCE_DATA');
 const noop=()=>{},later=[],game={...data.constants,BaseGameInfoData:function(){},FreeSpinInfoData:function(){}};
 for(const name of ['GameEvent','CyclersModelEvent','TransitionEvent'])game[name]=Object.assign(function(type){this.type=type},game[name]);
 const ctx=vm.createContext({game,_super:{prototype:{execute:noop}},TweenLite:{delayedCall:(t,f)=>later.push(f)}});
 const own=n=>new vm.Script('('+data.leaves[n].source+')').runInContext(ctx,{timeout:100});
 const freeNext=own('freeNext'),endRequest=own('endRequest'),baseInfo=own('baseInfo'),baseAttribute=own('baseAttribute'),freeInfo=own('freeInfo'),freeAttribute=own('freeAttribute'),baseComplete=own('baseBangupComplete');
 const children=(n,name)=>Array.from(n.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===name);
 const one=(n,name)=>{const a=children(n,name);need(a.length===1,'ONE_'+name);return a[0]};
 const attr=(n,k)=>{const a=n?.attributes?.getNamedItem(k);need(a!=null,'EXPLICIT_'+k);return a.value};
 const integer=(v,name)=>{need(/^(?:0|[1-9]\d*)$/.test(v)&&Number.isSafeInteger(Number(v)),name);return Number(v)};
 const parse=(text,event,request=false)=>{need(typeof text==='string'&&text.length>0&&!/<!DOCTYPE/i.test(text),'RAW_XML');const d=new DOM.DOMParser().parseFromString(text,'text/xml'),root=d.documentElement;need(root?.nodeName===(request?'GameRequest':'GameResponse')&&attr(root,'type')===event&&!d.getElementsByTagName('parsererror').length&&!d.getElementsByTagName('Error').length&&!d.getElementsByTagName('Errors').length,'SUCCESSFUL_'+event+'_ENVELOPE');return {d,root}};
 const ownHeader=h=>need(attr(h,'gameID')==='20132'&&attr(h,'versionID')==='1_0','OWN_HEADER');
 const inspectEndEnvelope=({httpStatus,responsePayload})=>{need(httpStatus===200,'END_HTTP_200');const{root}=parse(responsePayload,'EndGame');const h=one(root,'Header');ownHeader(h);need(attr(h,'isRecovering')==='N'&&attr(h,'sessionID').length>0,'CURRENT_END_CURSOR');return Object.freeze({recognizedSuccessfulOwnEndEnvelope:true,currentRoundCompletionClaimed:false,newFinalCredit:0})};
 return Object.freeze({inspectEndEnvelope,prepare({sessionScope,source,frame,initFrame}){
  need(sessionScope&&source?.readCurrent?.(sessionScope)===frame&&source.readInit?.(sessionScope)===initFrame&&source.has?.(frame)&&source.readNormalCaptureMode?.(sessionScope)==='normal-capture','CURRENT_PRIVATE_CAPTURE');
  need(frame?.msgId==='Logic'&&frame.httpStatus===200&&initFrame?.msgId==='Init'&&initFrame.httpStatus===200,'ACCEPTED_CURRENT_INIT_LOGIC');
  const{d,root}=parse(frame.responsePayload,'Logic');parse(initFrame.responsePayload,'Init');const{d:qdoc,root:q}=parse(frame.requestPayload,'Logic',true),{root:iq}=parse(initFrame.requestPayload,'Init',true);
  const h=one(root,'Header'),qh=one(q,'Header'),ih=one(iq,'Header');for(const x of [h,qh,ih])ownHeader(x);
  need(attr(h,'isRecovering')==='N'&&attr(qh,'gameCodeRGI')==='cheshirecat','NORMAL_OWN_RESPONSE');
  for(const k of ['affiliate','ccyCode','channel','freePlay','gameCodeRGI','glsID','lang','promotions','userID','userType','versionID'])need(attr(qh,k)===attr(ih,k),'BOUND_'+k);
  for(const n of ['REPLAY','FORCE'])need(!children(q,n).length&&!children(iq,n).length,'NORMAL_'+n);
  const paid=integer(attr(one(q,'Stake'),'total'),'SOURCE_WAGER');need(paid>0,'POSITIVE_REQUEST_DATA');const lines=undefined; // Own StakeEncoder.parse emits total only; old cached lines is not an admission gate.
  const g=one(root,'GameResult'),bg=one(g,'BGInfo'),reels=one(g,'ReelResults'),spins=children(reels,'ReelSpin');need(spins.length>0,'OWN_CURRENT_SPIN');
  need(integer(attr(g,'stake'),'ACTUAL_STAKE')===paid,'OWN_WAGER');const win=integer(attr(bg,'totalWagerWin'),'CUMULATIVE_MONEY');
  // Only money and actual request selectors constrain admission, never displayed
  // reel positions, wheel indexes, mystery symbols or a win/display equation.
  const max=attr(bg,'isMaxWin');need(max==='0'||max==='1','OWN_MAX_FLAG');need(max==='0','UNMAPPED_MAX_CALLBACK');
  const fs=attr(spins[0],'freeSpin'),bonus=attr(spins[0],'bonusAwarded');need(['Y','N'].includes(fs)&&['Y','N'].includes(bonus),'ACTUAL_SOURCE_SPIN_FLAGS');
  const response={};baseInfo.call({getAttributeFromNode:baseAttribute},d,response);freeInfo.call({getAttributeFromNode:freeAttribute},d,response);
  let remaining,played,free;
  if(fs==='Y'||bonus==='Y'){
   const f=one(g,'FSInfo'),total=integer(attr(f,'freeSpinsTotal'),'SOURCE_TOTAL');played=integer(attr(f,'freeSpinNumber'),'SOURCE_PLAYED');need(total>=played,'SOURCE_FREE_DOMAIN');remaining=total-played;
   const accumulated=integer(attr(f,'fsWinnings'),'ACTUAL_FREE_WIN');free=Object.freeze({freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:remaining,accumulativeWin:accumulated/100});
   need(response.freeSpinInfoData?.totalFreeSpins===total&&response.freeSpinInfoData.currentFreeSpin===played,'OWN_PARSER_COUNTERS');
   if(bonus==='Y'&&fs==='N')need(remaining>0,'ACTUAL_TRIGGER_HAS_FUTURE_FREE');
  }
  let event;
  if(bonus==='Y'&&fs==='N')event='Logic'; // own Wheel/START_FREE_SPINS/intro callback path, source-tested v1450
  else if(fs==='Y'){
   let next=false,outro=false;freeNext.call({_statesModel:{isFreeSpin:true,changeStateByName:n=>{need(n===game.BonusGameState.FREE_SPIN_REEL_SPIN,'SOURCE_FREE_STATE');next=true},gotoNextState:()=>outro=true},_server:{getLogicResponse:()=>response},_forceModel:{forceOpen:false}});
   let budget=4;while(later.length){need(budget-->0,'FINITE_CALLBACKS');later.shift()()}
   need(next!==outro,'ONE_CURRENT_FREE_ROUTE');if(next)event='Logic';else{
    need(!response.freeSpinInfoData.isBonusGuarantee,'UNMAPPED_BONUS_GUARANTEE_CALLBACK');event='EndGame';
   }
  }else event='EndGame';
  if(event==='EndGame'){
   let candidates=0;const end={_cyclers:{isPreBonusWin:false},_subGamesModel:{isEndResponseReceived:false},_partnerAdapter:{finishedPlay:noop,finishedPostGameAnimations:noop},_historyModel:{getIsHistoryReplay:()=>false},_autoplayModel:{isInProgress:()=>false},_server:{makeEndRequest:q=>{need(q.encoders.length===0,'OWN_EMPTY_END_DATA');candidates++}}};
   // Exact own post-win completion calls MakeEndRequestCmd. The request object is
   // an opaque DATA port; no GLSRequestor or network implementation is loaded.
   ctx.server={GLSRequest:function(encoders){this.encoders=encoders}};
   baseComplete.call({_serverModel:{getLogicResponse:()=>response},_audioModel:{playBangUpEndOverlaySound:noop},_gameContextEventDispatcher:{dispatchEvent:e=>{need(e.type===game.GameEvent.WIN_BANGUP_COMPLETE,'REAL_END_CALLBACK');endRequest.call(end)}}});need(candidates===1,'ONE_END_CANDIDATE');
   for(const n of Array.from(q.childNodes))if(n.nodeType===1&&n.nodeName!=='Header')q.removeChild(n);q.setAttribute('type','EndGame');
  }
  const sid=attr(h,'sessionID');need(sid.length>0,'CURRENT_ACCEPTED_CURSOR');qh.setAttribute('sessionID',sid);
  return Object.freeze({kind:event==='Logic'?'source-automatic-free-request-candidate':'source-EndGame-request-candidate',event,action:event==='Logic'?'FREE_SPIN':'PLAY',requestPayload:new DOM.XMLSerializer().serializeToString(qdoc),sourcePaidTotal:paid,sourcePaylineCount:lines,sourceCumulativeWin:win,sourceFreeRemaining:remaining,sourceFreePlayed:played,...(free?{free}:{}),sourceMaxWin:false,EndCandidate:event==='EndGame',transportAttempted:false,newProviderACK:false,actualSuccessfulEndStillRequired:true,fullOriginalSGAGConnectionNotQualified:true});
 }});
};
