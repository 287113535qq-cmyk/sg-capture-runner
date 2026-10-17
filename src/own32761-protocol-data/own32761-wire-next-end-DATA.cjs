'use strict';
// Own typed protocol DATA. No transport, display, timer, scheduler or Mongo actor.
exports.createOwn32761WireNextEndDATA=function({DOM,vm,data,choice}){
 const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('OWN32761_WIRE_HOLD_'+code),{own32761WireHold:true,newRequestNotSent:true,retryAllowed:false})};
 need(DOM?.DOMParser&&DOM?.XMLSerializer&&vm?.Script&&choice?.prepare&&data?.schema==='own32761-original-wire-model-DATA-v1261','BOUND_SOURCE_DATA');
 const enabled=new vm.Script('('+data.sourceMetadata.maxWinFunction+')()').runInNewContext({}, {timeout:100});
 need(enabled===true,'ORIGINAL_MAX_METADATA');
 const c=vm.createContext({E:{ic:{get:()=>({DF:1})},at:{Db:0}}});
 const funcs={};for(const [name,text]of Object.entries(data.sourceFunctions))funcs[name]=new vm.Script('('+text+')').runInContext(c,{timeout:100});
 const children=(n,name)=>Array.from(n.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===name);
 const one=(n,name)=>{const a=children(n,name);need(a.length===1,'ONE_'+name);return a[0]};
 const attr=(n,k)=>{const a=n.attributes?.getNamedItem(k);need(a!==null&&a!==undefined,'EXPLICIT_'+k);return a.value};
 const number=(v,label)=>{need(/^-?(?:0|[1-9]\d*)$/.test(v)&&Number.isSafeInteger(Number(v)),label);return Number(v)};
 const nonnegative=(v,label)=>{const n=number(v,label);need(n>=0,label);return n};
 const bool=(v)=>{if(['true','1','y','yes'].includes(v.toLowerCase()))return true;if(['false','0','n','no'].includes(v.toLowerCase()))return false;need(false,'SOURCE_BOOLEAN')};
 const parse=(text,name,type)=>{
  need(typeof text==='string'&&text.length>0&&!/<!DOCTYPE/i.test(text),'RAW_XML');
  const doc=new DOM.DOMParser().parseFromString(text,'text/xml'),root=doc.documentElement;
  need(root?.nodeName===name&&attr(root,'type')===type&&!doc.getElementsByTagName('parsererror').length&&!doc.getElementsByTagName('Error').length&&!doc.getElementsByTagName('Errors').length,'SUCCESSFUL_'+type+'_ENVELOPE');
  return{doc,root};
 };
 const ownHeader=h=>{need(attr(h,'gameID')==='20454'&&attr(h,'versionID')==='1_0','OWN_IDENTITY')};
 const sourceBool=h=>bool(attr(h,'isRecovering'));
 const bound=({sessionScope,source,frame,initFrame})=>{
  need(sessionScope&&source?.readCurrent?.(sessionScope)===frame&&source.readInit?.(sessionScope)===initFrame&&source.has?.(frame)&&source.readNormalCaptureMode?.(sessionScope)==='normal-capture','CURRENT_PRIVATE_CAPTURE');
  need(frame?.msgId==='Logic'&&frame.httpStatus===200&&initFrame?.msgId==='Init'&&initFrame.httpStatus===200,'ACCEPTED_CURRENT_INIT_LOGIC');
  const r=parse(frame.responsePayload,'GameResponse','Logic'),q=parse(frame.requestPayload,'GameRequest','Logic'),i=parse(initFrame.responsePayload,'GameResponse','Init'),iq=parse(initFrame.requestPayload,'GameRequest','Init');
  const rh=one(r.root,'Header'),qh=one(q.root,'Header'),ih=one(i.root,'Header'),iqh=one(iq.root,'Header');
  for(const h of[rh,qh,ih,iqh])ownHeader(h);
  need(!sourceBool(rh)&&!sourceBool(ih),'NONRECOVERY');
  for(const key of['affiliate','ccyCode','channel','freePlay','gameCodeRGI','glsID','lang','promotions','userID','userType','versionID'])need(attr(qh,key)===attr(iqh,key),'BOUND_'+key);
  need(attr(qh,'gameCodeRGI')==='dancingdrumsexplosion','OWN_BACKEND');
  for(const name of['REPLAY','FORCE'])need(!children(q.root,name).length&&!children(iq.root,name).length,'NORMAL_CAPTURE_'+name);
  return{r,q,rh,qh};
 };
 const inspectEndEnvelope=({httpStatus,responsePayload})=>{
  need(httpStatus===200,'END_HTTP_200');const p=parse(responsePayload,'GameResponse','EndGame'),h=one(p.root,'Header');ownHeader(h);need(!sourceBool(h),'END_NONRECOVERY');
  need(attr(h,'sessionID').length>0,'END_ACCEPTED_CURSOR');
  return Object.freeze({recognizedSuccessfulOwnEndEnvelope:true,currentRoundCompletionClaimed:false,newFinalCredit:0});
 };
 return Object.freeze({inspectEndEnvelope,prepare(input){
  const {source,sessionScope,selectionIndex}=input,{r,q,rh,qh}=bound(input);
  const g=one(r.root,'GameResult'),bg=one(g,'BGInfo'),free=children(g,'FSInfo'),decision=children(g,'DecisionInfo');need(free.length<=1&&decision.length<=1,'ONE_OPTIONAL_SOURCE_INFO');
  const cumulativeWin=nonnegative(attr(bg,'totalWagerWin'),'SOURCE_CUMULATIVE_WIN'),paid=nonnegative(attr(one(q.root,'Stake'),'total'),'CURRENT_SOURCE_WAGER');need(paid>0,'POSITIVE_SOURCE_WAGER');
  const max=bool(attr(bg,'isMaxWin')),T={vb:{},state:{},Ok:{}};funcs.clearFree(T.vb);
  const typed={ZA:{ai:max}};T.state.ai=funcs.maxWin(typed);
  if(free.length){
   const dto={};for(const [key,name]of Object.entries(data.typedFS)){const a=free[0].attributes.getNamedItem(name);if(a)dto[key]=number(a.value,'SOURCE_FS_'+name)}
   // Invoke exact own source decoder, preserving null/undefined and its fallbacks.
   funcs.decodeFree.call({T},dto);need(Number.isSafeInteger(T.vb.Ig),'FINITE_SOURCE_REMAINING');
  }
  const picksAttribute=decision.length?decision[0].attributes.getNamedItem('picksAwarded'):null;
  const picks=picksAttribute?nonnegative(picksAttribute.value,'SOURCE_PICK_AWARD'):null;
  if(!T.vb.Jj&&picks>0)return choice.prepare(input);
  need(selectionIndex===undefined,'NO_EXTRA_CHOICE');
  const canClose=funcs.realEndGuard.call({Ixa:{ue:false},settings:{Joa:function OriginalEndDTO(){}},T});
  need(canClose===true||free.length===1,'UNMAPPED_LOGICAL_NEXT');
  const sid=attr(rh,'sessionID');need(sid.length>0,'CURRENT_ACCEPTED_CURSOR');
  qh.setAttribute('sessionID',sid);
  // Source Vba clears zoa before DX; do not replay the preceding explicit choice.
  for(const node of children(q.root,'FreeSpinChoice'))q.root.removeChild(node);
  const event=canClose?'EndGame':'Logic';
  if(canClose){
   for(const n of Array.from(q.root.childNodes))if(n.nodeType===1&&n.nodeName!=='Header')q.root.removeChild(n);
   q.root.setAttribute('type','EndGame');
  }
  return Object.freeze({kind:canClose?'source-EndGame-request-candidate':'source-automatic-free-request-candidate',event,
   action:canClose?'PLAY':'FREE_SPIN',requestPayload:new DOM.XMLSerializer().serializeToString(q.doc),
   sourcePaidTotal:paid,sourceCumulativeWin:cumulativeWin,sourceFreeRemaining:T.vb.Ig,sourceFreePlayed:T.vb.El,
   sourceMaxWin:T.state.ai,EndCandidate:canClose,transportAttempted:false,newProviderACK:false,
   actualSuccessfulEndStillRequired:true,fullOriginalSGAGConnectionNotQualified:true});
 }});
};
