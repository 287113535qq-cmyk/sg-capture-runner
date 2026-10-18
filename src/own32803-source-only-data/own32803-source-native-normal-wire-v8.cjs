'use strict';
// Pure source DTO/XML leaves. No SDK actor, transport, money accounting, or source owner.
exports.createOwn32803SourceNativeNormalWireDATA=function({vm,DOM,data,game,sessionScope,source,entry}) {
 const need=(v,m)=>{if(!v)throw Object.assign(new Error('OWN32803_WIRE_HOLD_'+m),{retryAllowed:false})};
 need(vm?.Script&&DOM?.DOMParser&&DOM?.XMLSerializer&&DOM?.implementation&&data?.schema==='own32803-source-native-normal-wire-close-DATA-v3','DEPENDENCIES');
 need(game?.gameId==='32803'&&game.dbName==='sg_rrraceday'&&game.sg?.runtimeGameId===33163&&sessionScope,'OWN_GAME');
 for(const k of ['hasFreshEntry','readFreshEntry','readEntryDescriptor','readPlatformInputEpoch','hasOriginalRequestTicket','readCurrentRequestTicket','readOriginalRequestEvent','readCurrentFrame','readCurrentWireContext','hasInitFrame','readNativeLogicInput','readAcceptedLogicConsumeBinding','readCloseCallerBinding','readSourceControlBinding','isOwnConfiguredEndFactory'])need(typeof source?.[k]==='function','SOURCE_PORT_'+k);
 need(source.hasFreshEntry(entry)===true&&source.readFreshEntry(sessionScope)===entry,'FRESH_ENTRY');
 const desc=source.readEntryDescriptor(entry),entryEpoch=source.readPlatformInputEpoch(entry);
 need(entryEpoch===0,'FRESH_ENTRY_EPOCH_ZERO');
 need(desc&&Object.isFrozen(desc)&&desc.game===game&&desc.sessionScope===sessionScope&&desc.priorPlatformActor===null&&desc.initialPartnerPromoInfo===null&&desc.registration==='SG.lf.BQ'&&desc.adapterPath==='own-SG-EntryPoint'&&desc.inputPolicy==='closed-no-platform-callbacks','EXPLICIT_OWN_NORMAL_ENTRY');
 need(typeof desc.actualLaunchURL==='string'&&typeof desc.actualLaunchSearch==='string'&&new URL(desc.actualLaunchURL).search===desc.actualLaunchSearch,'ACTUAL_NEW_LAUNCH');
 const probe=DOM.implementation.createDocument(null,'Probe',null),tags=new WeakMap(),fields=new WeakMap(),classes=new Map();
 const ctx=vm.createContext({Element:{[Symbol.hasInstance]:n=>n?.nodeType===1},Document:{[Symbol.hasInstance]:n=>n?.nodeType===9},document:{implementation:DOM.implementation},location:{search:desc.actualLaunchSearch},c:{d_:decodeURI},G:{},a:{Ba:{warn:m=>{throw Error('OWN32803_XML_AMBIGUOUS_'+m)}},I:{zc:v=>typeof v==='string',array:Array.isArray},sd:{ho:{Bg:undefined}}},f:{fa:{get:v=>tags.get(v),ela:n=>classes.get(n)||[]},Ca:{get:v=>fields.get(v)}}});
 const run=s=>new vm.Script(s).runInContext(ctx,{timeout:100}),fn=s=>run('('+s+')');
 ctx.y=Object.assign;
 for(const key of ['pathSegment','matchingChildren','getOrCreate','read','write','serialize','deserialize','booleanType'])run(data.xmlCore[key].source);
 ctx.t.V={PW:'true',OW:'false',qha:['true','1','y','yes'],pha:['false','0','n','no'],default:false};
 ctx.f.hJ=ctx.t;ctx.f.Boolean=ctx.t(ctx.t.V);run(data.methods.String.source+';'+data.methods.Number.source+';');
 ctx.q={is:v=>v!==null&&typeof v==='object'&&typeof v.WMa==='function'};
 run(data.methods.Object.source+';');ctx.f.Vf=fn(data.methods.Vf.source);
 const compile=fn(data.methods.compilePath.source),merge=(...list)=>Object.values(Object.assign({},...list.map(xs=>Object.fromEntries(xs.map(x=>[x.key,x])))));
 const make=(name,tag,spec,type)=>{
   const meta={};for(const s of spec){need(['f.String','f.Number','f.Boolean','f.Object','f.Vf(f.Number)','f.hJ({PW:"Y",OW:"N"})'].includes(s.type),'TYPE_TABLE');const f={path:s.path,type:run(s.type),xu:s.optional};compile({NA:f});meta[s.key]=f;}
   function DTO(){if(type!==undefined)this.type=type;tags.set(this,tag);fields.set(this,meta)}
   if(!classes.has(tag))classes.set(tag,[DTO]);return DTO;
 };
 const T=data.tables,H=make('Header','Header',T.Header.fields),CI=make('CurrencyInformation','CurrencyInformation',T.CurrencyInformation.fields),PA=make('AccountData','AccountData',T.AccountData.fields),IR=make('InitResult','GameResponse',T.InitResult.fields),Init=make('Init','GameRequest',T.Init.fields,'Init'),End=make('End','GameRequest',T.End.fields,'EndGame'),Logic=make('Logic','GameRequest',merge(T.LogicBase.fields,T.LogicCommon.fields,T.LogicOwn.fields),'Logic');
 const header=run('(function(a){return '+data.methods.header.source+'})')({JY:H});
 const init=run('(function(b){return '+data.methods.init.source+'})')({yl:Init});
 const end=run('(function(b){return '+data.methods.end.source+'})')({yl:End});
 const logic=run('(function(d,SG){return '+data.methods.logic.source+'})')({yl:Logic},{Ub:{Rd:{PA}}});
 const currency=fn(data.currencyProjection.source),total=run('(function(k){return '+data.methods.stakeTotal.source+'})')({cj:0,jr:1,Mx:2});
 ctx.G.ea={wa:{Ob:{yh:total,fa:{cj:0}}}};
 const ena=fn(data.methods.ena.source),RU=fn(data.methods.RU.source),ownRU=run('(function(e){return '+data.methods.ownRU.source+'})')({prototype:{RU}});
 const urlCtx=vm.createContext({location:{search:desc.actualLaunchSearch},c:{d_:decodeURI},G:{}}),urlFn=s=>new vm.Script('('+s+')').runInContext(urlCtx,{timeout:100});
 urlCtx.G.URL={getParameter:urlFn(data.urlFunctionsReused.urlGetParameter.source)};
 const replay={ila:urlFn(data.methods.replayHistory.source),j5:urlFn(data.methods.replayBet.source)};
 const replayGG=urlFn(data.methods.replayGG.source).call(replay);
 need(replayGG===false&&replay.ila()===null&&replay.j5()===null,'OWN_NORMAL_REPLAY_INPUTS');
 // The already-certified entry helper guards native frbet and BQ metadata. This component also checks raw frbet absence.
 need(urlCtx.G.URL.getParameter('frbet',null,undefined)===null,'NO_FRBET');
 const XW=fn(data.closeGate.source),models=new WeakMap(),plans=new WeakSet(),clearReceipts=new WeakMap(),clearedConsumes=new WeakSet();
 ctx.G.ea.wa.SQ={clear:fn(data.edClear.SQclear.source)};
 const cU=fn(data.edClear.cU.source),Mf=fn(data.edClear.Mf.source);let sealed=false,firstInitProduced=false;
 const live=()=>need(!sealed,'SEALED');
 const bind=(q,firstInit=false)=>{
   live();if(source.readPlatformInputEpoch(entry)!==entryEpoch){sealed=true;need(false,'EXTERNAL_INPUT_SEALED')}need(q?.game===game&&q.sessionScope===sessionScope&&q.requestTicket,'SCOPE');
   if(firstInit){need(q.frame===null&&q.roundScope===null&&source.readCurrentFrame(sessionScope)===null&&source.readOriginalRequestEvent(q.requestTicket)==='Init','FIRST_ORIGINAL_INIT_NO_FRAME_ROUND')}else need(q.frame&&q.roundScope,'SCOPE_ACCEPTED_FRAME_ROUND');
   need(source.readFreshEntry(sessionScope)===entry&&source.readEntryDescriptor(entry)===desc,'ENTRY_CURRENT');
   need(source.readCurrentFrame(sessionScope)===q.frame&&source.hasOriginalRequestTicket(q.requestTicket)===true&&source.readCurrentRequestTicket(sessionScope)===q.requestTicket,'CURRENT_FRAME_TICKET');
   const c=source.readCurrentWireContext(q.frame,q.requestTicket);
   need(c&&Object.isFrozen(c)&&c.game===game&&c.sessionScope===sessionScope&&c.frame===q.frame&&c.roundScope===q.roundScope&&c.requestTicket===q.requestTicket,'SOURCE_WIRE_CONTEXT');
   need(c.entry===entry&&c.currentCampaign===null&&c.recovery===false&&c.extraHeaderHooks===0&&c.extraRequestHooks===0,'NORMAL_NO_UNMAPPED_HOOKS');
   const {Xm,Ms}=c;need(typeof c.contentType==='string'&&c.contentType.length>0&&c.contentType===Xm?.contentType,'ACTUAL_CONTENT_TYPE');need(Xm&&Ms&&typeof c.endpoint==='string'&&c.endpoint===Xm.endpoint&&new URL(c.endpoint).protocol==='https:','ACTUAL_ENDPOINT');
   for(const k of ['kM','channel','eMa','Mz','fV','j$','n$'])need(Object.hasOwn(Xm,k)&&Xm[k]!==null&&Xm[k]!==undefined,'EXPLICIT_XM_'+k);
   for(const k of ['lq','QH','language','jm','Cx'])need(Object.hasOwn(Ms,k)&&Ms[k]!==null&&Ms[k]!==undefined,'EXPLICIT_MS_'+k);
   need(Xm.Mz===20456&&Xm.eMa==='rrraceday'&&typeof Ms.QH==='boolean'&&typeof Ms.lq==='string'&&typeof Ms.jm==='string'&&Ms.jm.length>0&&Ms.jm!=='SESSION_ID','OWN_HEADER_CURRENT_SID');
   return c;
 };
 const hctx=c=>({Xm:c.Xm,Ms:c.Ms,iU(){return header.call(this)}});
 const encode=(q,c,dto,kind)=>{
   const raw=new DOM.XMLSerializer().serializeToString(ctx.n(dto));
   need(!raw.includes('undefined'),'NO_UNDEFINED_WIRE_VALUE');
   const p=Object.freeze({game,sessionScope,roundScope:q.roundScope,frame:q.frame,requestTicket:q.requestTicket,entry,kind,endpoint:c.endpoint,contentType:c.contentType,raw,sourceProjectionOnly:true,transportExecuted:false,actualEndACK:false});plans.add(p);return p;
 };
 return Object.freeze({
   deriveReplayMode(){live();return Object.freeze({gg:replayGG,meaning:'original replay/history',requestOpenInference:false})},
   projectInit({raw,responseFrame}){
     live();need(typeof raw==='string'&&responseFrame&&source.hasInitFrame(responseFrame,raw)===true,'AUTHENTIC_SAME_INIT_FRAME');
     const doc=new DOM.DOMParser({errorHandler:{warning:m=>{throw Error(m)},error:m=>{throw Error(m)},fatalError:m=>{throw Error(m)}}}).parseFromString(raw,'text/xml');
     need(doc.documentElement?.tagName==='GameResponse'&&!doc.getElementsByTagName('Error').length,'ACTUAL_INIT_RESPONSE');
     const dto=new IR();ctx.l(dto,doc);
     need(dto.Qi?.Mz===20456&&dto.Qi.n$===game.sg.header.versionID&&dto.Qi.dPa===false&&typeof dto.Qi.jm==='string'&&dto.Qi.jm.length>0,'OWN_INIT_HEADER');
     need(Array.isArray(dto.Zra)&&dto.Zra.length>0&&dto.Zra.every(x=>Number.isFinite(x)&&x>0)&&Number.isInteger(dto.xU)&&dto.xU>=0&&dto.xU<dto.Zra.length,'ACTUAL_STAKES');
     const state={lj:{},J:{Ga:{}}};currency.call(state,dto);ena.call(state,dto);
     need(Number.isFinite(state.lj.yd)&&state.lj.yd>0&&typeof state.lj.lq==='string','SOURCE_CURRENCY_RESULT');
     const model=Object.freeze({game,sessionScope,responseFrame,stakes:Object.freeze([...dto.Zra]),defaultIndex:dto.xU,wireMultiplier:state.lj.yd,wireCurrencyCode:state.lj.lq,sourceProjectionOnly:true});models.set(model,{dto,state});return model;
   },
   buildInit(q){live();need(!firstInitProduced,'FIRST_INIT_ALREADY_PRODUCED');const c=bind(q,true),plan=encode(q,c,init.call(hctx(c),{kg:undefined}),'Init');firstInitProduced=true;return plan},
   buildLogic(q){
     const c=bind(q),m=models.get(c.initModel);need(m&&c.initModel.responseFrame===c.initFrame&&source.hasInitFrame(c.initFrame)===true,'SAME_INIT_CONFIG');
     need(c.Ms.yd===c.initModel.wireMultiplier&&c.Ms.lq===c.initModel.wireCurrencyCode,'SOURCE_INIT_CURRENCY_BINDING');
     const input=source.readNativeLogicInput(q.frame,q.requestTicket);
     need(input&&Object.isFrozen(input)&&input.game===game&&input.sessionScope===sessionScope&&input.frame===q.frame&&input.roundScope===q.roundScope&&input.requestTicket===q.requestTicket&&input.initModel===c.initModel,'OWN_NATIVE_LOGIC_INPUT');
     need(input.selectedStake?.type===0&&c.initModel.stakes.includes(input.selectedStake.value)&&Number.isFinite(input.selectedStake.value),'EXPLICIT_OWN_PAID_MENU_SELECTION');
     need(Object.hasOwn(input,'Zm')&&input.Zm===undefined&&Object.hasOwn(input,'DO')&&(input.DO===null||Array.isArray(input.DO)&&input.DO.length===0)&&input.forceQueueEmpty===true,'NORMAL_CALLER_INPUT_NO_CHOICE_FORCE_PAYLINE');
     const native={J:{Ga:m.state.J.Ga,vb:{DO:input.DO}},By:1,lj:c.Ms,$f:[],Ul:{kg:undefined}};
     const args=ownRU.call(native,{dl:input.selectedStake,Zm:input.Zm});
     need(args.lN===undefined&&args.kg===undefined&&(!args.Z7||args.Z7.length===0),'NO_FORCE_REPLAY_CHOICE');
     return encode(q,c,logic.call(hctx(c),args),'Logic');
   },
   clearAcceptedEdAtOriginalGE(q){
     bind(q);const consume=source.readAcceptedLogicConsumeBinding(q.frame,q.requestTicket);
     need(consume&&Object.isFrozen(consume)&&consume.game===game&&consume.sessionScope===sessionScope&&consume.frame===q.frame&&consume.roundScope===q.roundScope&&consume.requestTicket===q.requestTicket,'ACTUAL_ACCEPTED_LOGIC_CONSUME');
     need(consume.orderedEdConsumed===true&&consume.originalMoneyCommitted===true&&consume.stage==='GE.cU-before-pI'&&consume.nativeState&&consume.nativeState.Ed===consume.currentEd&&Array.isArray(consume.currentEd)&&!clearedConsumes.has(consume),'GE_CURRENT_ED_CLEAR_ORDER');
     const beforeLength=consume.currentEd.length;cU.call({Mf},consume.nativeState);need(consume.currentEd.length===0,'ORIGINAL_SQ_CLEAR_RESULT');clearedConsumes.add(consume);
     const receipt=Object.freeze({game,sessionScope,frame:q.frame,roundScope:q.roundScope,requestTicket:q.requestTicket,beforeLength,afterLength:0,sourceMethod:'G.ea.wa.SQ.clear via own cU/Mf',sourceProjectionOnly:true});clearReceipts.set(receipt,consume);return receipt;
   },
   hasMatchingCurrentEdClearReceipt(q,receipt){
     bind(q);const consume=clearReceipts.get(receipt);return !!consume&&source.readAcceptedLogicConsumeBinding(q.frame,q.requestTicket)===consume&&receipt.frame===q.frame&&receipt.roundScope===q.roundScope&&receipt.requestTicket===q.requestTicket&&consume.nativeState.Ed===consume.currentEd&&consume.currentEd.length===0;
   },
   buildEnd(q){
     const c=bind(q),caller=source.readCloseCallerBinding(q.frame,q.requestTicket),control=source.readSourceControlBinding(q.frame,q.requestTicket);
     need(caller&&Object.isFrozen(caller)&&caller.game===game&&caller.sessionScope===sessionScope&&caller.frame===q.frame&&caller.roundScope===q.roundScope&&caller.requestTicket===q.requestTicket,'ACTUAL_SOURCE_CLOSE_CALLER');
     need(caller.registration==='G.ea.Nb.DQ@G.ea.ka.jo'&&caller.enteredFrom==='Cia'&&caller.method==='IU'&&caller.priorCloseResult===null&&caller.stateAlreadyTf===false&&caller.featuresCompletedWithoutRoute===true,'NATIVE_DQ_CIA_IU_NO_PRIOR_RESULT');
     need(control&&control.Dqa?.gg===replayGG&&control.settings?.Mia&&source.isOwnConfiguredEndFactory(control.settings.Mia)===true&&caller.Mia===control.settings.Mia,'OWN_END_FACTORY_REPLAY_CONTEXT');
     need(typeof control.J?.state?.$j==='boolean'&&control.J?.vb&&Object.hasOwn(control.J.vb,'Lg')&&(control.J.vb.Lg===null||typeof control.J.vb.Lg==='number')&&control.lj===c.Ms,'CURRENT_NATIVE_CLOSE_STATE');
     need(caller.connected===true&&caller.extraRequestHooks===0&&caller.originalMoneyCommitted===true&&XW.call(control)===true,'ORIGINAL_CLOSE_BRANCH_NOT_XW_ALONE');
     return encode(q,c,end.call(hctx(c)),'EndGame');
   },
   isOwnWirePlan(plan){return plans.has(plan)},
   seal(){sealed=true},
 });
};
