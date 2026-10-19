'use strict';
// Own Arthur protocol projection. No UI/controller/event/timer objects are constructed.
const nativeFreeClear = function(a){a.Fi=!1;a.mn=null;a.Vh=null;a.winAmount=null;a.yK=null};
const nativeFSUpdate = function(a){this.T.vb.mn=(null!=a.Fra?a.Fra:a.t4a)||0;this.T.vb.Fi=0<this.T.vb.mn;this.T.vb.Vh=(null!=a.Q$?a.Q$-this.T.vb.mn:a.Vda)||0;this.T.vb.winAmount=a.IUa;this.T.vb.yK=a.yK||0};
const nativeQxa = function(a){this.T.features.qR=!0;this.T.features.Pe={};this.T.features.Pe.UF=a.UF;this.T.features.Pe.index=
a.index;this.T.features.Pe.BQ=a.BQ;this.T.features.Pe.x$=a.x$;this.T.features.Pe.TF=a.TF;this.T.features.Pe.cib=a.Y0a;this.T.features.Pe.f1=a.e_a;this.T.features.Pe.JG=a.JG;this.T.features.Pe.mza=a.mza};
const nativeCQ = function(a){return E.nc.get().sw!==E.Fp.yb?this.T.vb.Fi?a.EK.Uf:a.TP.Uf:!1};
const nativeB0 = function(){return this.xya.Mg||!this.settings.vpa||0<this.T.vb.Vh&&!this.T.state.Uf?!1:!0};
const metadataMaxEnabled = (function(){return"on"==="ON".toLowerCase()})();
const modeNone={},modeEnabled={};
const E={Fp:{yb:modeNone},nc:{get:()=>({sw:metadataMaxEnabled?modeEnabled:modeNone})}};
const replayHistory = function(){var a=E.URL.getParameter("HistoryServerURL");return"null"!=a?a:null};
const replayBet = function(){var a=E.URL.getParameter("betID");return"null"!=a?a:null};
const sourceFactories=Object.freeze({freeLogic:'R.zf.px.Ip',decision:'R.zf.px.A2',EndGame:'SG.hd.gM'});
function createOwn32754RequestOnlyPostDecision({game,sessionScope,launchParameters,readOriginalState}){
 const own=(o,k)=>o!=null&&Object.prototype.hasOwnProperty.call(o,k),hold=m=>{throw Error('Arthur32754 request-only hold: '+m)};
 if(!game||String(game.gameId)!=='32754'||game.dbName!=='sg_arthurandtheroundtable'||!sessionScope||typeof readOriginalState!=='function')hold('exact original game/session ports');
 for(const k of ['HistoryServerURL','betID','useDummy'])if(!own(launchParameters,k))hold('actual launch parameter fact '+k);
 // Same URL null handling and predicate as the registered SG.oh.vab/I2 source.
 const paramEnv={URL:{getParameter:k=>launchParameters[k]}};
 const getHistory=Function('E','return ('+replayHistory.toString()+')')(paramEnv),getBet=Function('E','return ('+replayBet.toString()+')')(paramEnv);
 const replayMode=getHistory()!=null&&getBet()!=null;
 if(replayMode||launchParameters.useDummy)hold('actual history replay or useDummy mode');
 let T=null,phase='unseeded',frame=null,roundScope=null,version=0,inFlight=null;
 const tokens=new WeakMap();
 function current(){const s=readOriginalState();if(!s||s.game!==game||s.sessionScope!==sessionScope||s.closed!==false||s.normalRoutePolicy!=='original-private-no-history-no-recovery'||s.executionUnknown===true)hold('current original normal session; unknowns stay sealed');
  if(!s.roundScope||typeof s.sessionID!=='string'||!s.sessionID||s.sessionID==='SESSION_ID')hold('actual round/current SID without fallback');
  if(roundScope&&s.roundScope!==roundScope)hold('same original round');
  const init=s.originalInitFrame;if(!init||init.game!==game||init.sessionScope!==sessionScope||init.httpStatus!==200||!init.requestPayload||!init.responsePayload||init.msgId!=='Init')hold('retained actual original Init exchange');return s;}
 function accepted(next,response,kind){const s=current();if(s.originalAcceptedFrame!==next||next.game!==game||next.sessionScope!==sessionScope||next.roundScope!==s.roundScope||next.responseSessionID!==s.sessionID||s.moneyCommittedFrame!==next||!own(s,'totalWinRaw'))hold('exact current frame/round/SID and original AG money commit');
  if(next.msgId!==kind||next.httpStatus!==200||!next.requestPayload||!next.responsePayload||next.nativeResponse!==response||!response||response.Lf!==false)hold('actual complete native-parsed successful exchange');return s;}
 function cloneT(){return {vb:{...T.vb},state:{...T.state},features:{...T.features}};}
 function coreModel(response){const r=response.zl;if(!r||!r.TP)hold('current typed GameResult/BGInfo');const t={vb:{},state:{},features:{}};nativeFreeClear(t.vb);if(r.EK)nativeFSUpdate.call({T:t},r.EK);if(r.QB)nativeQxa.call({T:t},r.QB);if(r.PBa)t.features.Kl={index:r.PBa.index,H$:r.PBa.H$};t.state.Uf=nativeCQ.call({T:t},r);return t;}
 function postDecisionTarget(t){const p=t.features.Pe;if(!p||!(p.BQ===0||p.BQ===1))hold('actual Excalibur type from typed QB');return p.BQ===0?'free-first':'outer-finish';}
 function seedEntryLogic(next,response){if(T||inFlight)hold('single current core seed, never replay');const s=accepted(next,response,'Logic'),t=coreModel(response),wheel=t.features.Kl,p=t.features.Pe;
  let nextPhase;if(wheel)nextPhase=wheel.H$===0?'free-first':'choice';else if(p&&!t.vb.Fi&&p.f1>0)nextPhase='choice';else hold('not the proved Wheel/restore post-decision entry; original main retains ownership');
  if(nextPhase==='choice'&&p&&p.JG)nextPhase=postDecisionTarget(t);if(nextPhase==='free-first')t.vb.Fi=true;T=t;frame=next;roundScope=s.roundScope;phase=nextPhase;version++;return snapshot();}
 function seedInitialDirectLogic(next,response){
  if(T||inFlight)hold('single initial direct entry; never replay');const s=accepted(next,response,'Logic'),r=response.zl;
  if(!r||r.PBa||r.FX||(!r.EK&&!r.XC))hold('actual initial direct FS/Wild caller scope');
  if(r.EK){const used=r.EK.Fra!=null?r.EK.Fra:r.EK.t4a;if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(r.EK.Q$)||r.EK.Q$<0)hold('actual initial direct Free counter fields');}
  const t=coreModel(response);if(r.XC){if(!Array.isArray(r.XC.kxa))hold('actual typed WildInfo.overlay required');t.features.XC={Sdb:r.XC.kxa};}
  const max=t.vb.Fi?r.EK.Uf:r.TP.Uf;if(typeof max!=='boolean')hold('actual initial direct native max selector');
  let target;if(t.vb.Fi){
   // Native active Free route is selected by source Fi, then reuses the already-proved current Free request/finish producers.
   if(t.vb.Vh==0||t.state.Uf){target='outer-finish';t.vb.Fi=false;}
   else target=nativeB0.call({T:t,xya:{Mg:replayMode},settings:{vpa:sourceFactories.EndGame}})?'nested-finish':'free-continue';
  }else{
   // Wild handlers are local and return no request-changing state. A positive inactive Free budget is not proof of a first native JC.
   if(!nativeB0.call({T:t,xya:{Mg:replayMode},settings:{vpa:sourceFactories.EndGame}}))hold('initial direct inactive Free reaches native local Closed request:null; first Free JC caller unproved');
   target='outer-finish';
  }
  T=t;frame=next;roundScope=s.roundScope;phase=target;version++;return snapshot();
 }
 function acceptDecisionLogic(next,response,intent){if(!T||phase!=='choice'||inFlight)hold('current source-proved choice phase');accepted(next,response,'Logic');
  if(!intent||next.originalRequestIntent!==intent||intent.parentFrame!==frame||intent.roundScope!==roundScope||intent.sessionScope!==sessionScope||intent.sessionID!==frame.responseSessionID||intent.requestPayload!==next.requestPayload||intent.sourceFactory!==sourceFactories.decision||!intent.requestParams||typeof intent.requestParams.OB!=='boolean')hold('actual original native decision dispatch and exact request, not unknown/replay');
  const r=response.zl;if(!r||!r.QB||!r.TP)hold('actual Decision Logic QB/BGInfo');const t=cloneT();nativeQxa.call({T:t},r.QB);t.state.Uf=r.TP.Uf;
  // Own VB updates QB/Uf only. It never resets or replaces previous Vh with any decision FSInfo.
  const target=(intent.requestParams.OB||t.features.Pe.JG)?postDecisionTarget(t):'choice';if(target==='free-first')t.vb.Fi=true;T=t;frame=next;phase=target;version++;return snapshot();}
 function snapshot(){return Object.freeze({phase,frame,roundScope,remaining:T&&T.vb.Vh,nativeFreeMode:T&&T.vb.Fi,max:T&&T.state.Uf,version,sourceOnly:true,actualEndACK:false});}
 function nextRequest(){const s=current();if(!T||s.originalAcceptedFrame!==frame||s.moneyCommittedFrame!==frame)hold('seed/current money frame');if(inFlight)hold('one original request already in flight; no retry');let kind,factory,params;
  if(phase==='choice')hold('real choice/offer state still controls Gamble or Collect; post-decision cannot invent it');
  if(phase==='free-first'||phase==='free-continue'){kind='Logic';factory=sourceFactories.freeLogic;params=s.nativeRequestParams;if(!params||!params.Yj||!own(params.Yj,'value')||!own(params,'Bq'))hold('actual selected Init-derived native aG stake/Bq');}
  else if(phase==='outer-finish'||phase==='nested-finish'){
   // END factory is fixed by the proved own real-engine settings; this is a source binding, not a UI actor.
   if(!nativeB0.call({T,xya:{Mg:replayMode},settings:{vpa:sourceFactories.EndGame}}))hold('actual B0 false: local request:null/main idle, no synthetic End or unproved extra paid Logic');
   kind='EndGame';factory=sourceFactories.EndGame;params=s.nativeEndParams;if(!params||typeof params!=='object')hold('actual current original End plugin/account inputs');
  }else hold('no mapped next request for '+phase);
  const token=Object.freeze({game,sessionScope,roundScope,parentFrame:frame,sessionID:s.sessionID,kind,sourceFactory:factory,requestParams:params,actualProviderRequest:false,actualEndACK:false});
  tokens.set(token,{version,money:s.totalWinRaw,params,stake:params.Yj,stakeValue:params.Yj&&params.Yj.value,stakeType:params.Yj&&params.Yj.type,Bq:params.Bq,he:params.he});return token;}
 function consumeRequest(token){const s=current(),r=tokens.get(token);if(!r||inFlight||r.version!==version||token.parentFrame!==frame||s.originalAcceptedFrame!==frame||s.moneyCommittedFrame!==frame||s.sessionID!==token.sessionID||s.totalWinRaw!==r.money)hold('exact unused current request/round/SID/money');const p=token.requestParams;if((token.kind==='Logic'?s.nativeRequestParams:s.nativeEndParams)!==p||p!==r.params||p.Yj!==r.stake||(p.Yj&&p.Yj.value)!==r.stakeValue||(p.Yj&&p.Yj.type)!==r.stakeType||p.Bq!==r.Bq||p.he!==r.he)hold('current actual native request inputs changed');tokens.delete(token);inFlight=token;return token;}
 function acceptFreeLogic(next,response,token){if(inFlight!==token||token.kind!=='Logic'||!(phase==='free-first'||phase==='free-continue'))hold('one consumed native JC intent');accepted(next,response,'Logic');if(next.originalRequestIntent!==token)hold('same actual original native JC exchange');const t=coreModel(response);
  // Normal own free-view transition removes the main R.Sa.$h view. Wheel.nC returns undefined at its first get($h), then AU reaches the same free finisher. No H$ whitelist or UI witness is required.
  // Core AU max bypasses feature.nC before TT/CQ/QTa; all other source counters keep the same native paths.
  let target;if(t.vb.Vh==0||t.state.Uf){target='outer-finish';t.vb.Fi=false;}else target=nativeB0.call({T:t,xya:{Mg:replayMode},settings:{vpa:sourceFactories.EndGame}})?'nested-finish':'free-continue';
  T=t;frame=next;inFlight=null;version++;phase=target;return snapshot();}
 function noteActualEndResponse(next,response,token){if(inFlight!==token||token.kind!=='EndGame')hold('one consumed native End producer');accepted(next,response,'EndGame');if(next.originalRequestIntent!==token)hold('same actual original End exchange');frame=next;inFlight=null;phase='after-actual-End-response';version++;return Object.freeze({phase,frame,actualNativeResponseObserved:true,actualEndACKCreditByThisAdapter:0,finalCredit:0,originalSGAGReconcileStillRequired:true});}
 return Object.freeze({seedEntryLogic,seedInitialDirectLogic,acceptDecisionLogic,nextRequest,consumeRequest,acceptFreeLogic,noteActualEndResponse,snapshot,sourceFactories});
}
module.exports={createOwn32754RequestOnlyPostDecision,sourceFactories};
