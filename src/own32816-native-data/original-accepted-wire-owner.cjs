'use strict';
// Own connection DATA. This owner stays in the original SG private slot.
const assert=require('node:assert/strict');
exports.createOwn32816OriginalAcceptedWireOwner=function(d){
 const scope=d.sessionScope,game=d.game;
 assert(scope&&typeof scope==='object'&&game?.gameId==='32816'&&game.dbName==='sg_zeus3_prt'&&game.sg?.runtimeGameId===33176&&String(game.sg.header?.gameID)==='20123');
 for(const k of ['assertOriginalSessionOpen','assertCurrentConsumedNativeDispatch','assertOriginalAcceptedStep','readOriginalSessionID'])assert.equal(typeof d[k],'function','Missing original private callback '+k);
 const byStep=new WeakMap(),accepted=new WeakSet();let current=null,lastOrdinal=0,sealed=null;
 function need(ok,message){assert(ok,'AG integrity: own32816 original wire '+message);}
 function guard(stage){need(!sealed,'scope sealed');d.assertOriginalSessionOpen({sessionScope:scope,game,stage});}
 function hold(error){if(!sealed)sealed={error,retryAllowed:false};return error;}
 function checkRaw(raw,dispatch,step){
  need(raw&&raw===current&&byStep.get(step)===raw&&raw.sessionScope===scope&&raw.game===game&&raw.nativeDispatch===dispatch&&raw.parsedStep===step,'same private raw slot required');
  need(raw.requestPayload===dispatch.requestPayload&&raw.requestPayload===step.requestPayload&&raw.responsePayload===step.responsePayload,'original raw bytes changed');
 }
 const ownerHooks=Object.freeze({
  rememberOriginalWire({dispatch,step,response,ordinal,requestSessionID,actualRequestHeaders}){try{
   guard('remember-original-complete-wire');d.assertCurrentConsumedNativeDispatch(dispatch);
   need(dispatch?.sessionScope===scope&&dispatch.game===game&&step&&typeof step==='object'&&!byStep.has(step),'own original dispatch and step required');
   need(step.msgId===dispatch.event&&step.requestPayload===dispatch.requestPayload&&typeof step.responsePayload==='string','original request/response association required');
   need(Number.isSafeInteger(ordinal)&&ordinal>lastOrdinal,'original request order required');
   need(requestSessionID===dispatch.requestSessionID&&requestSessionID===d.readOriginalSessionID(),'original pre-response SID association required');
   need(response instanceof Response&&response.status===200&&response.bodyUsed===true,'actual fully read original HTTP response required');
   need(actualRequestHeaders instanceof Headers&&dispatch.requestHeaders&&typeof dispatch.requestHeaders==='object'&&!Array.isArray(dispatch.requestHeaders),'actual native and transport headers required');
   for(const [name,value] of Object.entries(dispatch.requestHeaders))need(typeof value==='string'&&actualRequestHeaders.get(name)===value,'native request header was not sent');
   const raw=Object.freeze({sessionScope:scope,game,nativeDispatch:dispatch,parsedStep:step,
    requestPayload:step.requestPayload,responsePayload:step.responsePayload,httpStatus:response.status,
    responseHeaders:Object.freeze(Array.from(response.headers.entries(),p=>Object.freeze(p))),
    actualTransportRequestHeaders:Object.freeze(Array.from(actualRequestHeaders.entries(),p=>Object.freeze(p))),
    originalResponse:response,ordinal,requestSessionID});
   byStep.set(step,raw);current=raw;lastOrdinal=ordinal;
  }catch(error){throw hold(error);}},
  commitAfterOriginalReadEnvelope(step,envelope){try{
   guard('commit-after-original-readEnvelope');const raw=byStep.get(step);checkRaw(raw,raw?.nativeDispatch,step);
   d.assertOriginalAcceptedStep(step,envelope);
   need(envelope?.Header?.sessionID===d.readOriginalSessionID(),'original post-envelope SID authority required');
   accepted.add(raw);
  }catch(error){throw hold(error);}},
  seal(error){hold(error);}
 });
 const privateReaders=Object.freeze({
  readAcceptedOriginalExchange(dispatch,step){try{guard('read-original-accepted-exchange');const raw=byStep.get(step);checkRaw(raw,dispatch,step);need(accepted.has(raw),'original readEnvelope acceptance absent');return raw;}catch(error){throw hold(error);}},
  assertOriginalAcceptedExchange(raw,context){try{guard('authenticate-original-accepted-exchange');need(context?.sessionScope===scope&&context.game===game,'foreign original owner');checkRaw(raw,context.nativeDispatch,context.parsedStep);need(accepted.has(raw),'original acceptance capability absent');}catch(error){throw hold(error);}}
 });
 return Object.freeze({ownerHooks,privateReaders,status:()=>({gameId:'32816',sealed:!!sealed,currentWireRetained:!!current,currentOriginalAccepted:!!current&&accepted.has(current),retryAllowed:false,networkClientIncluded:false,DBWrites:0})});
};
