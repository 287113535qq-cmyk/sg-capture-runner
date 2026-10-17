"use strict";
const {createOwn32777NativeEnvironment,parseOwnXML,oneOwn,rawOwnUInt}=require("./own32777-native-environment-v11.cjs");
function createOwn32777NativeControl(input){
 const {session,game,source,limits}=input;
 const need=(ok,reason)=>{if(!ok)throw Object.assign(new Error("AG integrity: own32777 "+reason),{code:"OWN32777_NATIVE_HOLD",reason});};
 need(game?.provider==="sg"&&game.gameId==="32777"&&game.dbName==="sg_jjbxmegaways"&&game.sg?.protocol==="wms"&&game.sg.betRaw===88&&game.sg.runtimeGameId===32999&&game.sg.runtimeSlug==="jjbxmegaways"&&game.sg.header.gameID==="20468"&&game.sg.header.versionID==="1_0","OWN_GAME_BINDING_REQUIRED");
 for(const key of ["maxPaidRounds","maxIntents","maxNativeTicks","maxTrace"])need(Number.isSafeInteger(limits?.[key])&&limits[key]>0,"EXPLICIT_FINITE_"+key);
 need(limits.maxPaidRounds<=300000,"ORIGINAL_AG_CAMPAIGN_BOUND");
 const init=source.readInit(session);need(source.has(init)&&init.sessionScope===session&&init.game===game&&init.msgId==="Init","ORIGINAL_INIT_SCOPE_REQUIRED");
 const accountScope=Object.freeze({});let closed=false,adopted=false,cap=null,pending=null,inflight=null,ordinal=0,rounds=0,lastEnd=null,lastWin,lastFeature,lastCash=init.cashRaw,startCash=init.cashRaw,origin=null,currentResponseSID=init.responseSessionID;
 const issued=new WeakSet(),dispatches=new WeakSet();const trace=[];
 function current(){need(!closed&&source.has(init)&&source.readInit(session)===init,"CURRENT_ORIGINAL_SCOPE_REQUIRED");}
 function record(kind,data){need(trace.length<limits.maxTrace,"FINITE_CONNECTION_TRACE");trace.push(Object.freeze({kind,data}));}
 function receiveNative(request){
  current();need(cap&&source.hasOriginalAGRoundIntent(session,cap)&&!pending&&!inflight&&++ordinal<=limits.maxIntents,"ONE_OWN_NATIVE_REQUEST");
  need(["Logic","EndGame"].includes(request.event)&&request.endpoint===game.sg.endpoint,"OWN_NATIVE_ENDPOINT_AND_EVENT");
  const requestDoc=parseOwnXML(request.payload),header=oneOwn(requestDoc,"Header");
  need(header.getAttribute("gameID")==="20468"&&header.getAttribute("versionID")==="1_0"&&header.getAttribute("sessionID")===currentResponseSID,"CURRENT_NATIVE_HEADER_TOKEN");
  const initHeader=oneOwn(parseOwnXML(init.requestPayload),"Header");
  const keys=Array.from(initHeader.attributes).map(a=>a.name||a.nodeName).filter(k=>k!=="sessionID");
  for(const key of keys)need(header.getAttribute(key)===initHeader.getAttribute(key),"ORIGINAL_INIT_HEADER_DATA_"+key);
  if(request.event==="Logic")need(rawOwnUInt(oneOwn(requestDoc,"Stake").getAttribute("total"),"native Stake",true)===game.sg.betRaw,"NATIVE_SELECTED_STAKE");
  const intent=Object.freeze({msgId:request.event,requestPayload:request.payload,requestSessionID:header.getAttribute("sessionID"),sessionScope:session,sourceInitFrame:init,originalAGRoundIntent:cap,ordinal,
   command:Object.freeze({command:origin?.command||"original-native-next",event:origin?.event||"original-native-follow-up"})});
  issued.add(intent);pending={intent,request};record("native-request",{event:intent.msgId,ordinal});
 }
 function sourceCurrentOrInit(){try{return source.readCurrent(session,cap);}catch(_){return init;}}
 const native=createOwn32777NativeEnvironment({...input,receiveNative,record,current});
 function nativeEndClosed(){return !!lastEnd&&!pending&&!inflight&&source.has(lastEnd)&&source.readCurrent(session,cap)===lastEnd&&native.nativeEndClosed()&&lastCash===startCash-game.sg.betRaw+lastWin;}
 function admission(){
  current();need(adopted&&!pending&&!inflight,"NATIVE_ADMISSION_NOT_PENDING");
  if(!rounds)return Object.freeze({phase:"init",accountScope,admissionFrame:init,previousRoundScope:null,startCashRaw:lastCash,requestSessionID:init.responseSessionID,nextRoundOrdinal:1,remainingPaidRounds:limits.maxPaidRounds,InitAdoptions:1,actualPriorEndACK:false,nativeProtocolIdle:false});
  need(nativeEndClosed(),"REAL_CURRENT_END_ACK_AND_NATIVE_IDLE_REQUIRED");
  return Object.freeze({phase:"round-closed",accountScope,admissionFrame:lastEnd,previousRoundScope:cap,startCashRaw:lastCash,requestSessionID:lastEnd.responseSessionID,nextRoundOrdinal:rounds+1,remainingPaidRounds:limits.maxPaidRounds-rounds,InitAdoptions:1,actualPriorEndACK:true,nativeProtocolIdle:true});
 }
 return Object.freeze({
  adoptOriginalInit(){current();need(!adopted&&!rounds,"ONE_NATIVE_INIT_ADOPTION");native.adoptInit(init);adopted=true;return this.status();},
  readOriginalAGPaidAdmission:admission,
  async prepareOriginalAGPaidLogic(nextCap){
   current();const a=admission();need(source.hasOriginalAGRoundIntent(session,nextCap),"OWN_ORIGINAL_AG_ROUND_CAP");const binding=source.readOriginalAGRoundIntent(session,nextCap);
   need(nextCap!==cap&&nextCap.accountScope===accountScope&&nextCap.startCashRaw===a.startCashRaw&&nextCap.requestSessionID===a.requestSessionID&&nextCap.roundOrdinal===a.nextRoundOrdinal&&a.remainingPaidRounds>0&&binding.admissionFrame===a.admissionFrame&&binding.previousRoundScope===a.previousRoundScope,"EXACT_ORIGINAL_AG_ADMISSION_BINDING");
   source.consumeOriginalAGRoundIntent(session,nextCap);cap=nextCap;rounds=cap.roundOrdinal;startCash=a.startCashRaw;currentResponseSID=a.requestSessionID;lastWin=undefined;lastFeature=undefined;lastEnd=null;trace.length=0;
   origin={command:"Z.Hg.Hg.jv",event:"original-AG-owned-paid-round"};try{native.beginPaid(cap);await native.waitForPaidEmission();}finally{origin=null;}
   need(pending?.intent.msgId==="Logic","NATIVE_PAID_LOGIC_NOT_EMITTED");return pending.intent;
  },
  take(intent,roundCap,sid){current();need(roundCap===cap&&pending?.intent===intent&&issued.has(intent)&&source.hasOriginalAGRoundIntent(session,cap)&&intent.requestSessionID===sid&&!inflight,"ONE_CURRENT_NATIVE_TAKE");const row=pending;pending=null;const dispatch=Object.freeze({sessionScope:session,roundScope:cap,event:intent.msgId,requestPayload:intent.requestPayload,requestSessionID:sid,intent});dispatches.add(dispatch);inflight={row,dispatch};return dispatch;},
  hasDispatch(d){current();return !!inflight&&inflight.dispatch===d&&dispatches.has(d);},
  async acceptCurrentOriginalSuccess(frame){
   current();const flight=inflight;need(flight&&dispatches.has(flight.dispatch)&&source.has(frame)&&source.readCurrent(session,cap)===frame&&frame.sessionScope===session&&frame.game===game&&frame.roundScope===cap&&frame.nativeIntent===flight.dispatch.intent&&frame.msgId===flight.dispatch.event&&frame.requestPayload===flight.dispatch.requestPayload&&frame.step.requestPayload===frame.requestPayload&&frame.step.responsePayload===frame.responsePayload&&frame.httpStatus>=200&&frame.httpStatus<300,"EXACT_CURRENT_ORIGINAL_NATIVE_RESPONSE");
   const xml=parseOwnXML(frame.responsePayload);need(xml.documentElement.getAttribute("type")===frame.msgId&&oneOwn(xml,"Header").getAttribute("gameID")==="20468","OWN_CURRENT_RESPONSE_IDENTITY");
   if(frame.msgId==="EndGame")need(Number.isSafeInteger(lastWin)&&frame.cashRaw===startCash-game.sg.betRaw+lastWin,"ACTUAL_END_RAW_CASH_CONSERVATION");
   currentResponseSID=frame.responseSessionID;inflight=null;await native.accept(frame,flight.row.request);lastCash=frame.cashRaw;
   if(frame.msgId==="Logic")lastWin=native.actualTotalWagerWinRaw();else lastEnd=frame;
   await native.drive();
   if(frame.msgId==='Logic'){lastFeature=native.readOriginalAGFeatureDecision();need(lastFeature?.source==='original-native-state-transitions'&&typeof lastFeature.isFeature==='boolean'&&Array.isArray(lastFeature.nativeStates),'ACTUAL_NATIVE_FEATURE_DECISION_REQUIRED');}
   need(lastFeature,'ROUND_NATIVE_FEATURE_EVIDENCE_REQUIRED');
   const done=nativeEndClosed();need(done||pending,"ACTUAL_NATIVE_NEXT_OR_END_UNMAPPED");
   return Object.freeze({nextIntent:pending?.intent||null,nativeProtocolRoundClosed:done,actualTotalWagerWinRaw:lastWin,actualCashRaw:lastCash,actualFeatureDecision:lastFeature,roundOrdinal:rounds});
  },
  nativeEndClosed,
  status(){current();return Object.freeze({scope:"own32777-original-AG-next-end-DATA-v11",InitAdopted:adopted,nativeInitAdoptions:adopted?1:0,roundsStarted:rounds,pending:!!pending,inflight:!!inflight,nativeEndClosed:nativeEndClosed(),productionReady:false});},
  readTrace(){current();return Object.freeze(trace.slice());},
  close(){if(closed)return;closed=true;native.close();},
  fail(error){try{this.close();}catch(_){}throw error;}
 });
}
module.exports=Object.freeze({createOwn32777NativeControl});
