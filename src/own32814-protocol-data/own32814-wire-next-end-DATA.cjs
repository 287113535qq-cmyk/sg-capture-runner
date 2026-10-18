'use strict';
// Protocol DATA only: no transport, UI, native ticks, database or capture actor.
exports.createOwn32814WireNextEndDATA=function({DOM,vm,data}){
 const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('OWN32814_WIRE_HOLD_'+code),{own32814WireHold:true,newRequestNotSent:true,retryAllowed:false})};
 need(data?.schema==='own32814-original-protocol-next-end-DATA-v1338'&&DOM?.DOMParser&&vm?.Script,'OWN_SOURCE_DATA');
 const c=vm.createContext({B:{bc:{get:()=>({EI:1})},Er:{Sa:0}}}),funcs={};
 for(const name of ['KCa','dsa','MAa']){const source=data.sourceFunctions[name].source;funcs[name]=new vm.Script('(function(){const d={prototype:{}};'+source+'return d.prototype.'+name+'})()').runInContext(c,{timeout:100})}
 const children=(n,name)=>Array.from(n.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===name);
 const one=(n,name)=>{const a=children(n,name);need(a.length===1,'ONE_'+name);return a[0]};
 const attr=(n,k)=>{const a=n?.attributes?.getNamedItem(k);need(a!=null,'EXPLICIT_'+k);return a.value};
 const number=(v,label)=>{need(/^-?(?:0|[1-9]\d*)$/.test(v)&&Number.isSafeInteger(Number(v)),label);return Number(v)};
 const nonnegative=(v,label)=>{const n=number(v,label);need(n>=0,label);return n};
 const bool=v=>{if(['1','true','y'].includes(v.toLowerCase()))return true;if(['0','false','n'].includes(v.toLowerCase()))return false;need(false,'SOURCE_BOOLEAN')};
 const parse=(text,event)=>{need(typeof text==='string'&&text.length>0&&!/<!DOCTYPE/i.test(text),'RAW_XML');const doc=new DOM.DOMParser().parseFromString(text,'text/xml'),root=doc.documentElement;need(root?.nodeName==='GameResponse'&&attr(root,'type')===event&&!doc.getElementsByTagName('parsererror').length&&!doc.getElementsByTagName('Error').length&&!doc.getElementsByTagName('Errors').length,'SUCCESSFUL_'+event+'_ENVELOPE');return{doc,root}};
 const ownHeader=h=>need(attr(h,'gameID')==='20287'&&attr(h,'versionID')==='1_0','OWN_HEADER');
 const inspectEndEnvelope=({httpStatus,responsePayload})=>{need(httpStatus===200,'END_HTTP_200');const {root}=parse(responsePayload,'EndGame'),h=one(root,'Header');ownHeader(h);need(attr(h,'isRecovering')==='N'&&attr(h,'sessionID').length>0,'CURRENT_END_CURSOR');return Object.freeze({recognizedSuccessfulOwnEndEnvelope:true,currentRoundCompletionClaimed:false,newFinalCredit:0})};
 return Object.freeze({inspectEndEnvelope,prepare(input){
  const{sessionScope,source,frame,initFrame}=input;
  need(sessionScope&&source?.readCurrent?.(sessionScope)===frame&&source.readInit?.(sessionScope)===initFrame&&source.has?.(frame)&&source.readNormalCaptureMode?.(sessionScope)==='normal-capture','CURRENT_PRIVATE_CAPTURE');
  need(frame?.msgId==='Logic'&&frame.httpStatus===200&&initFrame?.msgId==='Init'&&initFrame.httpStatus===200,'ACCEPTED_CURRENT_INIT_LOGIC');
  const{root}=parse(frame.responsePayload,'Logic');parse(initFrame.responsePayload,'Init');const doc=new DOM.DOMParser().parseFromString(frame.requestPayload,'text/xml'),q=doc.documentElement;
  need(q?.nodeName==='GameRequest'&&attr(q,'type')==='Logic','SOURCE_REQUEST');
  const h=one(root,'Header'),qh=one(q,'Header');ownHeader(h);ownHeader(qh);need(attr(h,'isRecovering')==='N'&&attr(qh,'gameCodeRGI')==='wildstreets','NORMAL_OWN_RESPONSE');
  const iq=new DOM.DOMParser().parseFromString(initFrame.requestPayload,'text/xml'),ih=one(iq.documentElement,'Header');ownHeader(ih);
  for(const k of ['affiliate','ccyCode','channel','freePlay','gameCodeRGI','glsID','lang','promotions','userID','userType','versionID'])need(attr(qh,k)===attr(ih,k),'BOUND_'+k);
  for(const name of ['REPLAY','FORCE'])need(!children(q,name).length&&!children(iq.documentElement,name).length,'NORMAL_'+name);
  need(attr(qh,'ccyCode')===attr(qh,'lang'),'OWN_JN_LANGUAGE_CURRENCY');
  const paid=nonnegative(attr(one(q,'Stake'),'total'),'SOURCE_WAGER'),lines=nonnegative(attr(one(q,'PaylineCount'),'count'),'SOURCE_PAYLINES');need(paid>0&&lines>0,'POSITIVE_REQUEST_DATA');
  const requestGamble=one(q,'Gamble');need(['0','1'].includes(attr(requestGamble,'collect')),'SOURCE_COLLECT_INPUT');
  const g=one(root,'GameResult'),bg=one(g,'BGInfo'),free=children(g,'FSInfo');need(free.length<=1,'ONE_OPTIONAL_FREE');
  const cumulativeWin=nonnegative(attr(bg,'totalWagerWin'),'SOURCE_CUMULATIVE_WIN'),J={eb:{},state:{}};
  J.state.Qh=funcs.dsa({jH:{Qh:bool(attr(bg,'isMaxWin'))}});
  if(free.length){const f=free[0],dto={bX:nonnegative(attr(f,'freeSpinNumber'),'SOURCE_PLAYED'),cX:nonnegative(attr(f,'freeSpinsTotal'),'SOURCE_TOTAL')};funcs.MAa.call({J},dto);need(Number.isSafeInteger(J.eb.Df)&&J.eb.Df>=0,'SOURCE_REMAINING');}
  let collect=false;
  for(const name of ['GambleInfo','ConsolationGamble']){const a=children(g,name);need(a.length<=1,'ONE_'+name);if(a.length){const finished=attr(a[0],'gambleFinished');need(['0','1'].includes(finished),'SOURCE_'+name+'_FINISHED');if(finished==='0')collect=true}}
  need(!J.state.Qh||!collect,'MAX_PENDING_GAMBLE_CALLER');
  const canClose=!collect&&funcs.KCa.call({$Ba:{pd:false},J});
  const sid=attr(h,'sessionID');need(sid.length>0,'CURRENT_ACCEPTED_CURSOR');qh.setAttribute('sessionID',sid);
  if(canClose){for(const n of Array.from(q.childNodes))if(n.nodeType===1&&n.nodeName!=='Header')q.removeChild(n);q.setAttribute('type','EndGame')}
  else requestGamble.setAttribute('collect',collect?'1':'0');
  return Object.freeze({kind:canClose?'source-EndGame-request-candidate':collect?'source-explicit-collect-request-candidate':'source-automatic-free-request-candidate',event:canClose?'EndGame':'Logic',action:canClose?'PLAY':'FREE_SPIN',requestPayload:new DOM.XMLSerializer().serializeToString(doc),sourcePaidTotal:paid,sourcePaylineCount:lines,sourceCumulativeWin:cumulativeWin,sourceFreeRemaining:J.eb.Df,sourceFreePlayed:J.eb.ej,sourceMaxWin:J.state.Qh,sourceCollect:collect?1:undefined,EndCandidate:canClose,transportAttempted:false,newProviderACK:false,actualSuccessfulEndStillRequired:true,fullOriginalSGAGConnectionNotQualified:true});
 }});
};
