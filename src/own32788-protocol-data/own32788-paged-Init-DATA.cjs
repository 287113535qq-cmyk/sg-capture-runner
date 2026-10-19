'use strict';
exports.createOwn32788PagedInitDATA=function({DOM,vm,data}){
 const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('OWN32788_INIT_HOLD_'+code),{newRequestNotSent:true,retryAllowed:false})};
 need(data?.schema==='own32788-paged-Init-source-DATA-v1547'&&DOM?.DOMParser&&vm?.Script,'OWN_DATA');
 const sgigame={GameEvent:Object.assign(function(type){this.type=type},{INIT_STAGE_COMPLETE:'GameEvent_INIT_STAGE_COMPLETE',INIT_COMPLETE:'GameEvent_INIT_COMPLETE'})};
 const ctx=vm.createContext({sgigame,_super:{prototype:{execute(){}}},server:{GLSRequest:function(encoders){this.encoders=encoders}}});
 const own=k=>new vm.Script('('+data.leaves[k].source+')').runInContext(ctx,{timeout:100});sgigame.PageEncoder=own('pageConstructor');sgigame.PageEncoder.prototype.parse=own('pageEncoder');sgigame.PageData=own('pageDataConstructor');
 const make=own('makeInit'),parsePage=own('pageParser'),check=own('checkInit');
 const attr=(e,k)=>{const a=e?.attributes?.getNamedItem(k);need(a!=null,'EXPLICIT_'+k);return a.value};
 const num=(s,k)=>{need(/^(?:0|[1-9]\d*)$/.test(s)&&Number.isSafeInteger(Number(s)),k);return Number(s)};
 return Object.freeze({prepare({sessionScope,source,frame}){
  need(sessionScope&&source?.readCurrent?.(sessionScope)===frame&&source.has?.(frame),'CURRENT_PRIVATE_FRAME');need(frame?.msgId==='Init'&&frame.httpStatus===200,'CURRENT_SUCCESSFUL_INIT');
  const text=frame.responsePayload;need(typeof text==='string'&&!/<!DOCTYPE/i.test(text),'RAW_XML');const d=new DOM.DOMParser().parseFromString(text,'text/xml'),root=d.documentElement;
  need(root?.nodeName==='GameResponse'&&attr(root,'type')==='Init'&&!d.getElementsByTagName('parsererror').length&&!d.getElementsByTagName('Error').length&&!d.getElementsByTagName('Errors').length,'SUCCESSFUL_INIT_ENVELOPE');
  const hs=Array.from(d.getElementsByTagName('Header'));need(hs.length===1,'ONE_HEADER');const header=hs[0];need(attr(header,'gameID')==='20158'&&attr(header,'versionID')==='1_0'&&attr(header,'isRecovering')==='N'&&attr(header,'sessionID').length>0,'OWN_NORMAL_HEADER');
  const infos=Array.from(d.getElementsByTagName('PageInfo')),pages=Array.from(d.getElementsByTagName('Page'));need(infos.length===1&&pages.length===1,'EXPLICIT_PAGE_DATA');const count=num(attr(infos[0],'pageCount'),'PAGE_COUNT'),index=num(attr(pages[0],'pageIndex'),'PAGE_INDEX');need(count>0&&index<count,'OWN_PAGE_DOMAIN');
  const response={};parsePage(d,response);need(response.pageData.pageCount===count&&response.pageData.pageIndex===index,'OWN_PARSER');let branch,adapterCalls=0;const server={getInitResponse:()=>response,getInitResquester:()=>({getRequestObject:()=>frame})};
  check.call({_server:server,eventDispatcher:{dispatchEvent:e=>{need(branch===undefined,'ONE_BRANCH');branch=e.type}},_partnerAdapter:{receivedGameLogicResponse:x=>{need(x===frame,'BOUND_FRAME');adapterCalls++}}});need(adapterCalls===(index===0?1:0),'OWN_FIRST_PAGE_NOTICE');
  if(branch===sgigame.GameEvent.INIT_COMPLETE){need(index===count-1,'OWN_LAST_PAGE');return Object.freeze({kind:'source-Init-pages-complete',pageIndex:index,pageCount:count,InitPagesComplete:true,roundEndCandidate:false,currentRoundCompletionClaimed:false,transportAttempted:false,newProviderACK:false});}
  need(branch===sgigame.GameEvent.INIT_STAGE_COMPLETE&&index<count-1,'OWN_NEXT_PAGE');let candidate;
  make.call({_server:{...server,makeInitRequest:q=>{need(candidate===undefined&&q.encoders.length===1,'ONE_PAGE_REQUEST');candidate=q.encoders[0].parse()}},_historyModel:{getIsHistoryReplay:()=>false}});
  need(candidate==='<Page number="'+(index+1)+'"/>','OWN_ENCODER');return Object.freeze({kind:'source-next-Init-page-request-candidate',event:'Init',requestDataXML:candidate,pageIndex:index,pageCount:count,nextPage:index+1,sessionCursorFromCurrentAcceptedHeader:true,roundEndCandidate:false,currentRoundCompletionClaimed:false,transportAttempted:false,newProviderACK:false});
 }});
};
