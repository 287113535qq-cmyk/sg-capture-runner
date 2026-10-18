'use strict';
// Execute only frozen own request selectors, with opaque local completion DATA.
// No app, renderer, scheduler, HTTP client, timer actor or database is loaded.
exports.createOwn32815WireNextEndDATA=function({DOM,vm,data}){
 const need=(x,n)=>{if(!x)throw Object.assign(new Error('OWN32815_WIRE_HOLD_'+n),{own32815WireHold:true,retryAllowed:false,newRequestNotSent:true})};
 need(data?.schema==='own32815-Wheel-original-protocol-DATA-v1480','OWN_SOURCE_DATA');
 const noop=()=>{},later=[],sg={...data.constants,CommonUIModel:{isautoplaying:0},GameConfig:{featureTobase:false},FeatureDatas:function(){this.data=[]},FeatureData:function(){},FreeSpinsData:function(){},WheelFeatureRemainingData:function(){},CustomParser:{},GameState:function(stateName,nextState,nextSubGame){Object.assign(this,{stateName,_defaultNextState:nextState,_defaultNextSubGame:nextSubGame})}};
 const server={GLSRequest:function(encoders){this.encoders=encoders},GLSCurrencyEncoder:function(v){this._currencyMultiplier=v}};
 const ctx=vm.createContext({sgigame:sg,server,_super:{prototype:{execute:noop}},console:{log:noop},prompt:()=>need(false,'NO_GAFFING'),TweenMax:{delayedCall:(t,f,args,self)=>later.push(()=>f.apply(self,args||[]))}}),own={};
 for(const[n,v]of Object.entries(data.leaves))own[n]=new vm.Script('('+v.source+')').runInContext(ctx,{timeout:100});
 sg.FeatureData.prototype.setData=own.featureData;sg.FreeSpinsData.prototype.setData=own.freeData;sg.CustomParser.xmlnameValuePairArrayToObject=own.attributeDATA;
 const child=(n,k)=>Array.from(n.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===k),one=(n,k)=>{const a=child(n,k);need(a.length===1,'ONE_'+k);return a[0]},attr=(n,k)=>{const a=n?.attributes?.getNamedItem(k);need(a,'EXPLICIT_'+k);return a.value},integer=(v,k)=>{need(/^(?:0|[1-9]\d*)$/.test(v)&&Number.isSafeInteger(Number(v)),k);return Number(v)};
 function parse(text,event,request=false){need(typeof text==='string'&&!/<!DOCTYPE/i.test(text),'RAW_XML');const d=new DOM.DOMParser().parseFromString(text,'text/xml'),r=d.documentElement;need(r?.nodeName===(request?'GameRequest':'GameResponse')&&attr(r,'type')===event&&!d.getElementsByTagName('parsererror').length&&!d.getElementsByTagName('Error').length&&!d.getElementsByTagName('Errors').length,'SUCCESSFUL_'+event);return{d,r}}
 const header=h=>need(attr(h,'gameID')==='20121'&&attr(h,'versionID')==='1_0','OWN_HEADER');
 let round=null,phase='base',isFG=false;const seen=new WeakMap();
 const inspectEndEnvelope=({httpStatus,responsePayload})=>{need(httpStatus===200,'END_HTTP');const{r}=parse(responsePayload,'EndGame'),h=one(r,'Header');header(h);need(attr(h,'isRecovering')==='N'&&attr(h,'sessionID').length>0,'CURRENT_END_CURSOR');return Object.freeze({recognizedSuccessfulOwnEndEnvelope:true,currentRoundCompletionClaimed:false,newFinalCredit:0})};
 return Object.freeze({inspectEndEnvelope,prepare({sessionScope,source,frame,initFrame}){
  need(sessionScope&&source?.readCurrent?.(sessionScope)===frame&&source.readInit?.(sessionScope)===initFrame&&source.has?.(frame)&&source.readNormalCaptureMode?.(sessionScope)==='normal-capture','CURRENT_PRIVATE_CAPTURE');
  need(frame?.msgId==='Logic'&&frame.httpStatus===200&&frame.roundScope&&initFrame?.msgId==='Init'&&initFrame.httpStatus===200,'ACCEPTED_CURRENT_ROUND');if(seen.has(frame))return seen.get(frame);
  if(round!==frame.roundScope){need(!later.length,'NO_OLD_CALLBACK');round=frame.roundScope;phase='base';isFG=false}
  const{d,r}=parse(frame.responsePayload,'Logic'),{d:qd,r:q}=parse(frame.requestPayload,'Logic',true),{r:iq}=parse(initFrame.requestPayload,'Init',true);parse(initFrame.responsePayload,'Init');
  const h=one(r,'Header'),qh=one(q,'Header'),ih=one(iq,'Header');for(const x of [h,qh,ih])header(x);need(attr(h,'isRecovering')==='N'&&attr(qh,'gameCodeRGI')==='zeusgodofthunder','NORMAL_OWN_RESPONSE');
  for(const n of ['affiliate','ccyCode','channel','freePlay','gameCodeRGI','glsID','lang','promotions','userID','userType','versionID'])need(attr(qh,n)===attr(ih,n),'BOUND_'+n);
  for(const n of ['REPLAY','FORCE'])need(!child(q,n).length&&!child(iq,n).length,'NORMAL_'+n);
  const wager=one(q,'WagerInfo'),paid=integer(attr(wager,'totalStake'),'SOURCE_WAGER'),extra=attr(wager,'isExtraBet');need(paid>0&&extra==='0','OWN_NORMAL_WAGER');
  const g=one(r,'GameResult'),info=one(g,'GameWinInfo'),cumulative=integer(attr(info,'totalWagerWin'),'ACTUAL_CUMULATIVE_MONEY');need(integer(attr(g,'stake'),'ACTUAL_STAKE')===paid,'OWN_CURRENT_STAKE');need(attr(info,'isMaxWin')==='N','UNMAPPED_MAX_CALLBACK');
  const dto={gameWagerInfo:{totalWagerWin:cumulative,isMaxWin:false}};own.featureParser.call({},d,dto);own.freeParser.call({},d,dto);own.remainingParser.call({},d,dto);
  let free;
  if(dto.fsData){const fs=dto.fsData;const node=Array.from(d.getElementsByTagName('Feature')).find(n=>n.getAttribute('index')==='1')?.firstChild;need(node&&['Y','N'].includes(attr(node,'lastFreeSpin')),'ACTUAL_LAST_FREE_SELECTOR');need(Number.isSafeInteger(fs.currentSpinNumber)&&fs.currentSpinNumber>=0&&Number.isSafeInteger(fs.freeSpinsTotal)&&fs.freeSpinsTotal>=fs.currentSpinNumber&&Number.isSafeInteger(fs.freeSpinTotalWin)&&fs.freeSpinTotalWin>=0&&Number.isSafeInteger(fs.triggeredFeatureIndex),'ACTUAL_FREE_SOURCE_DATA');free=Object.freeze({freeSpinsPlayed:fs.currentSpinNumber,freeSpinsTotal:fs.freeSpinsTotal,freeSpinsRemaining:fs.freeSpinsTotal-fs.currentSpinNumber,accumulativeWin:fs.freeSpinTotalWin/100})}
  const states=new Map();let current,group;const add=(gr,n,next,ng)=>states.set(gr+':'+n,new sg.GameState(n,next,ng));own.createStates.call({addPre:(n,next,gr)=>add(sg.SubGames.PRE_GAME,n,next,gr),addBase:(n,next,gr)=>add(sg.SubGames.BASE_GAME,n,next,gr),_statesModel:{init:noop}});
  const set=(gr,n)=>{group=gr;current=states.get(gr+':'+n);need(current,'SOURCE_STATE_'+n)},model={getCurrentState:()=>current,changeStateByName:n=>set(group,n),gotoNextState(){own.stateNext.call(current);set(current.nextSubGame,current.nextState)}};
  const type={isFG},context={_server:{getLogicResponse:()=>dto},_statesModel:model,_gameType:type,_RecoveryType:{isGameRecover:false},_autoPlayModel:{stop:noop},_cyclerModel:{stopCyclers:noop}};
  set(sg.SubGames.BASE_GAME,phase==='wheel'?sg.BaseGameStates.WF_CHECK_TRIGGERED_FEATURE_TYPE:phase==='wild'?sg.BaseGameStates.WF_CHECK_WHEEL_FEATURE_REMAINING:sg.BaseGameStates.CHECK_WHEEL_TRIGGERED);
  let event,nextPhase;for(let budget=64;budget>0;budget--){
   const name=current.stateName;
   if([sg.BaseGameStates.LOGIC_GLS_STATE,sg.BaseGameStates.WF_LOGIC_REQUEST,sg.BaseGameStates.WS_LOGIC_REQUEST].includes(name)){event='Logic';nextPhase=name===sg.BaseGameStates.WF_LOGIC_REQUEST?'wheel':name===sg.BaseGameStates.WS_LOGIC_REQUEST?'wild':'base';break}
   if(name===sg.BaseGameStates.END_GLS_STATE){let n=0;own.endRequest.call({_RecoveryType:context._RecoveryType,_history:{getIsHistoryReplay:()=>false},_server:{makeEndRequest:x=>{need(x.encoders.length===0,'EMPTY_SOURCE_END');n++}}});need(n===1,'ONE_END_CANDIDATE');event='EndGame';nextPhase='base';break}
   if(name===sg.BaseGameStates.CHECK_WHEEL_TRIGGERED){if(type.isFG)need(dto.fsData,'CURRENT_FREE_MODE_DATA');own.wheelTrigger.call(context);}
   else if(name===sg.BaseGameStates.WF_CHECK_TRIGGERED_FEATURE_TYPE){need(dto.featureDatas.data[0]?.attributeData&&/^(?:1|3|4|5|10)$/.test(String(dto.featureDatas.data[0].attributeData.triggeredFeatureIndex)),'UNMAPPED_ACTUAL_WHEEL_SELECTOR');own.wheelResult.call(context)}
   else if(name===sg.BaseGameStates.WF_CHECK_WHEEL_FEATURE_REMAINING)own.remainingWheel.call(context);
   else if(name===sg.BaseGameStates.GO_TO_BONUS_STATE){if(type.isFG)need(dto.fsData,'CURRENT_FREE_MODE_DATA');own.bonusNext.call(context);}
   else if(name===sg.BaseGameStates.FG_TRIGGERED)own.enterFree.call(context);
   else if(name===sg.BaseGameStates.WF_UPGRADE)own.upgrade.call(context);
   else if(name===sg.BaseGameStates.FG_COMPLETE)own.freeComplete.call(context);
   else if(name===sg.BaseGameStates.FG_OUTRO_TRANSITION){own.freeOutroComplete.call({_gameType:type,updateFeatureName:noop});model.gotoNextState()}
   else model.gotoNextState(); // frozen own graph: opaque local display completion
   let callbacks=4;while(later.length){need(callbacks-->0,'FINITE_CALLBACKS');later.shift()()}
  }
  need(event&&nextPhase,'FINITE_SOURCE_NEXT');phase=nextPhase;isFG=type.isFG;const sid=attr(h,'sessionID');need(sid.length>0,'CURRENT_ACCEPTED_CURSOR');qh.setAttribute('sessionID',sid);
  if(event==='EndGame'){for(const n of Array.from(q.childNodes))if(n.nodeType===1&&n.nodeName!=='Header')q.removeChild(n);q.setAttribute('type','EndGame')}
  const result=Object.freeze({kind:event==='Logic'?'source-automatic-feature-request-candidate':'source-EndGame-request-candidate',event,action:event==='Logic'?'FREE_SPIN':'PLAY',requestPayload:new DOM.XMLSerializer().serializeToString(qd),sourcePaidTotal:paid,sourceCumulativeWin:cumulative,...(free?{free}:{}),sourceFreePlayed:free?.freeSpinsPlayed,sourceFreeRemaining:free?.freeSpinsRemaining,sourceMaxWin:false,sourceNextPhase:phase,EndCandidate:event==='EndGame',transportAttempted:false,newProviderACK:false,actualSuccessfulEndStillRequired:true,fullOriginalSGAGConnectionNotQualified:true});seen.set(frame,result);return result;
 }});
};
