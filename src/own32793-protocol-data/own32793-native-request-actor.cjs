'use strict';
const fs=require('node:fs'),path=require('node:path');
const DATA=require('./native-request-actor-DATA.json');
const CLOCK=fs.readFileSync(path.join(__dirname,'own32793-native-TweenLite-core.js'),'utf8');

// One own session's protocol actor. Geometry nodes are a DATA presentation
// adapter; depth/direction writers, tween time, callbacks and encoders are native.
exports.createOwn32793NativeRequestActor=function({game,sessionScope,DOM,vm,source}){
 const need=(ok,m)=>{if(!ok)throw Object.assign(new Error('OWN32793_NATIVE_'+m),{retryAllowed:false})};
 need(game?.gameId==='32793'&&game.dbName==='sg_nemos_voyage'&&game.sg?.runtimeGameId===33153&&
  game.sg.header?.gameID==='20154'&&sessionScope&&source?.has&&source?.readCurrent,'OWN_INPUTS');
 const timers=new Set(),seen=new WeakSet(),moneySeen=new WeakSet(),finaliseSeen=new WeakSet(),requests=new WeakMap();
 let closed=false,fault=null,current=null,initFrame=null,initModel=null,logicModel=null,requestCount=0,writerCount=0,activeFinalise=null,nativeWaiters=0;
 const c=vm.createContext({setTimeout(fn,ms){let timer=setTimeout(()=>{timers.delete(timer);
  if(closed)return;try{fn()}catch(error){fault=error;stop()}
 },ms);if(!nativeWaiters)timer.unref();timers.add(timer);return timer},clearTimeout(timer){timers.delete(timer);clearTimeout(timer)},Date});
 new vm.Script(CLOCK,{filename:'own32793-native-TweenLite-core.js'}).runInContext(c,{timeout:1000});
 const compile=s=>new vm.Script('('+s+')').runInContext(c,{timeout:100});
 const N=DATA.newLeaves,R=DATA.reusedLeaves;
 const ctor=(leaf,base)=>{const result=compile('function(_super){return '+leaf.source+'}')(base);
  Object.setPrototypeOf(result.prototype,base.prototype);Object.setPrototypeOf(result,base);return result};
 function Node(){this.children=[];this.width=0;this.height=0}
 Node.prototype.addChild=function(child){this.children.push(child);return child};
 Node.prototype.dispatchEvent=function(){};
 const presentation=()=>{};
 function Event(type,data){this.type=type;this.data=data}
 // These identifiers route native DATA callbacks locally; no provider choice,
 // clock, amount or payload field is supplied by the presentation adapter.
 const eventNames=new Set();for(const leaf of [...Object.values(N),...Object.values(R)])
  for(const match of leaf.source.matchAll(/game\.NemoSubmarineEvent\.([A-Z_]+)/g))eventNames.add(match[1]);
 for(const name of eventNames)Event[name]=name;
 for(const name of ['SPIN_COMPLETE','FREE_SPINS_GAME_EXIT_TRANSITION_START','FREE_SPINS_SHOW_TOTAL_WON_COMPLETE',
  'FREE_SPINS_FINALISE_TOTAL_WON','FREE_SPINS_RETURN_TO_BASE_GAME'])Event[name]=name;
 c.rendering={DisplayObjectContainer:Node,Bitmap:Node,Point:function(x,y){this.x=x;this.y=y}};
 c.game={NemoSubmarineEvent:Event,NemoGenericEvent:Event,Layer:{WILD_INDICATORS:'WILD_INDICATORS'},
  BaseGameBundle:{WildIndicators:{name:'WildIndicators'},WildIndicatorsJson:{name:'WildIndicatorsJson'}}};
 c.ps={core:{GameEvent:Event,LayerVisibility:function(layer,visible){this.layer=layer;this.visible=visible}},
  utils:{MiscUtils:{getAssetFrameWithName:()=>Object.freeze({presentationOnly:true})},PSLog:{log:presentation}}};
 c.game.NemoSubInfoObject=compile(R.subInfoConstructor.source);
 c.game.NemoAscensionPayload=compile(R.payloadConstructor.source);
 c.game.NemoAscensionPayload.prototype.parse=compile(R.payloadEncoder.source);
 const View=ctor(N.viewConstructor,Node),view=new View();
 const methods={createSubmarineDepthGauge:N.createDepth,createPressureGauge:N.createPressure,
  createSubGates:N.createGates,setMinimumAndMaximumDepths:N.depthLimits,
  setMinimumAndMaximumPressure:N.pressureLimits,setSubGateDepths:N.gateDepths,
  setDepth:R.setDepth,pauseAscensionTween:R.pause,activateSubGateIndicators:R.gates,
  activateSubGateIndicatorForIndex:R.setGate,setPressure:N.viewPressure,
  closeSubGates:N.closeGates,closeSubGateAtIndex:N.closeGate,
  releaseAllSubgates:N.releaseGates,releaseSubGateAtIndex:N.releaseGate};
 for(const [name,leaf]of Object.entries(methods))View.prototype[name]=compile(leaf.source);
 Object.defineProperties(View.prototype,{
  isDescending:{get:compile(N.directionGet.source),set:compile(N.directionSet.source)},
  submarineDepthYFraction:{get:compile(R.clientDepthFraction.source)},
  submarineDepth:{get:compile(R.clientDepth.source)}});
 for(const name of ['showDamage','startPressureGaugeShake','stopPressureGaugeShake',
  'startPressureGaugeWarningLight','stopPressureGaugeWarningLight'])View.prototype[name]=presentation;
 // Native construction sets the bitmap's entry y; it is never substituted for
 // a later request sample. Original TweenLite writes that same node thereafter.
 view.createPressureGauge();view.createSubmarineDepthGauge();view.createSubGates();
 view._subGateLightningAnimation={playRepetitions:presentation};
 const Transition=ctor(N.transitionConstructor,Node),transition=new Transition();
 Object.defineProperty(Transition.prototype,'transitionDuration',{
  get:compile(N.transitionDurationGet.source),set:compile(N.transitionDurationSet.source)});
 compile('function(){'+N.transitionConfiguration.source+'}').call({_freeSpinsTransitionView:transition});
 const history={getIsHistoryReplay:()=>false};
 const Server=ctor(N.serverConstructor,function(){}),server=new Server();
 server._historyModel=history;server._wildIndicatorsView=view;
 server.getInitResponse=()=>initModel;server.getLogicResponse=()=>logicModel;
 server.addCustomPayloads=compile(R.customPayloads.source);
 const Mediator=ctor(N.mediatorConstructor,function(){}),mediator=new Mediator();
 Object.assign(mediator,{view,_server:server,_historyModel:history,
  _freeSpinsTransitionView:transition,_layerManager:{setVisible:presentation},
  _ascensionWarningPopupView:{isShowingAscensionWarning:false},dispatchContextEvent:presentation});
 const writers={initialiseFromInitResponse:R.initMediator,updateSubInfo:R.updateSubInfo,
  updateSubInfoFromLogicResponse:N.logicResponse,setDescending:R.setDescending,setPressure:R.pressure,
  updatePressureGauge:R.spinComplete,onStakeUpdateAllowed:R.stakeAllowed,
  onFreeSpinsEnterTransitionStart:R.freeEnter,onFreeSpinsExitTransitionStart:R.freeExit};
 for(const [name,leaf]of Object.entries(writers))Mediator.prototype[name]=compile(leaf.source);
 const initParser=compile(R.initParser.source),logicParser=compile(R.logicSubInfo.source);
 const spinComplete=compile(N.spinCompleteEmitter.source);
 function BaseCommand(){}BaseCommand.prototype.execute=presentation;
 const exitCommand=compile('function(_super){return '+R.exitCommand.source+'}')(BaseCommand);
 const TotalWon=ctor(N.totalWonConstructor,Node),totalWon=new TotalWon();
 for(const [name,leaf]of Object.entries({show:N.totalWonShow,onShowComplete:N.totalWonOnShowComplete,hide:N.totalWonHide}))
  TotalWon.prototype[name]=compile(leaf.source);
 totalWon._freeSpinsTransitionView=transition;
 totalWon.dispatchEvent=function(event){
  open();need(activeFinalise&&current===activeFinalise.frame,'CURRENT_TOTAL_WON_CALLBACK');
  if(event.type===Event.FREE_SPINS_GAME_EXIT_TRANSITION_START)mediator.onFreeSpinsExitTransitionStart();
  else{need(event.type===Event.FREE_SPINS_SHOW_TOTAL_WON_COMPLETE,'NATIVE_TOTAL_WON_COMPLETE');
   exitCommand.call({doGlobalDispatch(e){
    if(e.type===Event.FREE_SPINS_FINALISE_TOTAL_WON){need(!activeFinalise.ready,'ONE_NATIVE_FINALISE_READY');
     activeFinalise.ready=true;activeFinalise.resolve()}
    else need(e.type===Event.FREE_SPINS_RETURN_TO_BASE_GAME,'ORIGINAL_RETURN_TO_BASE');
   }});
  }
 };
 function stop(){closed=true;c.TweenLite.ticker.sleep();for(const timer of timers)clearTimeout(timer);timers.clear();
  if(activeFinalise&&!activeFinalise.ready)activeFinalise.reject(fault||Object.assign(new Error('OWN32793_NATIVE_ACTOR_CLOSED'),{retryAllowed:false}))}
 function open(){need(!closed&&!fault,'ACTOR_CLOSED_OR_FAULT_RETAINED')}
 function currentFrame(frame,round){
  open();need(source.has(frame)&&frame.game===game&&frame.sessionScope===sessionScope&&
   source.readCurrent(sessionScope,round)===frame&&source.readNormalCaptureMode()==='normal-capture','CURRENT_ACCEPTED_FRAME');
 }
 function document(frame){const doc=new DOM.DOMParser().parseFromString(frame.responsePayload,'text/xml');
  need(doc.documentElement?.nodeName==='GameResponse'&&!doc.getElementsByTagName('parsererror').length,'ACTUAL_XML');return doc}
 function nativeCall(fn){try{fn();writerCount++}catch(error){fault=error;stop();throw error}}
 return Object.freeze({
  acceptFrame(frame){
   currentFrame(frame,frame.roundScope);need(!seen.has(frame),'ONE_NATIVE_RESPONSE');
   const doc=document(frame);seen.add(frame);current=frame;
   if(frame.msgId==='Init'){
    need(!initFrame&&source.readInit(sessionScope)===frame,'ONE_ACCEPTED_INIT');
    initModel={};initParser.call({},doc,initModel);
    need(initModel.subInfo&&Number.isSafeInteger(initModel.subInfo.maxDepth)&&initModel.subInfo.maxDepth>0&&
     Number.isSafeInteger(initModel.subInfo.totalDepth)&&Number.isSafeInteger(initModel.subInfo.maxPressure)&&
     initModel.subInfo.maxPressure>0,'ACTUAL_INIT_DEPTH_PRESSURE_FIELDS');
    initFrame=frame;nativeCall(()=>mediator.initialiseFromInitResponse());
   }else if(frame.msgId==='Logic'){
    need(initFrame,'INIT_BEFORE_LOGIC');logicModel={};const nodes=doc.getElementsByTagName('SubInfo');
    need(nodes.length<=1,'ONE_SUBINFO');
    if(nodes.length)logicParser.call({},nodes[0],logicModel);
    if(logicModel.subInfo)for(const k of ['totalDepth','depthChange','totalPressure','pressureChange','symbolValue'])
     need(Number.isSafeInteger(logicModel.subInfo[k]),'ACTUAL_LOGIC_'+k);
    nativeCall(()=>mediator.updateSubInfoFromLogicResponse());
   }else need(frame.msgId==='EndGame','OWN_RESPONSE_TYPE');
  },
  afterOriginalMoney(frame,plan){
   currentFrame(frame,frame.roundScope);need(current===frame&&seen.has(frame)&&source.originalMoneyCommitted(frame)&&
    !moneySeen.has(frame)&&frame.msgId==='Logic','ONE_COMMITTED_NATIVE_LOGIC');moneySeen.add(frame);
   // Restoration is a control response. It does not create a display spin.
   if(plan.kind!=='restoration')nativeCall(()=>spinComplete.call({dispatchContextEvent(event){
    need(event.type===Event.SPIN_COMPLETE,'NATIVE_SPIN_COMPLETE');mediator.updatePressureGauge();
   }}));
   if(plan.kind==='enter-free'||plan.kind==='restoration'&&plan.event==='Logic')
    nativeCall(()=>mediator.onFreeSpinsEnterTransitionStart());
   if(plan.kind==='finalise'){
    need(!activeFinalise||activeFinalise.dispatched,'ONE_TOTAL_WON_LIFECYCLE');
    activeFinalise={frame,ready:false,dispatched:false};
    activeFinalise.promise=new Promise((resolve,reject)=>Object.assign(activeFinalise,{resolve,reject}));
    activeFinalise.promise.catch(()=>{});nativeCall(()=>totalWon.show());
   }
  },
  async waitFinaliseReady(frame){
   currentFrame(frame,frame.roundScope);need(activeFinalise?.frame===frame,'CURRENT_NATIVE_FINALISE_WAIT');
   nativeWaiters++;for(const timer of timers)timer.ref();
   try{await activeFinalise.promise;currentFrame(frame,frame.roundScope);need(activeFinalise.ready,'NATIVE_FINALISE_CALLBACK')}
   finally{nativeWaiters--;if(!nativeWaiters)for(const timer of timers)timer.unref()}
  },
  onFinaliseDispatched(dispatch){
   const frame=dispatch.originalResponseFrame;currentFrame(frame,dispatch.roundScope);
   need(source.hasDispatch(dispatch)&&dispatch.event==='Logic'&&dispatch.tailTicket&&
    current===frame&&moneySeen.has(frame)&&!finaliseSeen.has(frame)&&activeFinalise?.frame===frame&&
    activeFinalise.ready&&!activeFinalise.dispatched,'ONE_ORIGINAL_FINALISE_DISPATCH');
   finaliseSeen.add(frame);
   activeFinalise.dispatched=true;
  },
  takePayloads(ctx){
   currentFrame(ctx.originalResponseFrame,ctx.roundScope);
   need(ctx.game===game&&ctx.sessionScope===sessionScope&&ctx.roundScope&&current===ctx.originalResponseFrame&&
    initFrame&&source.readInit(sessionScope)===initFrame,'REQUEST_CURRENT_NATIVE_ACTOR');
   if(current.msgId==='Logic')need(source.originalMoneyCommitted(current)&&moneySeen.has(current),'REQUEST_AFTER_MONEY_AND_NATIVE_WRITERS');
   let frames=requests.get(ctx.roundScope);if(!frames){frames=new WeakSet();requests.set(ctx.roundScope,frames)}
   need(!frames.has(current),'REQUEST_LATCH_ALREADY_RETAINED');frames.add(current);
   const encoders=[];
   // This is the actual synchronous native call, including its live direction
   // branch and single depth getter. Raw SubInfo is never used to skip it.
   try{
    server.addCustomPayloads(encoders);need(encoders.length<=1,'OWN_NATIVE_PAYLOAD_COUNT');
    for(const encoder of encoders){need(encoder instanceof c.game.NemoAscensionPayload&&
     Number.isSafeInteger(encoder._depth)&&encoder._depth>=0,'NATIVE_LATCHED_DEPTH');Object.freeze(encoder)}
    currentFrame(ctx.originalResponseFrame,ctx.roundScope);requestCount++;
    return Object.freeze(encoders);
   }catch(error){fault=error;stop();throw error}
  },
  seal(error){if(error&&!fault)fault=error;stop()},
  status(){return {closed,faultRetained:!!fault,acceptedInit:!!initFrame,writerCount,requestCount,
   nativeDirection:view.isDescending,nativeDepthY:view._submarineDepthBitmap.y,
   nativeDepth: initFrame?view.submarineDepth:null,nativeClockTime:c.TweenLite.ticker.time,
   nativeAscensionInProgress:view._ascensionTweenInProgress,
   nativeTweenPaused:!!view._submarineDepthTween?.paused(),nativeTransitionDuration:transition.transitionDuration,
   nativeFinaliseReady:!!activeFinalise?.ready,
   newHTTP:0,newDB:0,productionOrFinalCredit:false}}
 });
};
