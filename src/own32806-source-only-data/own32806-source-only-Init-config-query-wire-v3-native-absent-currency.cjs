'use strict';
// Pure own protocol DATA. No network, callbacks, native host, or source ownership.
exports.createOwn32806InitConfigWireDATA=function({DOM,vm,data,nextData}){
 const need=(v,m)=>{if(!v)throw Object.assign(new Error('own32806 config-wire hold: '+m),{retryAllowed:false})};
 const has=(o,k)=>o!=null&&Object.prototype.hasOwnProperty.call(o,k);
 need(DOM?.DOMParser&&vm?.Script&&data?.schema==='own32806-source-only-Init-config-query-wire-DATA-v1'&&nextData?.schema==='own32806-source-only-next-End-DATA-v1','own dependencies');
 const ctx=vm.createContext({server:{PlatformData:function(){}},sgigame:{}});
 const run=s=>new vm.Script(s).runInContext(ctx,{timeout:100}),fn=k=>run('('+data.newLeaves[k].source+')');
 run('var __extends=function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d;}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __());};');
 for(const [k,ns]of [['BetData','server'],['BetInfo','sgigame'],['Bet','sgigame'],['PayLineCountInfo','sgigame'],['GLSHeader','server'],['GLSCurrencyEncoder','server'],['GLSRequest','server']])
  run(data.newLeaves[k].source+';'+ns+'.'+k+'='+k+';');
 run(data.newLeaves.URLParts.source+';'+data.newLeaves.URL.source+';');
 const parsePlatform=fn('PlatformParser'),parseLines=fn('PayLineParser'),parseBets=fn('BetParser');
 const history=run('('+nextData.newLeaves.HistoryReplay.source+')'),stake=run('('+nextData.newLeaves.StakeEncoder.source+')');
 const configs=new WeakMap(),params=new WeakMap();
 const pos=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
 function normal(q){need(has(q,'HistoryServerURL'),'actual original launch query required');need(!history.call({_url:{queryData:k=>q[k]}}),'history input requires own history route');}
 function readInitConfig(responsePayload){
  need(typeof responsePayload==='string'&&!/<!DOCTYPE/i.test(responsePayload),'complete actual Init XML');
  const doc=new DOM.DOMParser().parseFromString(responsePayload,'text/xml'),r=doc.documentElement,hs=doc.getElementsByTagName('Header');
  need(r?.nodeName==='GameResponse'&&r.getAttribute('type')==='Init'&&hs.length===1&&!['Error','Errors','parsererror'].some(k=>doc.getElementsByTagName(k).length),'successful own Init');
  need(hs[0].getAttribute('gameID')==='20128'&&hs[0].getAttribute('isRecovering')==='N','own normal Init header');
  const stakes=Array.from(doc.getElementsByTagName('Stakes')),cs=doc.getElementsByTagName('CurrencyMultiplier');
  need(stakes.length>0&&cs.length<=1&&(cs.length===0||/^[0-9]+$/.test(cs[0].textContent.trim())),'actual valid Init Stakes/currency or exact native absent-node branch');
  const sourceCurrency=cs.length===1?parseInt(cs[0].textContent,10):null;need(cs.length===0||(Number.isSafeInteger(sourceCurrency)&&sourceCurrency>0),'positive explicit currency multiplier');
  for(const s of stakes){need(/^[0-9]+$/.test(s.getAttribute('paylineCount'))&&Number(s.getAttribute('paylineCount'))>0,'actual valid Init line');need(s.textContent.split('|').every(v=>v.trim()!==''&&pos(Number(v))),'actual nonempty Init stakes');}
  const o={};parsePlatform(doc,o);parseLines(doc,o);parseBets(doc,o);
  const lines=o.payLineCountInfo.getLinecounts(),menus=o.multibetData.getAvailableBetArray(),lineDefault=o.payLineCountInfo.getDefaultIndex(),betDefault=o.multibetData.getDefaultIndex();
  need(new Set(lines).size===lines.length&&lines.every(Number.isSafeInteger)&&lines.every(x=>x>0),'unambiguous native line menu');
  need(Number.isSafeInteger(betDefault)&&betDefault>=0&&betDefault<menus[lineDefault].length&&Number.isSafeInteger(o.platformData.currencyMultiplier)&&o.platformData.currencyMultiplier>0&&(cs.length===0||o.platformData.currencyMultiplier===sourceCurrency),'valid actual native Init default index/currency');
  const capsule=Object.freeze({lineMenu:Object.freeze(Array.from(lines)),betMenus:Object.freeze(Array.from(menus,row=>Object.freeze(Array.from(row)))),nativeDefaultLineIndex:lineDefault,nativeDefaultBetIndex:betDefault,currencyMultiplier:o.platformData.currencyMultiplier});
  configs.set(capsule,{o});return capsule;
 }
 function selectParams(config,selection){
  const c=configs.get(config);need(c&&selection&&pos(selection.totalStake)&&Number.isSafeInteger(selection.paylineCount)&&selection.paylineCount>0,'same parsed Init and explicit paid selection');
  const li=config.lineMenu.indexOf(selection.paylineCount),bi=li<0?-1:config.betMenus[li].indexOf(selection.totalStake);need(li>=0&&bi>=0,'explicit selection absent from same native Init');
  const lines={getLines:fn('LineGetLines'),setData:fn('LineSetData'),getCurrentLine:fn('LineGetCurrent'),setCurrentLineIndex:fn('LineSetIndex'),getCurrentLineIndex:fn('LineGetIndex')};
  lines.setData(c.o.payLineCountInfo.getLinecounts(),c.o.payLineCountInfo.getDefaultIndex());
  const bets={_paylinecountController:lines,setData:fn('BetSetData'),getCurrentBet:fn('BetGetCurrent'),setBetIndex:fn('BetSetIndex'),getCurrentLineIndex:fn('BetGetLineIndex')};bets.setData(c.o.multibetData);
  // Same original selection order on local DATA; no UI event or paid action.
  lines.setCurrentLineIndex(li);bets.setBetIndex(bi);
  const p=Object.freeze({totalStake:bets.getCurrentBet().getTotalBet(),paylineCount:lines.getCurrentLine(),currencyMultiplier:config.currencyMultiplier});
  need(p.totalStake===selection.totalStake&&p.paylineCount===selection.paylineCount,'native current selection mismatch');params.set(p,config);return p;
 }
 function readLaunchQuery(actualLaunchURL){
  need(typeof actualLaunchURL==='string'&&actualLaunchURL.length>0,'actual launch URL required');
  const url=new ctx.URL(actualLaunchURL);
  return Object.freeze({HistoryServerURL:url.queryData('HistoryServerURL')});
 }
 function encodeNormalRequest(b){
  need(b&&['Init','Logic','EndGame'].includes(b.event),'native event');normal(b.nativeLaunchQuery);
  need(has(b,'promoInfo')&&b.promoInfo===null&&has(b,'freeRoundInfo')&&b.freeRoundInfo===null,'actual explicit ordinary platform mode; promo FR-Info retained as hold');
  need(typeof b.currentSessionID==='string'&&b.currentSessionID&&typeof b.metadata?.isRealMoney==='function'&&typeof b.metadata.getGameCode==='function'&&typeof b.metadata.getLocale==='function'&&typeof b.sessionData?.getContextID==='function'&&typeof b.sessionData.getPlayerID==='function','actual own metadata/session values');
  need(b.metadata.getGameCode()==='spartacus_prt'&&typeof b.metadata.isRealMoney()==='boolean','own game metadata');
  for(const value of [b.currentSessionID,b.metadata.getLocale(),b.sessionData.getContextID(),b.sessionData.getPlayerID()])need(typeof value==='string'&&value.length>0&&!/[&<>"']/u.test(value),'actual safely encodable original Header value');
  const encoders=[];
  if(b.event==='Logic'){const p=b.nativeRequestParams;need(params.has(p),'current selection from same parsed actual Init');encoders.push({parse:()=>stake.call({_betper2line:p.totalStake,_paylineCount:p.paylineCount})},new ctx.server.GLSCurrencyEncoder(p.currencyMultiplier));}
  const body=fn(b.event==='Init'?'InitWire':b.event==='Logic'?'LogicWire':'EndWire').call({_partnerAdapter:{getSessionData:()=>b.sessionData},_metaData:b.metadata,_sessionId:b.currentSessionID,_glmId:'20128',_glmVersion:'1_0'},new ctx.server.GLSRequest(encoders));
  return Object.freeze({event:b.event,requestPayload:body,requestHeaders:Object.freeze({'Content-Type':'text/xml'}),networkIncluded:false});
 }
 return Object.freeze({readInitConfig,selectParams,readLaunchQuery,encodeNormalRequest});
};
