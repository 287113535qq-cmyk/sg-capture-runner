// Own native paid-state/Reel/Manager/EventGate machine. Original SG alone sends wire requests.
import assert from 'node:assert/strict';
import {createOwn32727NativeWinManagerCompletionDATA84} from './own32727-native-WinManager-completion-DATA-v84.mjs';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createOwn32727DrawingPortsDATA} from './own32727-native-drawing-ports-DATA-v1.mjs';
import {createOwn32727NativeReelCompletionDATA18} from './own32727-native-Reel-completion-DATA-v18.mjs';
import {createOwn32727NativePostSpinAndFreeNextDATA17} from './own32727-native-postspin-and-free-next-DATA-v17.mjs';
import {buildOwnClassicPaidRequestDATA3} from '../classic-two-free-native-DATA-v1/own-classic-paid-native-DATA-v3-private.mjs';
const data=JSON.parse(readFileSync(new URL('../Medusa-own-native-feature-producers-DATA-v2/own32727-native-feature-producers-private.json',import.meta.url),'utf8'));
const enumContext=createContext({}),enums=Object.fromEntries(data.enums.map(r=>[r.name,runInContext('('+r.source+')',enumContext)]));enums.RUN_DEFAULT_ENTER=-1;
export function createOwn32727NativePaidRoundMachineDATA22({originalSessionScope:session,originalRoundScope:round,originalNativeInitData:init,originalNativeReelstripData:strips}){
 init.assertCurrent();assert(init.gameId==='32727'&&init.originalSessionScope===session&&strips.originalSessionScope===session&&!init.nativeFreeRounds.isInFreeRounds(),'Own native paid scope only; promotional initial path unmapped');
 const draw=createOwn32727DrawingPortsDATA(),model={account:init.nativeInitAccount.account,freeRounds:init.nativeFreeRounds,featureData:{},roundActive:false,betGSD:''};
 let closed=false,frame,sourceOwner,seam,consumed=false;const seen=new WeakSet();
 const current=()=>{assert(!closed,'Own Medusa paid round machine closed');init.assertCurrent();if(frame)assert(sourceOwner?.has(frame)&&sourceOwner.read(session,round)===frame,'Own successful source frame revoked');};
 const display=(...args)=>draw.ports.recordDisplay(...args);
 draw.ports.introPanel.show=(...args)=>display('introPanel.show',...args);
 // Source WINTUNE_SOUND consumes no return or gameplay completion.
 draw.ports.gameSound.playWintune=(...args)=>display('gameSound.playWintune',...args);
 for(const name of ['stopWinSounds','fadeDiamondShower','fadeShortWin','muteAmbientSound','unmuteAmbientSound','playAmbientFreeGame'])draw.ports.gameSound[name]=(...args)=>{display('gameSound.'+name,...args);};
 model.fireEvent=()=>{throw Error('Own native state core not yet installed');};model.api_notify=display;model.getCurrentState=()=>model.currentState;
 model.ui={enableQuickStop:display,setWin:display,setRound:display,showLowBalanceDialogs:()=>false,setGameUIDisable:display,cancelAutoplay:display,canSpinAutoplay:()=>false,canContinue:display,canQuickStop:display,autoplay:{inAutoplay:false}};
 const meter={visible:false,isVisible(){return this.visible;},setValue:display,snapTo:display,setTuneDelay:display,resetTuneDelay:display,reset:display,hide(){this.visible=false;},show(){this.visible=true;}};
 model.metersManager={winMeter:meter,balanceMeter:{setValue:display,snapTo:display}};
 model.messageBar={displayWinText:display,showLeftText:display,setLeftText:display,setLeftValue:display,showRightText:display,setRightText:display,setRightValue:display,idle:display,hideIdle:display};
 model.winManager={stopWin:display};
 const reels=createOwn32727NativeReelCompletionDATA18({nativeInitModel:init,nativeReelstripData:strips,nativeSlotGameModel:model,actualDrawingPorts:draw.ports,assertCurrent:current,maxTicks:5000,maxCallbacks:50000});
 model.reelManager=reels.nativeManager;model.moduleFactory=reels.nativeManager.moduleFactory;draw.ports.TweenMax=reels.nativeTweenMax;draw.ports.TimelineMax=reels.nativeTimelineMax;draw.ports.nativeDate=reels.nativeDate;draw.ports.gameSound.fadeDiamondShower=(...args)=>display('gameSound.fadeDiamondShower',...args);model.winManager=createOwn32727NativeWinManagerCompletionDATA84({nativeInitModel:init,nativeSlotGameModel:model,actualDrawingPorts:draw.ports});
 let paid;
 try{paid=buildOwnClassicPaidRequestDATA3({gameId:'32727',originalSessionScope:session,originalRoundScope:round,nativeInitAccount:init.nativeInitAccount,actualNativeGameConfig:init.nativeConfigRecord.config.game,actualNativeFreeRounds:init.nativeFreeRounds,actualNativeEnums:enums,nativeDebug:{debugScreen:{}},nativeRoundActive:false,nativeSlotBetGSD:'',actualNativeSlotGameModel:model,actualNativeDrawingDate:reels.nativeDate});
 seam=createOwn32727NativePostSpinAndFreeNextDATA17({originalSessionScope:session,originalRoundScope:round,nativeInitModel:init,originalPaidRequestReceipt:paid,nativeSlotGameModel:model,actualDrawingPorts:draw.ports,maxLocalCallbacks:5000});
 }catch(error){reels.close();closed=true;throw error;}
 function close(){if(closed)return;closed=true;try{seam.close();}finally{reels.close();}}

 let awaitingRequest,lastResult;
 function consume(source){try{
  assert(!closed,'Own Medusa native round machine closed');init.assertCurrent();
  assert(typeof source.read==='function'&&typeof source.has==='function');const next=source.read(session,round);
  assert(source.has(next)&&next.sessionScope===session&&next.roundScope===round&&!seen.has(next),'Own original current successful frame required');
  const follow=consumed,priorRequest=awaitingRequest;
  if(follow)assert(priorRequest&&priorRequest.originalResponseFrame===frame&&next!==frame&&next.ordinal>frame.ordinal&&next.step.msgId===priorRequest.event,'Own one accepted native follow-up request must own the next response');
  else assert(next.step.msgId==='BET','Own initial paid ACK required');
  seen.add(next);sourceOwner=source;frame=next;consumed=true;
  const response=seam.acceptCurrentNativeResponse({frame,source});
  if(follow){seam.acceptOwnFollowUpResponseThroughNativeState(priorRequest);awaitingRequest=undefined;}
  else seam.acceptOwnPaidResponseThroughNativeState();
  for(let i=0;i<4900;i++){
   const status=seam.readNativeCoreResult();if(status.pendingNativeRequest||(status.nativeRoundCloseObserved&&status.nativeResultShownObserved&&!status.nativeRoundActiveAfter))break;
   reels.step(16);let event;while(event=seam.readNextOwnedNativeEvent())seam.consumeOwnedNativeEvent(event);
  }
  const r=seam.readNativeCoreResult();current();
  if(r.pendingNativeRequest)assert(r.pendingNativeRequest.event==='FREE_GAME'&&r.pendingNativeRequest.originalResponseFrame===frame&&r.nativeRoundActiveAfter&&!r.nativeRoundCloseObserved,'Own actual non-free next remains unmapped');
  else assert(r.nativeRoundCloseObserved&&r.nativeResultShownObserved&&!r.nativeRoundActiveAfter,'Own native true round close not reached; diagnosis='+JSON.stringify({nativeState:r.nativeState,roundClosed:r.nativeRoundCloseObserved,resultShown:r.nativeResultShownObserved,roundActive:r.nativeRoundActiveAfter,states:r.nativeStates,signalKeys:r.nativeSignals.map(x=>x[0])}));
  lastResult=Object.freeze({...r,gameId:'32727',originalResponseFrame:frame,decodedNativeResponse:response,nativeSlotGameModel:model,sourceRequests:0,providerACKClaimed:false,productionAdmission:false});
  return lastResult;
 }catch(error){close();throw error;}}
 return Object.freeze({paidRequest:paid,
  consumeOriginalSuccess:consume,
  readSelectedNativeRequest(){current();assert(lastResult?.pendingNativeRequest&&!awaitingRequest,'Own native next is not ready');const request=seam.readSelectedNativeRequest();assert(request===lastResult.pendingNativeRequest&&request.originalResponseFrame===frame);return request;},
  acceptSelectedNativeRequest(request){current();assert(!awaitingRequest&&request===lastResult?.pendingNativeRequest&&request.event==='FREE_GAME'&&request.originalResponseFrame===frame,'Own one-use current FREE_GAME required');seam.acceptSelectedNativeRequest(request);awaitingRequest=request;lastResult=undefined;},
  close,sourceRequests:0,wholeNextEndReady:false
 });
}
