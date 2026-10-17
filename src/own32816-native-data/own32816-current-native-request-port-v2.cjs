'use strict';
// Own32816 request DATA port only. Actual SDK emits requests; original SG retains transport/ACK/journal.
const assert=require('node:assert/strict');
function createOwn32816CurrentNativeRequestPort(d){
 const game=d.game,scope=d.sessionScope;
 assert(game?.gameId==='32816'&&game.dbName==='sg_zeus3_prt'&&game.sg?.protocol==='wms'&&game.sg.runtimeGameId===33176&&String(game.sg.header?.gameID)==='20123','Own32816 exact original identity');
 assert(typeof game.sg.endpoint==='string'&&game.sg.endpoint==='https://gls.atc.casinarena.com/gls.rgsx'&&typeof game.sg.header.gameCodeRGI==='string'&&game.sg.header.gameCodeRGI.length&&typeof game.sg.header.versionID==='string'&&game.sg.header.versionID.length,'Own32816 original endpoint and Header binding');
 assert(scope&&typeof scope==='object'&&typeof d.DOM?.DOMParser==='function'&&typeof d.readPendingNativeRequests==='function'&&typeof d.readCurrentSessionID==='function'&&typeof d.assertOriginalSessionOpen==='function','Own32816 private native/session inputs');
 const slots=new WeakMap(),consumedDispatches=new WeakSet(),deliveredDispatches=new WeakSet();let current=null,sealed=null;
 function need(ok,message){assert(ok,'AG integrity: own32816 '+message)}
 function guard(stage){need(!sealed,'native request scope sealed');d.assertOriginalSessionOpen({sessionScope:scope,game,stage});}
 function hold(error){if(!sealed)sealed={error,reason:'original owner/native request fault',retryAllowed:false};return error;}
 function headers(x){need(x.headers&&typeof x.headers==='object'&&!Array.isArray(x.headers),'actual native request headers required');const result=Object.create(null);for(const [k,v]of Object.entries(x.headers)){need(typeof v==='string','actual native header string required');result[k]=v}return Object.freeze(result)}
 function inspect(){
  const list=d.readPendingNativeRequests();need(Array.isArray(list)&&list.length<=1,'one current native request');if(!list.length)return null;
  const x=list[0];need(x&&x.sent===true&&x.settled!==true&&x.method==='POST'&&x.url===game.sg.endpoint&&typeof x.body==='string','actual unsatisfied native POST required');
  const doc=new d.DOM.DOMParser().parseFromString(x.body,'text/xml'),root=doc.documentElement,h=doc.getElementsByTagName('Header');
  need(root?.nodeName==='GameRequest'&&h.length===1,'actual native request envelope');const event=root.getAttribute('type'),header=h[0];
  need(['Init','Logic','EndGame'].includes(event)&&x.event===event,'native emitted event required');
  const sid=header.getAttribute('sessionID');need(header.getAttribute('gameID')==='20123'&&header.getAttribute('gameCodeRGI')===game.sg.header.gameCodeRGI&&header.getAttribute('versionID')===game.sg.header.versionID,'own current Header binding');
  need(typeof sid==='string'&&sid.length>0&&sid===d.readCurrentSessionID(),'actual current original sessionID');
  return {x,event,sid,requestHeaders:headers(x)};
 }
 const api={
  captureCurrent(){try{guard('capture-current-native-request');const actual=inspect();if(!actual){need(!current||current.used&&current.x.settled===true,'unacknowledged request disappeared');return null}
   if(current&&current.x===actual.x){need(current.requestPayload===actual.x.body,'native body changed after issue');if(current.used)return null;return current.publicRequest}
   need(!current||current.used&&current.x.settled===true,'prior native request still unacknowledged');
   const parameters=Object.freeze({nativeRequestPayload:actual.x.body});const slot={x:actual.x,event:actual.event,sid:actual.sid,requestPayload:actual.x.body,requestHeaders:actual.requestHeaders,used:false};
   slot.publicRequest=Object.freeze({event:slot.event,parameters});slots.set(parameters,slot);current=slot;return slot.publicRequest;
  }catch(error){throw hold(error)}},
  consume(event,parameters,requestSessionID){try{guard('consume-current-native-request');const slot=parameters&&slots.get(parameters);need(slot&&slot===current&&!slot.used&&event===slot.event&&requestSessionID===slot.sid,'one current private request capability');
   const actual=inspect();need(actual&&actual.x===slot.x&&actual.event===slot.event&&actual.sid===slot.sid&&actual.x.body===slot.requestPayload,'same current native request origin');
   need(Object.keys(actual.requestHeaders).length===Object.keys(slot.requestHeaders).length&&Object.entries(slot.requestHeaders).every(([k,v])=>actual.requestHeaders[k]===v),'native headers changed after issue');
   slot.used=true;const dispatch=Object.freeze({sessionScope:scope,game,event:slot.event,requestPayload:slot.requestPayload,requestSessionID:slot.sid,requestHeaders:slot.requestHeaders,method:slot.x.method,url:slot.x.url,nativeXHR:slot.x});consumedDispatches.add(dispatch);return dispatch;
  }catch(error){throw hold(error)}},
  applyOriginalResponse(dispatch,frame){try{
   guard('deliver-authenticated-original-response');
   need(dispatch&&consumedDispatches.has(dispatch)&&!deliveredDispatches.has(dispatch)&&current?.used&&current.x===dispatch.nativeXHR,'one consumed current native dispatch required');
   need(typeof d.authenticateOriginalResponse==='function'&&d.authenticateOriginalResponse(dispatch,frame)===frame,'private original SG response capability required');
   need(frame&&frame.sessionScope===scope&&frame.game===game&&frame.nativeDispatch===dispatch&&frame.step&&frame.step.msgId===dispatch.event&&frame.step.requestPayload===dispatch.requestPayload&&frame.step.responsePayload===frame.responsePayload,'same original parsed WireStep and dispatch');
   need(frame.httpStatus===200&&typeof frame.responsePayload==='string'&&typeof frame.responseSessionID==='string'&&frame.responseSessionID.length>0,'actual original HTTP status/raw response/sessionID');
   const doc=new d.DOM.DOMParser().parseFromString(frame.responsePayload,'text/xml'),h=doc.getElementsByTagName('Header');
   need(doc.documentElement?.nodeName==='GameResponse'&&doc.documentElement.getAttribute('type')===dispatch.event&&h.length===1&&h[0].getAttribute('gameID')==='20123'&&h[0].getAttribute('sessionID')===frame.responseSessionID&&frame.responseSessionID===d.readCurrentSessionID(),'same current original response identity');
   let rawHeaders;if(typeof frame.responseHeadersRaw==='string')rawHeaders=frame.responseHeadersRaw;else{need(Array.isArray(frame.responseHeaders)&&frame.responseHeaders.every(r=>Array.isArray(r)&&r.length===2&&r.every(v=>typeof v==='string')),'actual response headers required, never a missing-header default');rawHeaders=frame.responseHeaders.map(r=>r[0]+': '+r[1]).join('\r\n')}
   const x=dispatch.nativeXHR,pending=d.readPendingNativeRequests();
   need(Array.isArray(pending)&&pending.length===1&&pending[0]===x&&x.settled!==true&&x.body===dispatch.requestPayload&&x.method===dispatch.method&&x.url===dispatch.url&&typeof x.onloadend==='function','same unsatisfied native XHR and original onloadend');
   // Retire only the authenticated native browser pending entry. Original owner/lease/journal are not modified.
   pending.shift();need(!d.readPendingNativeRequests().includes(x),'native host must expose its actual pending queue');
   x.settled=true;Object.assign(x,{readyState:4,status:frame.httpStatus,response:frame.responsePayload,responseText:frame.responsePayload});
   x.getAllResponseHeaders=()=>rawHeaders;x.getResponseHeader=name=>{const values=rawHeaders.split(/\r?\n/).flatMap(line=>{const i=line.indexOf(':');return i>=0&&line.slice(0,i).trim().toLowerCase()===String(name).toLowerCase()?[line.slice(i+1).trim()]:[]});return values.length?values.join(', '):null};
   deliveredDispatches.add(dispatch);x.onloadend(Object.freeze({type:'loadend',target:x,currentTarget:x}));
   return Object.freeze({nativeResponseCallbackDelivered:true,originalParsedStep:frame.step});
  }catch(error){throw hold(error)}},
  seal(error){if(!sealed)sealed={error,reason:'original owner closed or executionunknown',retryAllowed:false};},
  status(){return{gameId:'32816',sealed:!!sealed,currentNativeRequestRetained:!!current,currentNativeRequestUnacknowledged:!!current&&current.x.settled!==true,currentCapabilityUsed:!!current&&current.used,networkClientIncluded:false,DBWrites:0}}
 };return Object.freeze(api);
}
module.exports={createOwn32816CurrentNativeRequestPort};
