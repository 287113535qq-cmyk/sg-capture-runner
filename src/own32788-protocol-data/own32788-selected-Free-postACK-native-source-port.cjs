'use strict';
const nativeDATA=require('./native-intro-callback-source-DATA.json');

// Own selected-Free protocol source port only. It has no transport or database.
exports.createOwn32788SelectedFreePostACKNativeSourcePort=function({game,DOM,vm,wireData,choiceData,control,source,limits}){
 const need=(ok,m)=>{if(!ok)throw Object.assign(new Error('OWN32788_NATIVE_INTRO_HOLD_'+m),{retryAllowed:false})};
 need(control?.isAcceptedReceipt&&DOM?.DOMParser&&vm?.createContext&&game?.gameId==='32788'&&
  game.dbName==='sg_lockitlink'&&game.sg?.betRaw===50&&game.sg.header?.gameID==='20158','OWN_INPUTS');
 need(Number.isSafeInteger(limits?.timeoutMs)&&limits.timeoutMs>1000,'ORIGINAL_FINITE_TIMEOUT');
 const issued=new WeakSet(),completions=new WeakSet(),byReceipt=new WeakMap(),started=new WeakSet();
 let closed=false,active=null,scheduled=null,deadlineTimer=null;
 const children=(n,t)=>Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===t);
 const one=(n,t)=>{const a=children(n,t);need(a.length===1,'ONE_'+t);return a[0]};
 function current(r){
  need(!closed&&control.isAcceptedReceipt(r)&&source.readCurrent(r.sessionScope,r.roundScope)===r.frame&&
   source.envelopeAccepted(r.frame)===true&&source.readNormalCaptureMode(r.sessionScope,r.roundScope)==='normal-capture'&&
   source.readOriginalSessionID(r.sessionScope)===r.responseSessionID,'CURRENT_ACCEPTED_CONTROL');
 }
 function model(raw){
  const doc=new DOM.DOMParser().parseFromString(raw,'text/xml');need(!doc.getElementsByTagName('parsererror').length,'ACTUAL_XML');
  const result=one(doc.documentElement,'GameResult'),reels=children(result,'ReelResults');need(reels.length<=1,'ONE_REEL_COLLECTION');
  // Empty actual ReelSpin collection stays empty; no fake paid/free spin is created.
  const reelSpinData=reels.length?children(reels[0],'ReelSpin').map(n=>{
   const value=n.getAttribute('bonusAwarded');need(value==='Y'||value==='N','ACTUAL_BONUS_FLAG');return {bonusAwarded:value==='Y'};
  }):[];
  return {reelSpinData};
 }
 function clear(){if(scheduled)clearTimeout(scheduled);if(deadlineTimer)clearTimeout(deadlineTimer);scheduled=deadlineTimer=null;}
 return Object.freeze({
  async prepare(receipt){
   current(receipt);need(!started.has(receipt)&&!active,'ONE_INTRO_LIFECYCLE');started.add(receipt);
   const parent=receipt.ticket.originalResponseFrame;
   need(parent&&source.has(parent)&&source.envelopeAccepted(parent)===true&&parent.game===game&&
    parent.sessionScope===receipt.sessionScope&&parent.roundScope===receipt.roundScope&&parent.msgId==='Logic',
    'ACTUAL_CONSUMED_CHOICE_ENTRY');
   // The exact consumed choice ticket was checked by control.accept. Its original
   // owner already required the entry's money commit before sending that ticket.
   // Do not demand that the *new current control frame* have an AG money result.
   const before=model(parent.responsePayload),after=model(receipt.frame.responsePayload);
   need(before.reelSpinData.length>0&&before.reelSpinData[0].bonusAwarded===true&&after.reelSpinData.length===0,
    'ACTUAL_SELECTED_INTRO_NOT_SPIN');
   const init=source.readInit(receipt.sessionScope),currency=source.readAcceptedCurrency(init);
   need(init&&source.has(init)&&source.envelopeAccepted(init)===true&&Number.isSafeInteger(currency)&&currency>0,
    'ACTUAL_ACCEPTED_INIT_CURRENCY');
   need(Array.isArray(receipt.dispatch.requestHeaders),'ORIGINAL_LOGIC_HEADERS');
   const h=game.sg.header;for(const k of ['affiliate','userID','freePlay','gameCodeRGI','lang','gameID','versionID'])
    need(typeof h[k]==='string'&&h[k].length>0,'ACTUAL_HEADER_'+k);
   return new Promise((resolve,reject)=>{
    let finished=false,logicCommands=0,completionCount=0,displayStarts=0;
    function fail(error){if(finished)return;finished=true;clear();active=null;closed=true;control.seal();reject(error);}
    active={receipt,reject:fail};deadlineTimer=setTimeout(()=>fail(Object.assign(new Error('OWN32788_NATIVE_INTRO_TIMEOUT'),{retryAllowed:false})),limits.timeoutMs);
    const eventKeys={TRANSITION_COMPLETE:'TransitionEvent_INTRO_TRANSITION_COMPLETE',INTRO_TRANSITION_COMPLETE:'TransitionEvent_INTRO_TRANSITION_COMPLETE',OUTRO_TRANSITION_COMPLETE:'TransitionEvent_OUTRO_TRANSITION_COMPLETE'};
    const TransitionEvent=function(type){this.type=type};Object.assign(TransitionEvent,eventKeys);
    const c=vm.createContext({server:{},sgigame:{TransitionEvent,BaseGameStates:{LOGIC_GLS_STATE:'LOGIC_GLS_STATE'},
     BonusGameState:{FREE_SPIN_INTRO:'FREE_SPIN_INTRO',LIL_INTRO:'LIL_INTRO'},SubGames:{BONUS_GAME:'BONUS_GAME'},RecoveryData:{isRecovering:false},
     HandleIncompleteGameCmd:{IS_FREESPIN_RECOVERY:false,IS_FEATURE_SELECTION_RECOVERY:false},
     HistoryModel:{HANDLE_TRANSITION_LOGIC_HISTORY:false}},
     _super:{prototype:{execute(){}}},rendering:{DisplayEvent:{ENTER_FRAME:'ENTER_FRAME',ANIMATION_COMPLETE:'ANIMATION_COMPLETE'}},
     dragonwings:{MediatorEvent:function(type,view){this.type=type;this.view=view;}},
     TweenLite:{delayedCall(seconds,fn){try{need(seconds===1&&!scheduled,'ONE_ORIGINAL_NATIVE_DELAY');scheduled=setTimeout(()=>{
      scheduled=null;try{current(receipt);fn()}catch(error){fail(error)}
     },seconds*1000)}catch(error){fail(error)}}}});
    const run=s=>new vm.Script(s).runInContext(c,{timeout:100});
    try{
     for(const key of ['header','request','currency','stake']){need(typeof wireData?.[key]?.source==='string','EXISTING_NATIVE_'+key);run(wireData[key].source)}
     const wire=run('('+wireData.logicWire.source+')'),makeLogic=run('('+choiceData.leaves.logic.source+')');
     const fns={};for(const key of ['viewInit','viewStart','viewPlay','viewComplete','mediatorComplete','addIntro'])fns[key]=run('('+nativeDATA.leaves[key].source+')');
     const originalLogicCommand={};c.sgigame.MakeLogicRequestCmd=originalLogicCommand;
     let mappedCommand; c._this={mapCommand(command,event){need(event===eventKeys.INTRO_TRANSITION_COMPLETE,'EXACT_NATIVE_MAP');mappedCommand=command;}};
     run(nativeDATA.leaves.map.source);need(mappedCommand===originalLogicCommand,'ORIGINAL_NATIVE_COMMAND');
     const server={getLogicResponse:()=>after,getInitResponse:()=>({platformData:{currencyMultiplier:currency}}),makeLogicRequest(data){
      current(receipt);need(++logicCommands===1&&completionCount===1,'ONE_NATIVE_LOGIC_AFTER_COMPLETION');
      const payload=wire.call({_partnerAdapter:{getSessionData:()=>({getContextID:()=>h.affiliate,getPlayerID:()=>h.userID})},
       _metaData:{isRealMoney:()=>h.freePlay!=='Y',getGameCode:()=>h.gameCodeRGI,getLocale:()=>h.lang},
       _sessionId:source.readOriginalSessionID(receipt.sessionScope),_glmId:h.gameID,_glmVersion:h.versionID},data);
      const dispatch=Object.freeze({event:'Logic',game,sessionScope:receipt.sessionScope,roundScope:receipt.roundScope,
       originalResponseFrame:receipt.frame,requestSessionID:receipt.responseSessionID,requestPayload:payload,
       requestHeaders:Object.freeze(receipt.dispatch.requestHeaders.map(pair=>Object.freeze([...pair]))),
       parameters:Object.freeze({...game.sg.stake}),sourceRoute:'native-INTRO_TRANSITION_COMPLETE-MakeLogicRequestCmd',requestNotSent:true});
      issued.add(dispatch);byReceipt.set(receipt,dispatch);const authenticated=control.nextFromActualNative(receipt);
      need(authenticated===dispatch,'ORIGINAL_CONTROL_NATIVE_BINDING');finished=true;clear();active=null;resolve(dispatch);
     }};
     const command={_server:server,getStakeEncode:()=>new c.sgigame.StakeEncoder(game.sg.betRaw),
      _historyModel:{getNextState:()=>undefined},_forceModel:{forceSet:false,reset(){}},
      _statesModel:{getCurrentState:()=>({stateName:'FREE_SPIN_REEL_STOP'}),getSubGame:()=>c.sgigame.SubGames.BONUS_GAME}};
     const contextEvents={dispatchEvent(event){
      current(receipt);need(event.type===eventKeys.INTRO_TRANSITION_COMPLETE&&++completionCount===1,'ACTUAL_INTRO_CALLBACK');
      const completion=Object.freeze({type:event.type,game,sessionScope:receipt.sessionScope,roundScope:receipt.roundScope,
       originalResponseFrame:receipt.frame,nativeEvent:event});completions.add(completion);
      control.onNativeIntroTransitionComplete(receipt,completion);makeLogic.call(command);
     }};
     const view={_transitionAnim:{stop(){},removeEventListener(){},gotoAndPlay(frame){
      need(frame===0&&++displayStarts===1,'ONE_NATIVE_PRESENTATION_START');
      // Protocol DATA presentation completion boundary: execute the original
      // native completion callback, without making browser drawing a data gate.
      fns.viewComplete.call(view);
     }},_audioModel:{stopFeatureSelectionLoop(){},playLIIntroBurst(){}},
     addTransition(){},onOrientationChange(){},removeEventListener(){},
     dispatchEvent(event){need(event.type===eventKeys.TRANSITION_COMPLETE,'NATIVE_VIEW_COMPLETE');fns.mediatorComplete.call(mediator)}};
     Object.defineProperty(view,'isIntro',{get(){return this._isIntro}});
     view.init=isIntro=>fns.viewInit.call(view,isIntro);view.playTransitionAnim=()=>fns.viewPlay.call(view);view.startTransition=()=>fns.viewStart.call(view);
     const mediator={_transitionView:view,_gameContextEventDispatcher:contextEvents};
     const layer={addChild(){}},views={fsSelectionLayer:{},jackpotMeterLayer:{},activateViews(){}};
     // Original AddAndPlayFSTransition reads the committed choice entry for
     // bonusAwarded. MakeLogic later reads the accepted control response (no reels).
     fns.addIntro.call({_server:{getLogicResponse:()=>before},_transitionView:view,_fsTransitionLayer:layer,
      _subgamesModel:views,eventDispatcher:{dispatchEvent(){}},_eventDispatcher:{dispatchEvent(){}}});
     need(view.isIntro===true&&scheduled,'ACTUAL_INTRO_STARTED_WITH_ORIGINAL_DELAY');
    }catch(error){fail(error)}
   });
  },
  isActualNativeIntroCompletion(event){return completions.has(event)},
  isIssuedNativeDispatch(dispatch){return issued.has(dispatch)},
  readActualNativeNextForControl(receipt){return byReceipt.get(receipt)},
  close(){closed=true;control.seal();const pending=active;clear();if(pending)pending.reject(Object.assign(new Error('OWN32788_NATIVE_INTRO_CLOSED'),{retryAllowed:false}))}
 });
};
