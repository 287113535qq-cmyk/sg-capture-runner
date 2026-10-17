// Installs own cached native states into the same private Game callback realm.
// This emits request DATA; it never dispatches a provider request.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const read=name=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const states=read('Medusa-own-native-state-callback-DATA-v1/own32727-native-state-callback-private.json');
const table=read('classic-two-native-next-state-table-DATA-private.json').find(r=>r.gameId==='32727');
const deps=read('Medusa-own-native-free-next-dependencies-DATA-v1/own32727-native-free-next-dependencies-private.json');
const recovery=read('Medusa-own-native-recovery-callback-DATA-v1/own32727-native-recovery-callback-private.json');
const bigwin=read('Medusa-own-native-startBigWin-DATA-v1/own32727-native-startBigWin-private.json');
const callbacks=read('Medusa-own-native-game-callbacks-DATA-v1/own32727-native-game-callbacks-private.json');
export function installOwn32727NativeFreeNextStatesDATA5({model,controller,gameContext,compileGame,apiEnter,apiEvent,nativeTween,nativeInitModel:init,originalPaidRequestReceipt:paid,originalRoundScope,ports,assertCurrent,readCurrentFrame,maxLocalCallbacks}){
 assert(paid?.nativeRoundOpened===true&&paid.account===model.account&&paid.originalSessionScope===init.originalSessionScope&&paid.originalRoundScope===originalRoundScope,'Actual own native paid round required');
 let closed=false,started=false,pending,message,awaitingRequest,operations=0;
 const signals=[],transitions=[],requests=[],taken=new WeakSet();
 const current=()=>{assert(!closed,'Own native free next state core closed');init.assertCurrent();assertCurrent();assert(++operations<=maxLocalCallbacks,'Own native state operation bound reached');};
 const NOVA=gameContext.NOVA,ENUM=gameContext.ENUM;
 NOVA.paused=false;NOVA.debug={debugScreen:{}};
 NOVA.startMsg=event=>{current();assert(!message&&!pending,'Own native request already pending');message={event,parameters:{}};};
 NOVA.addToMsg=(key,value)=>{current();assert(message&&value!==undefined&&!Object.hasOwn(message.parameters,key),'Actual own native request field required');message.parameters[key]=value;};
 NOVA.sendMsg=()=>{current();assert(message&&['FREE_GAME','FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(message.event),'Own native request caller remains unmapped');pending=Object.freeze({event:message.event,parameters:Object.freeze({...message.parameters}),originalSessionScope:paid.originalSessionScope,originalRoundScope:paid.originalRoundScope,originalResponseFrame:readCurrentFrame()});requests.push(pending);message=undefined;};
 controller.addFGmeterDelay=(...args)=>ports.recordDisplay('addFGmeterDelay',...args);
 controller.showBuyPass=(...args)=>ports.recordDisplay('showBuyPass',...args);
 controller.updateBuyPass=(...args)=>ports.recordDisplay('updateBuyPass',...args);
 controller.enableBuyPass=(...args)=>ports.recordDisplay('enableBuyPass',...args);
 for(const row of [...deps.rows,...recovery.rows,...bigwin.rows,callbacks.rows.find(r=>r.name==='isReactionSpin')])controller[row.name]=compileGame(row.source);
 Object.assign(gameContext,{showMegawaysContainer:(...args)=>ports.recordDisplay('showMegawaysContainer',...args),fgMeters:ports.fgMeters});
 for(const row of deps.nativeInitializers)runInContext('var '+row.source+';',gameContext);
 model.states={};model.stateNames={};model.roundActive=paid.nativeRoundOpened;model.resultShown=false;model.inRecovery=false;model.returnFromGamble=false;model.bReportTotalWin=false;
 model.freeGameIdleSpinDelay=NOVA.config.game.freeGamesAutoplayDelay;
 model.debugUI={setDebugString:value=>ports.recordDisplay('nativeState',value)};
 const env={self:model,game:controller,NOVA,ENUM,TweenMax:nativeTween,TweenLite:nativeTween,wrapperAPI:(...args)=>{current();signals.push(args);},bDontStopAutoplay:false,lowBalanceShown:false,lastWin:undefined,lastExitCode:-1,quickStopFired:false,timeSpinStarted:undefined,
  METRICS:{...init.nativeMetrics,addSpin:(...args)=>ports.recordDisplay('nativeMetric.addSpin',...args),startFPS(){},stopFPS(){}}};
 const context=createContext({...env,Date:ports.nativeDate??Date}),compile=source=>runInContext('('+source+')',context,{timeout:1000});
 model.nextStateTable=compile(table.nextStateTableSource);
 for(const row of states.rows.filter(r=>r.name.endsWith('State'))){const name=row.name,key=name.replace(/State$/,'').replace(/^FreeGame/,'Freegame').replace(/([a-z])([A-Z])/g,'$1_$2').toUpperCase(),id=ENUM.gameState[key];assert(Number.isInteger(id));assert(!model.states[id],'Duplicate own native state');model.states[id]=Reflect.construct(compile(row.source),[id]);model.stateNames[id]=key;}
 model.fireEvent=compile(states.rows.find(r=>r.name==='fireEvent').source);
 context.EventGate=compile(read('Medusa-own-native-feature-producers-DATA-v2/own32727-native-feature-producers-private.json').rows.find(r=>r.name==='EventGate').source);
 const ownWingate=readFileSync(new URL('../Medusa-own-native-Win-callbacks-DATA-v33/wingate-window-private.js',import.meta.url),'utf8').split(',reelgate=')[0];
 runInContext('var '+ownWingate+';',context);
 model.winCompleted=compile(states.rows.find(r=>r.name==='winCompleted').source);
 model.winManNotify=compile(read('Medusa-own-native-Win-callbacks-DATA-v33/own32727-native-Win-callbacks-private.json').rows.find(r=>r.name==='this.winManNotify').source);
 model.api_enter=state=>{current();assert(state&&model.states[state.id]===state,'Own native state missing');transitions.push(model.stateNames[state.id]);return Reflect.apply(apiEnter,controller,[state]);};
 model.api_handleEvent=(state,event,param)=>{current();assert(state&&model.states[state.id]===state,'Own current native state missing');return Reflect.apply(apiEvent,controller,[state,event,param]);};
 return Object.freeze({
  acceptOwnPaidResponseThroughNativeState(response){current();assert(!started&&model.serverResponse===response&&paid.nativeSlotGameModel===model&&paid.nativeStartingState?.id===ENUM.gameState.BASE_SPINNING_START,'Actual original paid native state handoff required');assert(paid.nativeTimeSpinStarted&&Number.isFinite(Number(paid.nativeTimeSpinStarted)),'Actual paid native clock timestamp required');started=true;context.timeSpinStarted=paid.nativeTimeSpinStarted;model.currentState=paid.nativeStartingState.id;model.states[model.currentState]=paid.nativeStartingState;model.stateNames[model.currentState]='BASE_SPINNING_START';return model.fireEvent('MSG');},
  enterOwnPostSpin(response){current();assert(!started&&model.serverResponse===response,'Own post-spin entry already consumed');started=true;model.currentState=response.inFreeGames?ENUM.gameState.FREEGAME_POST_SPIN:ENUM.gameState.BASE_POST_SPIN;const state=model.states[model.currentState];if(model.api_enter(state)===ENUM.RUN_DEFAULT_ENTER)state.enter();},
  acceptOwnFollowUpResponseThroughNativeState(response,request){current();assert(started&&model.serverResponse===response&&request===awaitingRequest&&taken.has(request)&&!pending&&request.event==='FREE_GAME'&&model.stateNames[model.currentState]==='FREEGAME_SPINNING_START','Own native follow-up response state/request is unmapped');awaitingRequest=undefined;return model.fireEvent('MSG');},
  readSelectedNativeRequest(){current();assert(pending&&!taken.has(pending),'Actual own pending native next request required');return pending;},
  acceptSelectedNativeRequest(request){current();assert(request===pending&&!taken.has(request)&&request.originalResponseFrame===readCurrentFrame(),'Own one-use native next request changed');taken.add(request);pending=undefined;awaitingRequest=request;},
  readResult(){current();return Object.freeze({nativeState:model.stateNames[model.currentState],nativeRoundCloseObserved:signals.some(r=>r[0]==='ROUND'&&r[1]===0),nativeResultShownObserved:signals.some(r=>r[0]==='RESULT_SHOWN'),nativeRoundActiveAfter:model.roundActive,pendingNativeRequest:pending,nativeSignals:signals.slice(),nativeStates:transitions.slice(),nativeRequestCount:requests.length,nativeAccountBalance:model.account.getBalance(),nativeAccountWin:model.account.getWin(),wholeNextEndReady:false,productionAdmission:false,sourceRequests:0});},
  close(){closed=true;pending=message=undefined;}
 });
}
