"use strict";
const {DOMParser}=require("../own32772-native-data/own32769-node-dom.cjs");
function need(ok,reason){if(!ok)throw Object.assign(new Error("AG integrity: own32777 "+reason),{code:"OWN32777_NATIVE_ENV_HOLD",reason});}
function parseOwnXML(text){need(typeof text==="string"&&text.length>0,"ACTUAL_XML_REQUIRED");const d=new DOMParser().parseFromString(text,"text/xml");need(d.documentElement&&!d.getElementsByTagName("parsererror").length,"ACTUAL_XML_VALID");return d;}
function oneOwn(root,name){const values=root.getElementsByTagName(name);need(values.length===1,"ONE_"+name+"_REQUIRED");return values[0];}
function rawOwnUInt(text,label,positive=false){need(typeof text==="string"&&/^\d+$/.test(text),"RAW_"+label);const n=Number(text);need(Number.isSafeInteger(n)&&(!positive||n>0),"SAFE_"+label);return n;}
function createOwn32777NativeEnvironment(input){
 const {session,game,source,limits,receiveNative,current,record}=input;
 need(typeof input.nativeHostFactory==="function","OWN_ORIGINAL_NATIVE_HOST_FACTORY_REQUIRED");
 for(const k of ["maxNativeTicks","maxMicrotasks","tickMilliseconds"])need(Number.isSafeInteger(limits?.[k])&&limits[k]>0,"EXPLICIT_"+k);
 need(limits.tickMilliseconds<=1000,"BOUNDED_NATIVE_CLOCK_DELTA");
 const host=input.nativeHostFactory({session,game,source,limits,current,record});
 const c=host.context;need(c?.F?.cj?.Nh&&c.Z?.Hg?.Hg&&typeof host.initialSettings==="function"&&typeof host.installRoot==="function","ORIGINAL_OWN_SOURCE_HOST_REQUIRED");
 let engine,I,root,adopted=false,closed=false,active=null,operation=null,operationDone=false,operationError=null,operationResult=null,lastFrame=null,winRaw,paidCap=null,paidEmissions=0;
 const ownRequests=new WeakSet();
 function live(){current();need(!closed,"NATIVE_HOST_CLOSED");}
 function originalResponseHeader(){return engine?.Ki?.om;}
 class NativeWireXHR {
  constructor(){this.handlers=Object.create(null);this.headers=Object.create(null);this.status=0;this.statusText="";}
  addEventListener(name,fn){this.handlers[name]=fn;}
  open(method,url,async){live();need(method==="POST"&&url===game.sg.endpoint&&async===true,"NATIVE_ORIGINAL_AG_ENDPOINT");this.method=method;this.endpoint=url;}
  setRequestHeader(k,v){this.headers[k]=v;}
  send(document){live();need(!active,"ONE_PENDING_NATIVE_WIRE");const payload=typeof document==="string"?document:c.__ownSerializeXML(document);const d=parseOwnXML(payload);const event=d.documentElement.getAttribute("type");need(d.documentElement.nodeName==="GameRequest"&&["Logic","EndGame"].includes(event),"OWN_NATIVE_GAMEPLAY_REQUEST_ONLY");const request=Object.freeze({event,payload,endpoint:this.endpoint,headers:Object.freeze({...this.headers}),xhr:this});ownRequests.add(request);active=request;receiveNative(request);}
 }
 function track(p){operationDone=false;operationError=null;operationResult=null;operation=Promise.resolve(p);operation.then(v=>{operationDone=true;operationResult=v},e=>{operationDone=true;operationError=e});}
 async function micro(){for(let n=0;n<limits.maxMicrotasks;n++)await Promise.resolve();if(operationError)throw operationError;const errors=root?.readErrors?.();if(errors?.length)throw errors[errors.length-1];}
 function nativeEndClosed(){return adopted&&lastFrame?.msgId==="EndGame"&&I.state.state===c.F.Ba.ka.ga.qg&&root.isOriginalProtocolIdle()&&originalResponseHeader()===lastFrame.responseSessionID;}
 return Object.freeze({
  adoptInit(frame){
   live();need(!adopted&&source.has(frame)&&source.readInit(session)===frame,"ONE_CURRENT_INIT_MODEL_ADOPTION");
   const requestDoc=parseOwnXML(frame.requestPayload),h=oneOwn(requestDoc,"Header");need(requestDoc.documentElement.getAttribute("type")==="Init"&&h.getAttribute("gameID")==="20468"&&h.getAttribute("versionID")==="1_0","ACTUAL_OWN_INIT_REQUEST");
   const initRequest=new c.SG.Mc.ne.Ht.yn();c.F.cj.Nh.l6(initRequest,new c.DOMParser().parseFromString(frame.requestPayload,"text/xml"));
   need(!initRequest.bv&&initRequest.ti.om===frame.requestSessionID,"FRESH_NONREPLAY_INIT_DATA");
   const typedHeader=initRequest.ti,settings=host.initialSettings();
   need(settings&&settings.cn,"OWN_PINNED_NATIVE_SETTINGS");
   const contentType=frame.requestHeaders?.["Content-Type"]||frame.requestHeaders?.["content-type"];
   need(typeof contentType==="string"&&contentType.length>0,"ORIGINAL_INIT_CONTENT_TYPE_REQUIRED");
   settings.cn={...settings.cn,endpoint:game.sg.endpoint,contentType,VM:typedHeader.VM,channel:typedHeader.channel,fOa:typedHeader.gOa,jA:typedHeader.jA,UV:typedHeader.UV,zba:typedHeader.zba,Eba:typedHeader.Eba};
   host.bindOriginalPlatform(initRequest,frame);
   c.XMLHttpRequest=NativeWireXHR;
   I={};c.Z.Ba.clear(I);engine=new c.Z.Hg.Hg(settings,I);
   const originalNativeJv=engine.jv;need(typeof originalNativeJv==='function','ORIGINAL_NATIVE_JV_REQUIRED');
   engine.jv=function(...args){live();need(this===engine&&paidCap&&source.hasOriginalAGRoundIntent(session,paidCap)&&++paidEmissions===1&&!active,'ONE_ORIGINAL_PREPLAY_PAID_EMISSION');const nativeContext=c.__jpBase?.ctx;need(c.__jpMachine?.JN instanceof c.Z.ie.ZF&&nativeContext?.DX===false&&Array.isArray(nativeContext.features)&&nativeContext.features.length===0,'ACTUAL_ORIGINAL_PREPLAY_RESET_AND_REQUEST_ORIGIN');record('original-prePlay-paid-emission',{mainState:c.__jpMachine.JN.name,DXResetByNativePrePlay:true,featuresClearedByNativePrePlay:true,reelState:nativeContext.qf.state.value});const promise=Reflect.apply(originalNativeJv,this,args);track(promise);return promise;};
   const decodedInit=new c.Z.Hg.IB(null);c.F.cj.Nh.l6(decodedInit,new c.DOMParser().parseFromString(frame.responsePayload,"text/xml"));engine.uO(decodedInit);
   let selected=-1;for(let n=0;n<I.La.wc.length;n++)if(c.F.$.Ba.Jb.qh(I.La,I.La.wc[n]).value===game.sg.betRaw){need(selected===-1,"ONE_NATIVE_LEGAL_SELECTED_STAKE");selected=n;}
   need(selected>=0,"ACTUAL_INIT_LEGAL_OWN_STAKE");I.La.Xd=selected;
   need(engine.Ki.om===frame.responseSessionID,"NATIVE_INIT_RESPONSE_TOKEN");
   root=host.installRoot({context:c,engine,I,initFrame:frame});
   need(root&&typeof root.afterOriginalLogic==="function"&&typeof root.afterOriginalEnd==="function"&&typeof root.advance==="function"&&typeof root.isOriginalProtocolIdle==="function"&&typeof root.readErrors==="function","ORIGINAL_NATIVE_ROOT_CALLBACKS_REQUIRED");
   adopted=true;lastFrame=frame;record("original-Init-adopted",{wireRequests:0,stakeRaw:game.sg.betRaw,connectionDataBound:true});
  },
  beginPaid(cap){live();need(adopted&&!active&&(lastFrame?.msgId==='Init'||lastFrame?.msgId==='EndGame'&&nativeEndClosed()),'ACTUAL_INIT_OR_TRUE_CURRENT_END_IDLE_BOUNDARY');need(root.paidEmissionOwner==='original-native-prePlay'&&typeof root.startOriginalPaidEmission==='function','ORIGINAL_PREPLAY_ROOT_REQUIRED');paidCap=cap;paidEmissions=0;winRaw=undefined;operation=null;operationDone=false;operationError=null;operationResult=null;root.beginOriginalPaid(cap);root.startOriginalPaidEmission(cap);},
  async waitForPaidEmission(){live();for(let ticks=0;ticks<=limits.maxNativeTicks;ticks++){await micro();if(active){need(active.event==='Logic'&&paidEmissions===1,'ONE_NATIVE_PREPLAY_LOGIC');return;}need(ticks<limits.maxNativeTicks,'ORIGINAL_PREPLAY_PAID_EMISSION_FINITE_BOUND');root.advance(limits.tickMilliseconds);}},
  async accept(frame,request){
   live();need(active===request&&ownRequests.has(request)&&frame.msgId===request.event,"ONE_MATCHING_NATIVE_RESPONSE_DELIVERY");
   active=null;lastFrame=frame;request.xhr.status=frame.httpStatus;request.xhr.responseText=frame.responsePayload;request.xhr.responseXML=new c.DOMParser().parseFromString(frame.responsePayload,"text/xml");need(typeof request.xhr.handlers.load==="function","ORIGINAL_NATIVE_XHR_LOAD_HANDLER");request.xhr.handlers.load({type:"load"});await micro();
   if(frame.msgId==="Logic"){
    need(operationDone&&!operationError&&operationResult&&!operationResult.Zf,"ORIGINAL_FE_CDB_AND_NP_COMPLETED");
    const d=parseOwnXML(frame.responsePayload);winRaw=rawOwnUInt(oneOwn(d,"BGInfo").getAttribute("totalWagerWin"),"actual current totalWagerWin");
    need(Array.isArray(I.yc)&&I.yc.length>0&&I.yc.every(x=>Number.isSafeInteger(x.yb.Ud)&&x.yb.Ud>=0)&&I.yc.reduce((s,x)=>s+x.yb.Ud,0)===winRaw,"ORIGINAL_NATIVE_WAGER_WIN_ASSOCIATION");
    root.afterOriginalLogic(frame);
   }else root.afterOriginalEnd(frame);
  },
  async drive(){live();for(let ticks=0;ticks<=limits.maxNativeTicks;ticks++){await micro();if(active||nativeEndClosed())return;need(ticks<limits.maxNativeTicks,"ACTUAL_NATIVE_NEXT_CALLBACK_UNMAPPED");root.advance(limits.tickMilliseconds);}throw Error("unreachable native bound");},
  actualTotalWagerWinRaw(){need(Number.isSafeInteger(winRaw)&&winRaw>=0,"ACTUAL_CURRENT_NATIVE_WIN_REQUIRED");return winRaw;},
  readOriginalAGFeatureDecision(){live();need(lastFrame?.msgId==="Logic"&&typeof root.readOriginalAGFeatureDecision==="function","ACTUAL_NATIVE_FEATURE_SOURCE_REQUIRED");return root.readOriginalAGFeatureDecision();},
  nativeEndClosed,
  close(){if(closed)return;closed=true;host.close?.();},
  debugSourceOnly(){return {context:c,engine,I,root};}
 });
}
module.exports=Object.freeze({createOwn32777NativeEnvironment,parseOwnXML,oneOwn,rawOwnUInt});
