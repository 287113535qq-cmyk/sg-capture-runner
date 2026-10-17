// Own post-spin callback seam only. It cannot choose a protocol terminal or send a request.
import assert from 'node:assert/strict';
import {installOwn32727NativeHDSoundAndShortCelebrationDATA123} from './own32727-native-HD-sound-and-ShortCelebration-DATA-v123.mjs';
import {installOwn32727NativeFreeNextStatesDATA5} from './own32727-native-free-next-state-core-DATA-v5.mjs';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const read=name=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const producers=read('Medusa-own-native-feature-producers-DATA-v2/own32727-native-feature-producers-private.json');
const callbacks=read('Medusa-own-native-game-callbacks-DATA-v1/own32727-native-game-callbacks-private.json');
const hooks=read('classic-two-own-game-hooks-DATA-v2/32727-own-game-hooks-private.json');
const notifySource=read('Medusa-own-native-notify-DATA-v1/own32727-native-notify-private.json');
const initSource=read('classic-Medusa-native-Init-DATA-v2/own32727-native-Init-functions-private.json');
assert(producers.retainedSDKSourceSHA256===callbacks.retainedSDKSourceSHA256&&callbacks.retainedSDKSourceSHA256===hooks.retainedSourceSHA256);
export function createOwn32727NativePostSpinAndFreeNextDATA17({originalSessionScope,originalRoundScope,nativeInitModel,originalPaidRequestReceipt,nativeSlotGameModel,actualDrawingPorts,maxLocalCallbacks}){
 assert(originalSessionScope&&originalRoundScope&&nativeInitModel.gameId==='32727'&&nativeInitModel.originalSessionScope===originalSessionScope);
 assert(nativeSlotGameModel.account===nativeInitModel.nativeInitAccount.account&&nativeSlotGameModel.freeRounds===nativeInitModel.nativeFreeRounds,'Actual own initialized native model required');
 assert(Number.isSafeInteger(maxLocalCallbacks)&&maxLocalCallbacks>0);
 assert(typeof nativeSlotGameModel.fireEvent==='function'&&typeof nativeSlotGameModel.moduleFactory?.getSymbolModule==='function'&&typeof nativeSlotGameModel.winManager?.getWinLevel==='function'&&typeof nativeSlotGameModel.winManager?.preStartWin==='function','Actual native model consumers required');
 const ports=actualDrawingPorts;
 assert(typeof ports?.addToContainer==='function'&&typeof ports.NovaContainer==='function'&&typeof ports.NovaGraphics==='function'&&ports.Back&&typeof ports.TweenMax?.delayedCall==='function'&&typeof ports.TweenMax.to==='function','Explicit drawing-only callback ports required');
 let closed=false,activeFrame,sourceOwner,awaitingRequest,callbackCount=0,activeState;
 const nativeEvents=[],ownedEvents=new WeakSet(),consumedEvents=new WeakSet();
 const current=()=>{assert(!closed,'Own Medusa callback seam closed');nativeInitModel.assertCurrent();};
 const frameCurrent=()=>{current();assert(activeFrame&&sourceOwner.has(activeFrame)&&sourceOwner.read(originalSessionScope,originalRoundScope)===activeFrame,'Current own successful source frame required');assert(++callbackCount<=maxLocalCallbacks,'Own post-spin callback budget reached; diagnosis='+JSON.stringify({schema:'own32727-passive-native-state-at-retained-hold-v70',callbackCount,nativeState:model.stateNames?.[model.currentState],nativeEventCount:nativeEvents.length,lastNativeEvents:nativeEvents.slice(-20).map(r=>r.event),cartRunning:cart.isRunning(),cascadeRunning:cascade.isRunning()}));};
 const model=nativeSlotGameModel;
 let originalFireEvent=model.fireEvent;
 const fireEvent=(...args)=>{
  frameCurrent();
  const record=Object.freeze({event:args[0],parameters:args.slice(1),sourceFrame:activeFrame,originalSessionScope,originalRoundScope});
  ownedEvents.add(record);nativeEvents.push(record);
 };
 const abortNative=(error)=>{nativeCore.close();closed=true;activeFrame=sourceOwner=activeState=undefined;throw error;};
 const guardCallback=callback=>{assert(typeof callback==='function');return function(...args){try{frameCurrent();return Reflect.apply(callback,this,args);}catch(error){return abortNative(error);}};};
 const nativeTween={...ports.TweenMax,
  delayedCall(delay,callback,args,scope,...rest){return ports.TweenMax.delayedCall(delay,guardCallback(callback),args,scope,...rest);},
  to(target,delay,properties){return ports.TweenMax.to(target,delay,properties.onComplete?{...properties,onComplete:guardCallback(properties.onComplete)}:properties);},
  fromTo(target,delay,from,to){return ports.TweenMax.fromTo(target,delay,from,to.onComplete?{...to,onComplete:guardCallback(to.onComplete)}:to);}
 };
 const controller={slotGame:model,playSound:(...args)=>ports.recordSound(...args),playMedusasGazeSound:(...args)=>ports.recordSound('medusasGaze',...args)};
 const context=createContext({game:controller,self:controller,NOVA:{config:nativeInitModel.nativeConfigRecord.config,addToContainer:ports.addToContainer},ENUM:{},TweenMax:nativeTween,TimelineMax:ports.TimelineMax,i:undefined,NovaContainer:ports.NovaContainer,NovaGraphics:ports.NovaGraphics,Back:ports.Back,backgroundAnims:ports.backgroundAnims,introPanel:ports.introPanel,summaryPanel:ports.summaryPanel,gameSound:ports.gameSound,utility:ports.utility,PIXI:ports.PIXI,NovaLoader:ports.NovaLoader,Power2:ports.Power2,Power3:ports.Power3,Power4:ports.Power4});
 const compile=source=>runInContext('('+source+')',context,{timeout:1000});
 for(const row of producers.enums)context.ENUM[row.name]=compile(row.source);
 Object.assign(context.ENUM,{XC_NULL:-1,XC_SKIP_DEFAULT:-2,RUN_DEFAULT_ENTER:-1,SKIP_DEFAULT_ENTER:-2});
 for(const row of callbacks.nativeInitializers)runInContext('var '+row.source+';',context);
 for(const name of ['cascadeCompleted','celebrationCompleted','winSymbolChoreography','freeGameIntroChoreography','freeGameSummaryChoreography','introPanelClose','summaryPanelClose','playRetrigger','playBigWinCelebration','playShortWinCelebration'])controller[name]=compile(callbacks.rows.find(row=>row.name===name).source);
 const nativeCtor=name=>compile(producers.rows.find(row=>row.name===name).source);
 const cart=Reflect.construct(nativeCtor('CartReelFeature'),[]);
 const featureManager=Reflect.construct(nativeCtor('FeatureManager'),[]);
 const snake=Reflect.construct(nativeCtor('SnakeStrike'),[]),gaze=Reflect.construct(nativeCtor('MedusasGaze'),[]),cascade=Reflect.construct(nativeCtor('CascadeReel'),[]);
 featureManager.init(snake,gaze);
 const EventGate=nativeCtor('EventGate');context.EventGate=EventGate;
 const featureGate=Reflect.construct(EventGate,[featureManager.playNextFeature,2]);
 Object.assign(context,{cartFeature:cart,featureManager,snakeStrikeFeature:snake,medusasGazeFeature:gaze,featureGate,cascadeFeature:cascade});
 const paidReelDATA=read('Medusa-paid-reel-state-continuation-v28/own32727-paid-reel-state-selected-private.json');for(const r of paidReelDATA.rows.filter(r=>r.kind==='initializer'))runInContext('var '+r.source+';',context);for(const r of read('Medusa-own-native-Reel-execution-DATA-v5/own32727-native-Reel-additional-private.json').rows.filter(r=>r.kind==='enum'))context.ENUM[r.selector]=compile(r.source);

 // The native API handler and native cart callbacks share this same source realm.
 const apiEnter=compile(hooks.functions.find(row=>row.target==='this.slotGame.api_enter').source);
 const apiEvent=compile(hooks.functions.find(row=>row.target==='this.slotGame.api_handleEvent').source);
 const parseContext=createContext({self:model,NOVA:{config:nativeInitModel.nativeConfigRecord.config,currency:nativeInitModel.nativeCurrency},ENUM:context.ENUM});
 model.dateFix=runInContext('('+initSource.functions.find(row=>row.name==='dateFix').source+')',parseContext,{timeout:1000});
 const parseNative=runInContext('('+initSource.functions.find(row=>row.name==='parseGameMessage').source+')',parseContext,{timeout:1000});
 // Only the drawing callback receives this wrapper. No public raw-event injector is exported.
 const nativeCore=installOwn32727NativeFreeNextStatesDATA5({model,controller,gameContext:context,compileGame:compile,apiEnter,apiEvent,nativeTween,nativeInitModel,originalPaidRequestReceipt,originalRoundScope,ports,assertCurrent:frameCurrent,readCurrentFrame(){frameCurrent();return activeFrame;},maxLocalCallbacks});
 originalFireEvent=model.fireEvent;
 const cartModel=Object.create(model);cartModel.fireEvent=fireEvent;cartModel.moduleFactory=model.moduleFactory;controller.slotGame=cartModel;
 cart.init();
 assert(typeof ports.utility?.getMC==='function'&&typeof ports.recordSound==='function'&&typeof ports.PIXI?.spine?.Spine==='function','Native feature drawing dependencies required');
 assert(typeof model.reelManager?.setSymbol==='function'&&typeof model.reelManager?.setNumVisibleSymbols==='function','Actual native reel model mutations required');
 // These source constructors are initialized in the own Game init in this order.
 // Sprite/spine operations receive drawing ports; only own source callbacks emit events.
 cartModel.api_notify=compile(notifySource.rows[0].source);
 model.api_notify=cartModel.api_notify;const modelScope=createContext({self:model});model.getCurrentState=runInContext('('+paidReelDATA.rows.find(r=>r.selector==='this.getCurrentState').source+')',modelScope);controller.setMegaways=(...args)=>ports.recordDisplay('setMegaways',...args);controller.setMegawaysTotal=(...args)=>ports.recordDisplay('setMegawaysTotal',...args);controller.forceAllSymbolsAlpha=(...args)=>ports.recordDisplay('forceAllSymbolsAlpha',...args);
 context.NOVA.getTexture=ports.getTexture;context.NOVA.getSprite=ports.getSprite;context.NOVA.getContainer=ports.getContainer;
 context.NOVA.isHD=ports.isHD;context.NOVA.isSD=ports.isSD;
 installOwn32727NativeHDSoundAndShortCelebrationDATA123({context,compile,nativeInitModel,model,controller,ports});
 snake.init(cart);gaze.init();cascade.init();

 return Object.freeze({
  acceptCurrentNativeResponse({frame,source}){
   current();if(activeFrame)assert(awaitingRequest&&awaitingRequest.originalResponseFrame===activeFrame&&frame!==activeFrame&&frame.ordinal>activeFrame.ordinal&&frame.step?.msgId===awaitingRequest.event,'Own next successful frame must answer the one accepted native request');else assert(!awaitingRequest,'Own initial response cannot answer a follow-up');
   assert(frame?.sessionScope===originalSessionScope&&frame.roundScope===originalRoundScope&&frame.game===nativeInitModel.originalFactoryInitFrame.game&&typeof source?.has==='function'&&typeof source.read==='function'&&source.has(frame)&&source.read(originalSessionScope,originalRoundScope)===frame,'Original successful own frame association required');
   assert(typeof frame.step?.responsePayload==='string');
   const fields=new Map();for(const pair of frame.step.responsePayload.split('&')){const at=pair.indexOf('=');if(at>0)fields.set(pair.slice(0,at),pair.slice(at+1));}
   assert(fields.has('AB')&&fields.has('B')&&fields.has('TW'),'Original required financial response fields absent');
   activeFrame=frame;sourceOwner=source;awaitingRequest=undefined;
   const response=Reflect.apply(parseNative,model,[frame.step.responsePayload.split('&')]);assert(!response.inRecovery,'Native recovery remains unmapped');
   model.serverResponse=response;cartModel.serverResponse=response;
   featureManager.saveFeatures(response.gsd.fieldValues);
   return response;
  },
  acceptOwnPaidResponseThroughNativeState(){try{frameCurrent();return nativeCore.acceptOwnPaidResponseThroughNativeState(model.serverResponse);}catch(error){return abortNative(error);}},
  enterOwnSourcePostSpin(){try{frameCurrent();return nativeCore.enterOwnPostSpin(model.serverResponse);}catch(error){return abortNative(error);}},
  readSelectedNativeRequest(){frameCurrent();return nativeCore.readSelectedNativeRequest();},
  acceptSelectedNativeRequest(request){frameCurrent();assert(!awaitingRequest,'Own native request already sent');const result=nativeCore.acceptSelectedNativeRequest(request);awaitingRequest=request;return result;},
  acceptOwnFollowUpResponseThroughNativeState(request){try{frameCurrent();return nativeCore.acceptOwnFollowUpResponseThroughNativeState(model.serverResponse,request);}catch(error){return abortNative(error);}},
  readNativeCoreResult(){frameCurrent();return nativeCore.readResult();},
  enterOwnBasePostSpin(){
   frameCurrent();const state={id:context.ENUM.gameState.BASE_POST_SPIN,cfg:{}};activeState=state;
   const result=Reflect.apply(apiEnter,controller,[state]);
   assert(result===context.ENUM.SKIP_DEFAULT_ENTER,'Own native post-spin override changed');
   return Object.freeze({nativeState:state.id,nativeExit:result,nativeEndClaimed:false});
  },
  enterOwnFreePostSpin(){
   frameCurrent();assert(model.serverResponse.inFreeGames,'Actual native free response required');
   const state={id:context.ENUM.gameState.FREEGAME_POST_SPIN,cfg:{}};activeState=state;
   const result=Reflect.apply(apiEnter,controller,[state]);
   assert(result===context.ENUM.SKIP_DEFAULT_ENTER,'Own native free post-spin override changed');
   return Object.freeze({nativeState:state.id,nativeExit:result,nativeEndClaimed:false});
  },
  startOwnSecondaryReelFromDecodedGSD(){
   frameCurrent();const srs=model.serverResponse.gsd.fieldValues.SRS;assert(typeof srs==='string','Actual own decoded SRS required');
   cart.saveStops(srs);cart.play();
  },
  readNextOwnedNativeEvent(){frameCurrent();return nativeEvents.find(record=>!consumedEvents.has(record));},
  consumeOwnedNativeEvent(record){
   frameCurrent();assert(ownedEvents.has(record)&&!consumedEvents.has(record)&&record.sourceFrame===activeFrame&&nativeEvents.find(value=>!consumedEvents.has(value))===record,'Actual one-use native callback record required');
   consumedEvents.add(record);
   try{return Reflect.apply(originalFireEvent,model,[record.event,...record.parameters]);}catch(error){return abortNative(error);}
  },
  close(){closed=true;nativeCore.close();activeFrame=sourceOwner=activeState=undefined;},
  sourceOnly:true,nativeEndClaimed:false,wholeNativeNextEndReady:false,sourceRequests:0,productionAdmission:false
 });
}
