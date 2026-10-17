'use strict';
// DATA-only private hooks. Instantiate and retain ownerHooks ONLY in SGWmsSession's private slot.
// This module has no transport, replay, journal writer, scheduler, or database client.
function createOwn32750OriginalSGSource(d){
 const {sessionScope,game}=d;
 const need=(v,s)=>{if(!v)throw Error('OWN32750_ORIGINAL_SOURCE_'+s)};
 const own=()=>game?.gameId==='32750'&&game.dbName==='sg_eightyeightfortunes'&&game.sg?.runtimeGameId===32972&&String(game.sg?.header?.gameID)==='20077'&&game.sg?.header?.gameCodeRGI==='eightyeightfortunes'&&game.sg?.header?.versionID==='1_0';
 need(sessionScope&&typeof sessionScope==='object'&&own()&&typeof d.readRawEnvelope==='function','PRIVATE_OWN_GAME_AND_RAW_PARSER');
 const issued=new WeakSet(),rawByStep=new WeakMap(),envelopes=new WeakMap(),usedDispatches=new WeakSet();
 const accountScope=Object.freeze({});let open=true,connection=null,init=null,current=null,inFlight=null,lastOrdinal=0,paid=null,sealReason=null;
 const active=()=>need(open&&own(),'OPEN_OWN_SCOPE');
 const int=(v,s)=>{need((typeof v==='string'&&/^\d+$/.test(v))||(typeof v==='number'&&Number.isSafeInteger(v)),'INTEGER_'+s);const n=Number(v);need(Number.isSafeInteger(n)&&n>=0,'SAFE_INTEGER_'+s);return n};
 const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v)}return v};
 const has=frame=>!!frame&&typeof frame==='object'&&open&&own()&&issued.has(frame)&&(frame===init||frame===current)&&frame.sessionScope===sessionScope&&frame.game===game&&frame.step.requestPayload===frame.requestPayload&&frame.step.responsePayload===frame.responsePayload;
 const hasPaid=(scope,cap)=>open&&own()&&scope===sessionScope&&!!paid&&paid.cap===cap&&cap.sessionScope===sessionScope&&cap.game===game&&cap.sourceInitFrame===init;
 const source=Object.freeze({
  has,
  readEnvelope(frame){need(has(frame),'ISSUED_CURRENT_ENVELOPE');return envelopes.get(frame)},
  readInit(scope){need(scope===sessionScope&&has(init),'OWN_INIT');return init},
  hasOriginalAGRoundIntent:hasPaid,
  consumeOriginalAGRoundIntent(scope,cap,admissionFrame){active();need(hasPaid(scope,cap)&&paid.phase==='offered'&&!inFlight&&paid.admissionFrame===admissionFrame&&current===admissionFrame&&has(admissionFrame)&&cap.requestSessionID===admissionFrame.responseSessionID,'ONE_CURRENT_ORIGINAL_PAID_ADMISSION');paid.phase='consumed'}
 });
 const ownerHooks=Object.freeze({
  attachConnection(value){active();need(!connection&&value&&typeof value.hasDispatch==='function'&&typeof value.consumeForOriginalExchange==='function'&&typeof value.readOriginalAGPaidAdmission==='function','ONE_PRIVATE_CONNECTION');connection=value},
  issueOriginalAGPaidIntent(originalAction,originalCurrentSessionID){
   active();need(connection&&originalAction==='SPIN'&&has(init)&&has(current)&&!inFlight,'ORIGINAL_AG_SPIN_ADMISSION');
   const a=connection.readOriginalAGPaidAdmission();
   need(a&&a.sourceInitFrame===init&&a.admissionFrame===current&&a.nativeProtocolIdle===true&&a.InitAdoptions===1&&a.startCashRaw===current.cashRaw&&a.requestSessionID===originalCurrentSessionID&&originalCurrentSessionID===current.responseSessionID&&Number.isSafeInteger(a.nextRoundOrdinal)&&a.nextRoundOrdinal>0,'CURRENT_NATIVE_ADMISSION_DATA');
   if(paid&&paid.phase==='offered'){need(paid.admissionFrame===current&&paid.cap.requestSessionID===originalCurrentSessionID,'SAME_UNDISPATCHED_PAID_INTENT');return paid.cap}
   if(paid){need(paid.phase==='consumed'&&a.phase==='round-closed'&&a.actualPriorEndACK===true&&current.msgId==='EndGame'&&current.roundScope===paid.cap&&a.previousRoundScope===paid.cap&&a.nextRoundOrdinal===paid.cap.roundOrdinal+1,'GENUINE_PRIOR_END_ACK');}
   else need(a.phase==='init'&&current===init&&a.previousRoundScope===null&&a.nextRoundOrdinal===1,'FIRST_ADOPTED_INIT');
   const cap=Object.freeze({kind:'original-AG-owned-new-paid-round-DATA',sessionScope,game,sourceInitFrame:init,accountScope,startCashRaw:int(a.startCashRaw,'ADMISSION_CASH'),requestSessionID:originalCurrentSessionID,roundOrdinal:a.nextRoundOrdinal});
   paid={cap,phase:'offered',admissionFrame:current};return cap;
  },
  consumeNativeBeforeOriginalPost(dispatch,requestSessionID){
   active();need(connection&&!inFlight&&connection.hasDispatch(dispatch)&&!usedDispatches.has(dispatch)&&dispatch.sessionScope===sessionScope&&dispatch.game===game&&dispatch.intent?.sessionScope===sessionScope&&dispatch.intent.game===game&&dispatch.intent.event===dispatch.event&&dispatch.intent.requestPayload===dispatch.requestPayload&&dispatch.intent.requestSessionID===requestSessionID&&dispatch.requestSessionID===requestSessionID&&dispatch.method==='POST'&&dispatch.nativeXHR?.method===dispatch.method&&typeof dispatch.url==='string'&&dispatch.url===game.sg.endpoint&&dispatch.nativeXHR?.url===dispatch.url,'EXACT_PRIVATE_NATIVE_DISPATCH');
   if(dispatch.event==='Init')need(!init&&!current&&!paid&&dispatch.intent.sourceInitFrame===null&&dispatch.roundScope===null,'ONE_NATIVE_INIT');
   else need(['Logic','EndGame'].includes(dispatch.event)&&has(init)&&has(current)&&paid?.phase==='consumed'&&dispatch.roundScope===paid.cap&&dispatch.intent.originalAGRoundIntent===paid.cap&&dispatch.intent.sourceInitFrame===init&&requestSessionID===current.responseSessionID,'CURRENT_CONSUMED_ORIGINAL_ROUND');
   const payload=connection.consumeForOriginalExchange(dispatch,requestSessionID);need(payload===dispatch.requestPayload,'UNCHANGED_NATIVE_BODY');usedDispatches.add(dispatch);inFlight=dispatch;return payload;
  },
  rememberOriginalRaw({step,response,ordinal,requestSessionID,requestHeaders,journalPath}){
   active();need(inFlight&&usedDispatches.has(inFlight)&&response?.ok&&response.status>=200&&response.status<300&&Number.isSafeInteger(ordinal)&&ordinal>lastOrdinal&&step&&typeof step==='object'&&!rawByStep.has(step)&&step.msgId===inFlight.event&&step.requestPayload===inFlight.requestPayload&&typeof step.responsePayload==='string'&&step.responsePayload.length>0&&requestSessionID===inFlight.requestSessionID&&requestHeaders&&typeof requestHeaders==='object'&&response.headers&&typeof response.headers.entries==='function','ORIGINAL_HTTP_RESPONSE_AND_REQUEST_ASSOCIATION');
   const responseHeaders=Object.freeze(Array.from(response.headers.entries(),r=>Object.freeze([String(r[0]),String(r[1])])));
   rawByStep.set(step,Object.freeze({sessionScope,game,step,msgId:step.msgId,requestPayload:step.requestPayload,responsePayload:step.responsePayload,endpoint:game.sg.endpoint,ordinal,requestSessionID,requestHeaders:Object.freeze({...requestHeaders}),nativeRequestHeaders:inFlight.requestHeaders,httpStatus:response.status,responseHeaders,responseSetCookie:Object.freeze(Array.from(response.headers.getSetCookie?.()||[])),response,journalPath,roundScope:inFlight.roundScope,nativeIntent:inFlight.intent}));
  },
  commitOriginalSuccess(step,originalEnvelope,originalCashRaw){
   active();const raw=rawByStep.get(step);
   need(raw&&inFlight&&raw.nativeIntent===inFlight.intent&&raw.step===step&&step.requestPayload===raw.requestPayload&&step.responsePayload===raw.responsePayload&&raw.ordinal>lastOrdinal,'CURRENT_UNREPLACED_RAW_STEP');
   const parsed=d.readRawEnvelope(raw.responsePayload);
   need(parsed&&JSON.stringify(parsed)===JSON.stringify(originalEnvelope)&&parsed.type===raw.msgId&&String(parsed.Header?.gameID)==='20077'&&parsed.Header?.versionID==='1_0'&&typeof parsed.Header?.sessionID==='string'&&parsed.Header.sessionID.length>0&&!parsed.Error&&!parsed.Errors,'EXACT_ORIGINAL_READ_ENVELOPE_RESULT');
   const balances=Array.isArray(parsed.Balances?.Balance)?parsed.Balances.Balance:[parsed.Balances?.Balance];const cash=balances.filter(x=>x?.name==='CASH_BALANCE');
   need(cash.length===1&&int(cash[0].value,'ACTUAL_CASH')===originalCashRaw&&Number.isSafeInteger(originalCashRaw)&&originalCashRaw>=0,'ORIGINAL_RAW_CASH_ASSOCIATION');
   if(raw.msgId==='Init')need(!init&&parsed.Header.isRecovering==='N','FRESH_NATIVE_INIT_ONLY');
   else need(has(init)&&paid?.phase==='consumed'&&raw.roundScope===paid.cap&&raw.nativeIntent.originalAGRoundIntent===paid.cap,'OWN_ORIGINAL_ROUND_FRAME');
   const frame=Object.freeze({...raw,kind:'original-ag-live-own32750-native-wire-DATA-only',cashRaw:originalCashRaw,responseSessionID:parsed.Header.sessionID});
   envelopes.set(frame,freeze(structuredClone(parsed)));issued.add(frame);if(raw.msgId==='Init')init=frame;current=frame;lastOrdinal=raw.ordinal;inFlight=null;rawByStep.delete(step);return frame;
  },
  seal(error){open=false;sealReason=String(error?.message||error||'original-session-close');if(connection)connection.fail(error);return{originalOwnerAndJournalPreserved:true,pendingDispatchPreserved:!!inFlight,retryAllowed:false}},
  status(){return{open,hasInit:!!init,lastOrdinal,pendingNativeDispatch:!!inFlight,paidIntentPhase:paid?.phase||null,sealed:sealReason,networkClientIncluded:false,DBWrites:0}}
 });
 return Object.freeze({source,ownerHooks});
}
function createOwn32750OriginalSGUnitReader(source){
 if(!source||typeof source.has!=='function'||typeof source.readInit!=='function')throw Error('OWN32750_ORIGINAL_UNIT_SOURCE_REQUIRED');
 return function readOwnOriginalUnit({sourceInitFrame,sessionScope,game}){
  if(game?.gameId!=='32750'||game.dbName!=='sg_eightyeightfortunes'||game.sg?.runtimeGameId!==32972||!source.has(sourceInitFrame)||source.readInit(sessionScope)!==sourceInitFrame||sourceInitFrame.sessionScope!==sessionScope||sourceInitFrame.game!==game)throw Error('OWN32750_ORIGINAL_UNIT_INIT_BINDING');
  return Object.freeze({factor:100,sourceInitFrame,contract:'original-SGWmsSession-raw-cash-and-bet-div100'});
 };
}
module.exports={createOwn32750OriginalSGSource,createOwn32750OriginalSGUnitReader};
