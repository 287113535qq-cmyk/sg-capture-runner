'use strict';
const assert=require('node:assert/strict');
exports.createOwn32816NativeSessionView=function(d) {
  assert(typeof d.readNativeHostState==='function','Own32816 private native state reader required');
  let root=null,pinned=null;
  function need(ok,message){assert(ok,'AG integrity: own32816 native view '+message);}
  function stateOnly() {
    const state=d.readNativeHostState();
    need(state&&Array.isArray(state.pending)&&state.pending.length<=1,'actual private native pending queue required');
    if(!root)root=state;
    need(state===root,'native host/Main/server changed inside original scope');
    if(pinned)need(state.outerGame?.main===pinned.Main&&state.context?.sgigame?.ServerController===pinned.Controller,
      'native host/Main/server changed inside original scope');
    return state;
  }
  function current() {
    const state=stateOnly();
    need(state.context&&state.outerGame?.main,'original Main is not ready');
    const Main=state.outerGame.main,Controller=state.context.sgigame?.ServerController;
    const Base=state.context.server?.GLSServer,entries=Main._context?.injector?.singletonMap;
    need(typeof Controller==='function'&&typeof Base==='function'&&Array.isArray(entries),'original own server/injector types required');
    const matches=entries.filter(e=>e.mappedClassType===Controller&&e.instance instanceof Controller);
    need(matches.length===1&&matches[0].instance instanceof Base,'one existing original ServerController required');
    const server=matches[0].instance;
    if(!pinned)pinned={state,Main,Controller,server};
    need(state===pinned.state&&Main===pinned.Main&&Controller===pinned.Controller&&server===pinned.server,
      'native host/Main/server changed inside original scope');
    need(Array.isArray(state.pending)&&state.pending.length<=1,'actual private native pending queue required');
    need(typeof server._sessionId==='string'&&server._sessionId.length>0,'actual original GLSServer sessionID required');
    return {state,server};
  }
  return Object.freeze({
    readCurrentSessionID(){return current().server._sessionId;},
    readPendingNativeRequests(){return stateOnly().pending;},
    status(){const x=current();return {gameId:'32816',originalServerPinned:true,
      currentNativeSessionReadable:true,nativePending:x.state.pending.length,
      nativeHostDisposed:x.state.disposed===true,sessionValueExportedInStatus:false,
      networkClientIncluded:false,DBWrites:0};}
  });
};
