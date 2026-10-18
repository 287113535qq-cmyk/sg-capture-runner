'use strict';
// Source-only protocol DATA projection for an explicitly new normal scope. No native actor, UI, timer, or transport.
exports.createOwn32803TypedStateClosePathDATA=function({vm,DOM,data,wireData,game,sessionScope,source,entry,wire,initModel,edFactory}){
 const need=(v,m)=>{if(!v)throw Object.assign(new Error('OWN32803_STATE_HOLD_'+m),{retryAllowed:false})};
 need(data?.schema==='own32803-source-derived-typed-state-close-path-DATA-v2'&&wireData?.schema==='own32803-source-native-normal-wire-close-DATA-v3'&&vm?.Script&&DOM?.DOMParser,'OWN_DATA');
 need(game?.gameId==='32803'&&game.dbName==='sg_rrraceday'&&game.sg?.runtimeGameId===33163&&game.sg.nativeGameID==='20456'&&sessionScope,'OWN_GAME');
 for(const k of ['has','readCurrent','readCurrentRound','hasOriginalRound','isAcceptedOriginalACK','originalMoneyCommitted','readFrameRequestTicket','hasOriginalRequestTicket','readCurrentRequestTicket','readCurrentFrame','readOriginalRequestEvent','readCurrentWireContext','readOriginalConnectionState','hasFreshEntry','readFreshEntry','hasInitFrame'])need(typeof source?.[k]==='function','SOURCE_PORT_'+k);
 need(source.hasFreshEntry(entry)&&source.readFreshEntry(sessionScope)===entry&&initModel?.game===game&&initModel.sessionScope===sessionScope&&source.hasInitFrame(initModel.responseFrame),'FRESH_SAME_INIT');
 need(wire?.deriveReplayMode().gg===false&&typeof edFactory==='function','CERTIFIED_NORMAL_WIRE_AND_ED');
 const tags=new WeakMap(),metas=new WeakMap(),classes=new Map(),ctx=vm.createContext({Element:{[Symbol.hasInstance]:n=>n?.nodeType===1},Document:{[Symbol.hasInstance]:n=>n?.nodeType===9},a:{I:{array:Array.isArray},Ba:{warn:m=>{throw Error(m)}},sd:{ho:{Bg:undefined}}},f:{fa:{get:o=>tags.get(o),ela:n=>classes.get(n)||[]},Ca:{get:o=>metas.get(o)}},G:{wa:{ka:{fa:{zj:0,Tf:2}}},ea:{wa:{}}},y:Object.assign});
 const run=s=>new vm.Script(s).runInContext(ctx,{timeout:100}),fn=s=>run('('+s+')');
 for(const k of ['pathSegment','matchingChildren','read','deserialize','booleanType'])run(wireData.xmlCore[k].source);
 ctx.t.V={PW:'true',OW:'false',qha:['true','1','y','yes'],pha:['false','0','n','no'],default:false};ctx.f.hJ=ctx.t;ctx.f.Boolean=ctx.t(ctx.t.V);run(wireData.methods.String.source+';'+wireData.methods.Number.source+';');
 ctx.q={is:()=>false};run(wireData.methods.Object.source+';');
 const compile=fn(wireData.methods.compilePath.source);
 const dto=(tag,fields)=>{const meta={};for(const s of fields){const m={path:s.path,type:run(s.type),xu:s.optional};compile({NA:m});meta[s.key]=m;}function D(){tags.set(this,tag);metas.set(this,meta)}classes.set(tag,[D]);return D};
 const Header=dto('Header',data.tables.Header.fields),BG=dto('BGInfo',data.tables.BGInfo.fields),FS=dto('FSInfo',data.tables.FSInfo.fields),GR=dto('GameResult',data.tables.GameResult.fields);
 const freeClear=fn(data.sourceLeaves.freeClear.source),ownFreeClear=fn(data.sourceLeaves.ownFreeClear.source),stateClear=run('(function(h){return '+data.sourceLeaves.stateClear.source+'})')({Tf:2});
 ctx.G.ea.wa.La={clear:freeClear};const freeUpdate=fn(data.sourceLeaves.freeUpdate.source),freeOnly=fn(data.projection.freeOnly),maxOnly=fn(data.projection.maxOnly),cSaOnly=fn(data.projection.cSaOnly),max=fn(data.projection.maxPartial),factory=fn(data.projection.factoryDescriptors),XW=fn(wireData.closeGate.source),cU=fn(wireData.edClear.cU.source),Mf=fn(wireData.edClear.Mf.source);ctx.G.ea.wa.SQ={clear:fn(wireData.edClear.SQclear.source)};
 const J={state:{},vb:{},Ed:[]},native={J,lj:{},Gi:undefined,$Ra:freeUpdate};stateClear(J.state);ownFreeClear(J.vb);
 const endCapability=Object.freeze({kind:'own32803-original-End-requester-source-capability',requester:data.configuredMia.requester,ownConfiguredSource:data.configuredMia.ownConfig.source,OwSHA256:data.configuredMia.ownEndOw.SHA256,DTO:'GameRequest.type=EndGame;Qi=original Header',wireCertificateSHA256:data.configuredMia.wireCertificate.SHA256,sourceProjectionOnly:true,nativeInstanceCreated:false});
 const clearByTicket=new WeakMap(),clearOwned=new WeakSet(),usedNextTickets=new WeakSet(),callerByTicket=new WeakMap(),controlByTicket=new WeakMap();let pending=null,accepted=null,context={features:[],qW:false},cursor=0,sealed=false,closeProduced=false;
 const current=q=>{need(!sealed&&q?.game===game&&q.sessionScope===sessionScope&&q.roundScope&&q.frame&&q.requestTicket,'CURRENT_SCOPE');need(source.readFreshEntry(sessionScope)===entry&&source.readCurrentFrame(sessionScope)===q.frame&&source.readCurrentRequestTicket(sessionScope)===q.requestTicket&&source.hasOriginalRequestTicket(q.requestTicket)&&source.hasOriginalRound(q.roundScope)&&source.readCurrentRound(sessionScope)===q.roundScope,'CURRENT_OWNER_FRAME_ROUND_TICKET');};
 const clearMatches=frame=>{const ticket=source.readFrameRequestTicket(frame),r=clearByTicket.get(ticket);return !!r&&clearOwned.has(r)&&r.nativeArray===J.Ed&&r.afterLength===0&&frame.game===game&&frame.sessionScope===sessionScope&&frame.roundScope===r.roundScope};
 const edSource={has:x=>source.has(x),readCurrent:(s,r)=>source.readCurrent(s,r),readCurrentRound:s=>source.readCurrentRound(s),hasOriginalRound:r=>source.hasOriginalRound(r),isAcceptedOriginalACK:f=>source.isAcceptedOriginalACK(f),originalMoneyCommitted:f=>source.originalMoneyCommitted(f),ownCurrentEdWasCleared:clearMatches};
 const ed=edFactory({DOM,source:edSource,game,sessionScope});
 const node=(p,n)=>{const xs=Array.from(p.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===n);need(xs.length===1,'ONE_'+n);return xs[0]};
 const snapshot=()=>Object.freeze({state:J.state.state,max:J.state.$j,free:Object.freeze({...J.vb}),featureDescriptors:Object.freeze(context.features.map(x=>Object.freeze({...x}))),orderedEdCount:J.Ed.length,cursor,sourceProjectionOnly:true});
 return Object.freeze({
  beginOriginalGE(q){current(q);need(!pending&&source.readOriginalRequestEvent(q.requestTicket)==='Logic'&&!clearByTicket.has(q.requestTicket),'ONE_ORIGINAL_LOGIC_GE');const beforeLength=J.Ed.length;cU.call({Mf},J);need(J.Ed.length===0,'SOURCE_CU_CLEAR');context={features:[],qW:false};cursor=0;closeProduced=false;const r=Object.freeze({game,sessionScope,roundScope:q.roundScope,previousFrame:q.frame,requestTicket:q.requestTicket,nativeArray:J.Ed,beforeLength,afterLength:0,sourceStage:'GE.cU-before-pI'});clearOwned.add(r);clearByTicket.set(q.requestTicket,r);pending=r;return r;},
  ownCurrentEdWasCleared(frame){return clearMatches(frame)},
  acceptOriginalLogic(q,geReceipt,platform){
   current(q);need(pending===geReceipt&&clearOwned.has(geReceipt)&&source.readFrameRequestTicket(q.frame)===geReceipt.requestTicket&&clearMatches(q.frame),'MATCHING_GE_CLEAR_REAL_ACK');
   const f=q.frame;need(source.has(f)&&source.readCurrent(sessionScope,q.roundScope)===f&&source.isAcceptedOriginalACK(f)===true&&source.originalMoneyCommitted(f)===true&&f.msgId==='Logic'&&typeof f.responsePayload==='string','REAL_ACCEPTED_LOGIC_AFTER_ORIGINAL_MONEY');
   need(platform&&platform.game===game&&platform.sessionScope===sessionScope&&platform.roundScope===q.roundScope&&platform.originalResponseFrame===f&&platform.requestTicket===q.requestTicket&&platform.currentCampaign===null&&platform.platformMode===1,'SAME_REAL_FRESH_PLATFORM');
   const doc=new DOM.DOMParser().parseFromString(f.responsePayload,'text/xml');need(doc.documentElement?.nodeName==='GameResponse'&&doc.documentElement.getAttribute('type')==='Logic'&&!doc.getElementsByTagName('Error').length,'SUCCESSFUL_LOGIC');
   const h=new Header(),r=new GR();ctx.l(h,node(doc.documentElement,'Header'));ctx.l(r,node(doc.documentElement,'GameResult'));
   need(h.Mz===20456&&h.n$==='1_0'&&h.dPa===false&&typeof h.jm==='string'&&h.jm.length>0&&r.OT&&typeof r.OT.$j==='boolean','OWN_TYPED_HEADER_BG_MAX');
   const response={Qi:h,So:r};cSaOnly.call(native,response);freeOnly.call(native,r);native.aU=a=>max(a,platform.platformMode,0);maxOnly.call(native,r);
   const projected=ed.project(f,q.roundScope);for(const x of projected.frames)J.Ed.push(x);context.features=factory({K:{J}});accepted={frame:f,roundScope:q.roundScope,typed:r,platform,projected,raw:f.responsePayload};pending=null;cursor=0;
   return Object.freeze({game,sessionScope,roundScope:q.roundScope,frame:f,requestTicket:q.requestTicket,originalLogicRequestTicket:geReceipt.requestTicket,typedGameResult:r,originalRawLogic:f.responsePayload,controlState:snapshot(),noMoneyDefaults:true,actualEndACK:false});
  },
  next(q){
   current(q);need(accepted&&accepted.frame===q.frame&&accepted.roundScope===q.roundScope&&!pending&&!closeProduced&&!usedNextTickets.has(q.requestTicket),'ACTUAL_CURRENT_NEXT_ONCE');
   need(source.originalMoneyCommitted(q.frame)===true,'ORIGINAL_MONEY_STILL_COMMITTED');
   need(context.features.length===0,'UNMAPPED_FREE_OR_CHOICE_FEATURE');usedNextTickets.add(q.requestTicket);
   if(cursor<J.Ed.length){const ordinal=cursor++,frame=J.Ed[ordinal];return Object.freeze({kind:'data',game,sessionScope,roundScope:q.roundScope,frame:q.frame,requestTicket:q.requestTicket,ordinal,orderedEd:frame,originalRawLogic:accepted.raw,typedGameResult:accepted.typed,actualEndACK:false});}
   // Execute protocol completion projection: empty-feature spa -> TP -> jo -> DQ.re -> Cia -> IU() -> close.
   const trace=['empty-feature-spa','Y.te.TP.dka.protocol-continuation','playFinished','G.Nb.DQ.re','G.ea.Nb.DQ.Cia'];
   if(J.state.state===2)return Object.freeze({kind:'already-closed-no-End-request',trace:Object.freeze(trace),actualEndACK:false});
   if(!context.qW){context.qW=true;need(context.features.length===0,'NATIVE_FEATURE_ROUTE');}
   trace.push('IU(no-prior-result)','Ld.close');
   const c=source.readCurrentWireContext(q.frame,q.requestTicket),connection=source.readOriginalConnectionState(sessionScope);
   need(c?.game===game&&c.sessionScope===sessionScope&&c.frame===q.frame&&c.roundScope===q.roundScope&&c.requestTicket===q.requestTicket&&c.Ms?.jm===native.lj.jm&&c.currentCampaign===null&&c.extraRequestHooks===0,'SOURCE_CURRENT_NATIVE_SID_CONTEXT');
   const control=Object.freeze({Dqa:Object.freeze({gg:wire.deriveReplayMode().gg}),settings:Object.freeze({Mia:endCapability}),J,lj:c.Ms});
   need(connection&&typeof connection.connected==='boolean','ACTUAL_CONNECTION_STATE');
   if(!XW.call(control)){J.state.state=native.Gi=2;return Object.freeze({kind:'native-close-no-request',trace:Object.freeze(trace),actualEndACK:false});}
   need(connection.connected===true,'NATIVE_DISCONNECTED_HOLD');
   const caller=Object.freeze({game,sessionScope,roundScope:q.roundScope,frame:q.frame,requestTicket:q.requestTicket,registration:'G.ea.Nb.DQ@G.ea.ka.jo',enteredFrom:'Cia',method:'IU',priorCloseResult:null,stateAlreadyTf:J.state.state===2,featuresCompletedWithoutRoute:context.features.length===0,Mia:endCapability,connected:connection.connected,extraRequestHooks:c.extraRequestHooks,originalMoneyCommitted:source.originalMoneyCommitted(q.frame),sourceDerivedProtocolCallEntry:true,sourceProjectionOnly:true,trace:Object.freeze(trace)});
   callerByTicket.set(q.requestTicket,caller);controlByTicket.set(q.requestTicket,control);closeProduced=true;
   return Object.freeze({kind:'EndGame-ready-for-original-wire',game,sessionScope,roundScope:q.roundScope,frame:q.frame,requestTicket:q.requestTicket,caller,control,sourceProjectionOnly:true,actualEndACK:false});
  },
  readCloseCallerBinding(frame,ticket){const x=callerByTicket.get(ticket);return x?.frame===frame?x:null},
  readSourceControlBinding(frame,ticket){const x=callerByTicket.get(ticket);return x?.frame===frame?controlByTicket.get(ticket):null},
  isOwnConfiguredEndFactory(cap){return cap===endCapability},
  readConfiguredEndRequesterCapability(){return endCapability},
  readDerivedState(){return snapshot()},
  seal(){sealed=true;ed.seal()},
 });
};
