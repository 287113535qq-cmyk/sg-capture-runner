// Selected own native BET callers only. The original AG remains the sole sender.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const load=(gid,name)=>JSON.parse(readFileSync(new URL('../'+name+'/'+gid+(name==='classic-two-paid-caller-DATA'?'-paid-caller-private.json':'-own-game-hooks-private.json'),import.meta.url),'utf8'));
const required=(o,k)=>{assert(o&&Object.hasOwn(o,k)&&o[k]!==undefined,'Actual native input missing: '+k);return o[k];};
const noop=()=>{};
export function buildOwnClassicPaidRequestDATA3({gameId,originalSessionScope,originalRoundScope,nativeInitAccount,actualNativeGameConfig,actualNativeFreeRounds,actualNativeEnums,nativeDebug,nativeRoundActive,nativeLastWin,nativeSlotBetGSD,nativeGameController,actualNativeUIDConfig,nativeDecodedResponse,actualNativeSlotGameModel,actualNativeDrawingDate}){
 assert(['32536','32727'].includes(gameId)&&originalSessionScope&&originalRoundScope);
 assert(nativeInitAccount.gameId===gameId&&nativeInitAccount.originalSessionScope===originalSessionScope,'Original initialized account scope changed');
 assert(typeof nativeRoundActive==='boolean'&&!nativeRoundActive,'Original paid round must not already be active');
 // Prior display win is not a request or money admission gate.
 assert(typeof nativeSlotBetGSD==='string'&&nativeDebug&&actualNativeEnums,'Actual native request state required');
 const account=nativeInitAccount.account;assert(typeof account.takeBet==='function');
 const data=load(gameId,'classic-two-paid-caller-DATA'),hooks=load(gameId,'classic-two-own-game-hooks-DATA-v2');
 assert(data.retainedSDKSourceSHA256===hooks.retainedSourceSHA256,'Own native source scope changed');
 const messages=[],signals=[];let current;
 const NOVA={config:{game:actualNativeGameConfig},debug:nativeDebug,startMsg(event){assert(!current);current={event,parameters:{}};},addToMsg(k,v){assert(current&&v!==undefined&&!Object.hasOwn(current.parameters,k),'Actual native parameter required');current.parameters[k]=v;},sendMsg(){assert(current);messages.push(current);}};
 const self=actualNativeSlotGameModel??{account,freeRounds:actualNativeFreeRounds,roundActive:nativeRoundActive,betGSD:nativeSlotBetGSD,
  winManager:{stopWin:noop},reelManager:{hideEffectsLayerSlots:noop,startSpin:noop},
  ui:{setRound:noop,autoplay:{inAutoplay:false},canQuickStop:noop},
  metersManager:{balanceMeter:{setValue:noop,snapTo:noop},winMeter:{isVisible:()=>false,show:noop,snapTo:noop,setValue:noop,hide:noop}},
  messageBar:{displayWinText:noop,showLeftText:noop,hideIdle:noop,idle:noop}};
 if(actualNativeSlotGameModel)assert(gameId==='32727'&&self.account===account&&self.freeRounds===actualNativeFreeRounds&&self.roundActive===nativeRoundActive,'Same original native paid model required');
 const context=createContext({Date:actualNativeDrawingDate??Date,self,NOVA,ENUM:actualNativeEnums,wrapperAPI:(...args)=>signals.push(args),
  METRICS:{addSpin:noop},TweenMax:{killTweensOf:noop},lastWin:nativeLastWin,lowBalanceShown:undefined,timeSpinStarted:undefined,console:{warn:noop}});
 const row=data.functions.find(x=>x.name==='BaseSpinningStartState');
 const ctor=runInContext('('+row.source+')',context,{timeout:1000}),state=Reflect.construct(ctor,[required(actualNativeEnums.gameState,'BASE_SPINNING_START')]);
 if(gameId==='32536'){
  assert(nativeGameController&&typeof required(nativeGameController,'betGSD')==='string','Actual own controller request state required');
  required(nativeDecodedResponse,'utc'); // Own decoder always creates utc; missing iso follows native Invalid Date branches.
  const uid=required(actualNativeUIDConfig,'uid');required(uid,'nj');
  const controller=nativeGameController;controller.slotGame=self;self.serverResponse=nativeDecodedResponse;
  NOVA.config.uid=uid;
  const own=createContext({self:controller,game:controller,NOVA,ENUM:actualNativeEnums,island_main:{updateInfoPage:noop},console:{log:noop},p1available:undefined,p2available:undefined});
  controller.checkPatchStatus=runInContext('('+data.functions.find(x=>x.name==='checkPatchStatus').source+')',own,{timeout:1000});
  const hook=runInContext('('+hooks.functions.find(x=>x.target==='this.slotGame.api_enter').source+')',own,{timeout:1000});
  assert(Reflect.apply(hook,controller,[state])===actualNativeEnums.RUN_DEFAULT_ENTER,'Own paid entry selected a different native path');
 }
 Reflect.apply(state.enter,state,[]);
 assert(messages.length===1&&messages[0].event==='BET','Own native BET caller required');
 return Object.freeze({gameId,originalSessionScope,originalRoundScope,event:'BET',parameters:Object.freeze({...messages[0].parameters}),account,
  nativeStartingState:state,nativeTimeSpinStarted:context.timeSpinStarted,nativeSlotGameModel:self,
  nativeRoundOpened:signals.some(x=>x[0]==='ROUND'&&x[1]===1),nativeAccountBalanceAfterSelection:account.getBalance(),sourceFragmentSHA256:row.fragmentSHA256,
  actualNativeRequestOriginalFactoryAssociationStillRequired:true,sourceRequests:0,providerACKClaimed:false,productionAdmission:false});
}
