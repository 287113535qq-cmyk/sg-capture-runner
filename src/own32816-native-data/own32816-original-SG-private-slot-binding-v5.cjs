'use strict';
const assert=require('node:assert/strict');
exports.createOwn32816OriginalSGNativeBinding=function(d) {
  const scope=d.sessionScope,game=d.game;
  assert(scope&&typeof scope==='object'&&game?.gameId==='32816','Own32816 original game/scope required');
  for(const k of ['createNativeSessionView','createCurrentNativeRequestPortV2',
                  'createOriginalResponseSourceV2','readOriginalSessionID',
                  'assertOriginalSessionOpen','readAcceptedOriginalExchange',
                  'assertOriginalAcceptedExchange']) {
    assert(typeof d[k]==='function','Own32816 original private binding dependency '+k);
  }
  const native=d.createNativeSessionView({readNativeHostState:d.readNativeHostState});
  let sealed=null,lastDispatch=null,lastFrame=null;
  const originalSource=d.createOriginalResponseSourceV2({
    sessionScope:scope,game,DOM:d.DOM,
    readOriginalExchange(dispatch,step) {
      const raw=d.readAcceptedOriginalExchange(dispatch,step);
      d.assertOriginalAcceptedExchange(raw,{sessionScope:scope,game,nativeDispatch:dispatch,parsedStep:step});
      return raw;
    }
  });
  const requestPort=d.createCurrentNativeRequestPortV2({
    sessionScope:scope,game,DOM:d.DOM,
    readPendingNativeRequests:()=>native.readPendingNativeRequests(),
    /* V2's response guard uses original SG authority, not the SDK's pre-callback SID. */
    readCurrentSessionID:()=>d.readOriginalSessionID(),
    assertOriginalSessionOpen:d.assertOriginalSessionOpen,
    authenticateOriginalResponse:originalSource.source.authenticateOriginalResponse
  });
  function need(ok,message){assert(ok,'AG integrity: own32816 original SG/native binding '+message);}
  function seal(error) {
    if(!sealed)sealed={error,retryAllowed:false};
    requestPort.seal(error);originalSource.ownerHooks.seal(error);
  }
  function guard(stage) {
    need(!sealed,'scope sealed');
    d.assertOriginalSessionOpen({sessionScope:scope,game,stage});
  }
  function originalSID() {
    const sid=d.readOriginalSessionID();
    need(typeof sid==='string'&&sid.length>0,'current original SG SID required');
    return sid;
  }
  function checkRequestSID() {
    need(native.readCurrentSessionID()===originalSID(),'native request SID differs from current original SG authority');
  }
  const providerData=Object.freeze({
    captureCurrentNative() {
      try {
        guard('capture-current-native');
        if(native.readPendingNativeRequests().length)checkRequestSID();
        return requestPort.captureCurrent();
      }catch(error){seal(error);throw error;}
    },
    consumeCurrentNative(event,parameters,requestSessionID) {
      try {
        guard('consume-current-native');checkRequestSID();
        const dispatch=requestPort.consume(event,parameters,requestSessionID);
        lastDispatch=dispatch;return dispatch;
      }catch(error){seal(error);throw error;}
    }
  });
  const originalOwnerHooks=Object.freeze({
    recordAndDeliverOriginalParsedResponse(dispatch,step) {
      try {
        guard('deliver-original-accepted-response');
        need(dispatch===lastDispatch,'one exact current original native dispatch required');
        lastFrame=originalSource.ownerHooks.recordOriginalParsedResponse(dispatch,step);
        const result=requestPort.applyOriginalResponse(dispatch,lastFrame);
        need(native.readCurrentSessionID()===originalSID(),
          'native session did not synchronize with original owner after its callback');
        return Object.freeze({
          nativeResponseCallbackDelivered:result.nativeResponseCallbackDelivered,
          originalParsedStep:result.originalParsedStep,
          nativeSessionMatchesOriginalOwner:true,
          businessSuccessOrCompletionAssessed:false
        });
      }catch(error){seal(error);throw error;}
    },
    seal
  });
  return Object.freeze({
    providerData,originalOwnerHooks,nativeSessionView:native,
    status(){return {gameId:'32816',sealed:!!sealed,dispatchRetained:!!lastDispatch,
      frameRetained:!!lastFrame,retryAllowed:false,
      requestPort:requestPort.status(),responseSource:originalSource.source.status(),
      networkClientIncluded:false,DBWrites:0};}
  });
};
