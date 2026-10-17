'use strict';
// Own32816 original-SG response capability. Owner hooks stay private in the original SG session slot.
const assert=require('node:assert/strict');
function createOwn32816OriginalResponseSource(d){
 const scope=d.sessionScope,game=d.game;
 assert(scope&&typeof scope==='object'&&game?.gameId==='32816'&&game.dbName==='sg_zeus3_prt'&&game.sg?.runtimeGameId===33176&&String(game.sg.header?.gameID)==='20123'&&typeof d.readOriginalExchange==='function'&&typeof d.DOM?.DOMParser==='function','Own32816 private original source binding required');
 const frames=new WeakSet(),rawByFrame=new WeakMap();let current=null,sealed=null;
 function need(ok,message){assert(ok,'AG integrity: own32816 original source '+message)}
 function hold(error){if(!sealed)sealed={error,retryAllowed:false};return error}
 const source=Object.freeze({
  authenticateOriginalResponse(dispatch,frame){if(sealed||!frame||!frames.has(frame)||frame!==current||frame.nativeDispatch!==dispatch)return undefined;return d.readOriginalExchange(dispatch,frame.step)===rawByFrame.get(frame)?frame:undefined;},
  status(){return{gameId:'32816',sealed:!!sealed,currentFrameRetained:!!current,networkClientIncluded:false,DBWrites:0}}
 });
 const ownerHooks=Object.freeze({
  recordOriginalParsedResponse(dispatch,step){try{
   need(!sealed,'source sealed');const raw=d.readOriginalExchange(dispatch,step);
   need(raw&&raw.sessionScope===scope&&raw.game===game&&raw.nativeDispatch===dispatch&&raw.parsedStep===step&&dispatch.sessionScope===scope&&dispatch.game===game,'same original owner/raw exchange/parsed step');
   need(step&&step.msgId===dispatch.event&&step.requestPayload===dispatch.requestPayload&&raw.requestPayload===dispatch.requestPayload&&step.responsePayload===raw.responsePayload,'complete original parsed request/response bytes');
   need(raw.httpStatus===200&&typeof raw.responsePayload==='string','actual successful original HTTP response');
   const doc=new d.DOM.DOMParser().parseFromString(raw.responsePayload,'text/xml'),h=doc.getElementsByTagName('Header');
   need(doc.documentElement?.nodeName==='GameResponse'&&doc.documentElement.getAttribute('type')===dispatch.event&&h.length===1&&h[0].getAttribute('gameID')==='20123','same own original response type/game');
   const responseSessionID=h[0].getAttribute('sessionID');need(typeof responseSessionID==='string'&&responseSessionID.length>0,'actual original response sessionID');
   const headerData={};if(typeof raw.responseHeadersRaw==='string')headerData.responseHeadersRaw=raw.responseHeadersRaw;else{need(Array.isArray(raw.responseHeaders)&&raw.responseHeaders.every(r=>Array.isArray(r)&&r.length===2&&r.every(v=>typeof v==='string')),'actual original response headers required');headerData.responseHeaders=Object.freeze(raw.responseHeaders.map(r=>Object.freeze([...r])))}
   const frame=Object.freeze({sessionScope:scope,game,nativeDispatch:dispatch,step,httpStatus:raw.httpStatus,responsePayload:raw.responsePayload,responseSessionID,...headerData});
   frames.add(frame);rawByFrame.set(frame,raw);current=frame;return frame;
  }catch(error){throw hold(error)}},
  seal(error){if(!sealed)sealed={error,retryAllowed:false};}
 });
 return Object.freeze({source,ownerHooks});
}
module.exports={createOwn32816OriginalResponseSource};
