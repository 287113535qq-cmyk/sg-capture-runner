"use strict";
const {createOwn32777NativeControl}=require("./own32777-native-control-v11.cjs");
function createOwn32777OriginalAGNativeConnection(input){
 const {session,game,source}=input;
 const control=createOwn32777NativeControl(input);
 let phase="new",cap,offered,inflight,preparing,initialMarker,action="SPIN",startCash,winRaw,balanceRaw,featureDecision,roundOrdinal=0;
 const steps=[];
 function need(ok,reason){if(!ok)throw Object.assign(new Error("AG integrity: own32777 "+reason),{code:"OWN32777_NATIVE_AG_HOLD",reason});}
 function safe(n,label){need(Number.isSafeInteger(n)&&n>=0,"ACTUAL_SAFE_"+label);return n;}
 function offer(intent){need(intent&&["Logic","EndGame"].includes(intent.msgId),"ACTUAL_NATIVE_NEXT_REQUEST");offered={intent,parameters:Object.freeze({__own32777NativeCommand:String(intent.ordinal)})};phase="offered";return Object.freeze({event:intent.msgId,parameters:offered.parameters});}
 function normalize(frame,terminal){
  need(source.has(frame)&&source.readCurrent(session,cap)===frame&&frame.roundScope===cap,"CURRENT_NORMALIZATION_FRAME");
  safe(winRaw,"TOTAL_WIN");safe(balanceRaw,"CASH");need(featureDecision?.source==='original-native-state-transitions'&&typeof featureDecision.isFeature==='boolean','SOURCE_NATIVE_FEATURE_CLASSIFICATION');
  if(terminal)need(frame.msgId==="EndGame"&&control.nativeEndClosed()&&balanceRaw===startCash-game.sg.betRaw+winRaw,"ONLY_TRUE_OWN_END_NORMALIZES_TERMINAL");
  else need(offered&&phase==="offered","ACTUAL_NATIVE_NEXT_BEFORE_CONTINUATION");
  const selected=terminal?steps.slice():steps.slice(-1);
  return Object.freeze({NextActionInfo:{nextAction:terminal?"SPIN":action},
   PlayerBalanceInfo:{preWagerBalance:startCash/100,balance:balanceRaw/100,wager:game.sg.betRaw/100,resultAmount:winRaw/100},
   capturePlatform:"sg",gameId:game.sg.runtimeGameId,runtimeSlug:game.sg.runtimeSlug,
   startBalance:startCash/100,endBalance:balanceRaw/100,totalWin:winRaw/100,SGWireResponse:frame.responsePayload,
   stepCount:selected.length,msgIds:selected.map(x=>x.msgId),steps:structuredClone(selected),
   money:{startBalanceRaw:startCash,endBalanceRaw:balanceRaw,betRaw:game.sg.betRaw,totalWinRaw:winRaw},
   SGOwnSDKDecision:{contract:"own32777-original-AG-next-end-DATA-v11",roundOrdinal,
    actualSameModuleSuccessFrame:true,actualNativeRequestData:true,actualNativeEndReturned:terminal,actualFeatureObserved:featureDecision.isFeature,actualNativeFeatureStates:featureDecision.nativeStates.slice(),
    actualProtocolIdleAfterEnd:terminal,GUIBootstrapped:false,productionAdmission:false,
    originalAGReplayAndMongoValidated:false,independentFinalCredit:0}});
 }
 return Object.freeze({
  bootstrap(){need(phase==="new","ONE_ORIGINAL_INIT_ADOPTION");const status=control.adoptOriginalInit();startCash=safe(source.readInit(session).cashRaw,"INIT_CASH");balanceRaw=startCash;phase="init";return status;},
  initial(originalAGRoundIntent){need((phase==="init"||phase==="round-closed")&&action==="SPIN","ORIGINAL_AG_NEXT_PAID_REQUIRES_CLOSED_ROUND");need(source.hasOriginalAGRoundIntent(session,originalAGRoundIntent)&&originalAGRoundIntent.startCashRaw===balanceRaw,"CURRENT_ORIGINAL_AG_ACCOUNT_CAP");cap=originalAGRoundIntent;phase="preparing";startCash=safe(balanceRaw,"NEXT_ROUND_START_CASH");winRaw=undefined;featureDecision=undefined;steps.length=0;roundOrdinal=cap.roundOrdinal;initialMarker=Object.freeze({__own32777OriginalAGRoundIntent:String(cap.roundOrdinal)});preparing=control.prepareOriginalAGPaidLogic(cap);preparing.catch(()=>{});return Object.freeze({event:"Logic",parameters:initialMarker});},
  exact(requestedAction){need(phase==="offered"&&["PLAY","FEATURE"].includes(action)&&requestedAction===action,"CURRENT_NATIVE_EXACT_ACTION");return Object.freeze({event:offered.intent.msgId,parameters:offered.parameters});},
  pickProtocol(){return undefined;},
  async take(event,parameters,currentSessionID){if(phase==="preparing"){need(event==="Logic"&&parameters&&Object.keys(parameters).join("|")==="__own32777OriginalAGRoundIntent"&&parameters.__own32777OriginalAGRoundIntent===initialMarker.__own32777OriginalAGRoundIntent,"ONE_ORIGINAL_AG_ASYNC_PAID_MARKER");const intent=await preparing;need(phase==="preparing","CURRENT_PREPARED_NATIVE_LOGIC");offer(intent);parameters=offered.parameters;initialMarker=undefined;preparing=undefined;}need(phase==="offered"&&offered&&event===offered.intent.msgId&&parameters&&Object.keys(parameters).join("|")==="__own32777NativeCommand"&&parameters.__own32777NativeCommand===offered.parameters.__own32777NativeCommand,"ONE_CURRENT_NATIVE_COMMAND_TOKEN");phase="consumed";inflight=control.take(offered.intent,cap,currentSessionID);offered=undefined;return inflight;},
  hasDispatch(value){return phase==="consumed"&&inflight===value&&control.hasDispatch(value);},
  async finish(frame,step,originalCashRaw){
   need(phase==="consumed"&&frame.step===step&&frame.cashRaw===originalCashRaw&&frame.nativeIntent===inflight.intent,"ONE_CURRENT_ORIGINAL_SUCCESS");
   const boundary=await control.acceptCurrentOriginalSuccess(frame);
   balanceRaw=safe(originalCashRaw,"CURRENT_CASH");winRaw=safe(boundary.actualTotalWagerWinRaw,"CURRENT_TOTAL_WIN");featureDecision=boundary.actualFeatureDecision;steps.push({...step,responseBalance:balanceRaw});inflight=undefined;
   if(boundary.nativeProtocolRoundClosed){need(frame.msgId==="EndGame"&&!boundary.nextIntent,"ACTUAL_END_ACK_BOUNDARY");phase="round-closed";action="SPIN";return normalize(frame,true);}
   need(boundary.nextIntent,"NEXT_OR_END_REMAINS_UNMAPPED");offer(boundary.nextIntent);action=featureDecision.isFeature?"FEATURE":"PLAY";return normalize(frame,false);
  },
  readOriginalAGPaidAdmission(){need((phase==="init"||phase==="round-closed")&&action==="SPIN","ORIGINAL_AG_PAID_ADMISSION_PHASE");const a=control.readOriginalAGPaidAdmission();need(a.startCashRaw===balanceRaw&&a.nextRoundOrdinal===roundOrdinal+1,"ORIGINAL_AG_CURRENT_ACCOUNT_ADMISSION");return a;},
  status(){return Object.freeze({phase,action,roundOrdinal,...control.status(),originalAGReplayAndMongoValidated:false});},
  readTrace(){return control.readTrace();},
  close(){phase="closed";control.close();},
  fail(error){phase="fault";return control.fail(error);}
 });
}
module.exports=Object.freeze({createOwn32777OriginalAGNativeConnection});
