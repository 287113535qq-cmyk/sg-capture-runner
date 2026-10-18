'use strict';
// Fresh source-only platform DATA projection, never an SDK/BQ instance or old actor substitute.
exports.createOwn32803FreshBQNormalEntryDATA=function({vm,data,game,sessionScope,source,entry}){
 const need=(v,m)=>{if(!v)throw Object.assign(new Error('OWN32803_FRESH_PLATFORM_HOLD_'+m),{retryAllowed:false})};
 need(vm?.Script&&data?.schema==='own32803-fresh-BQ-normal-platform-entry-DATA-v1'&&game?.gameId==='32803'&&game.dbName==='sg_rrraceday'&&game.sg?.runtimeGameId===33163&&sessionScope,'OWN_DATA');
 need(source&&entry&&source.hasFreshEntry(entry)===true&&source.readFreshEntry(sessionScope)===entry,'ORIGINAL_FRESH_ENTRY_IDENTITY');
 const descriptor=source.readEntryDescriptor(entry);
 need(descriptor&&Object.isFrozen(descriptor)&&descriptor.game===game&&descriptor.sessionScope===sessionScope&&descriptor.priorPlatformActor===null&&descriptor.registration==='SG.lf.BQ'&&descriptor.inputPolicy==='closed-no-platform-callbacks'&&descriptor.adapterPath==='own-SG-EntryPoint'&&descriptor.initialPartnerPromoInfo===null,'EXPLICIT_NEW_BQ_NORMAL_ENTRY_NOT_OLD_ACTOR');
 need(typeof descriptor.actualLaunchURL==='string'&&typeof descriptor.actualLaunchSearch==='string'&&new URL(descriptor.actualLaunchURL).search===descriptor.actualLaunchSearch,'ACTUAL_EXPLICIT_FUTURE_LAUNCH');
 need(data.newNecessaryLeaves.originalBQRegistration.source==='f.BQ=c;G.Tb.register(c)'&&data.reusedLeaves.BQConstructor.source.includes(data.sourceInitialCampaign.exactConstructorToken)&&data.sourceInitialCampaign.exactConstructorToken==='this.wn=new G.fc(null)'&&data.sourceInitialCampaign.initializerExpression==='null','EXACT_ORIGINAL_BQ_SOURCE_BRANCH');
 const ctx=vm.createContext({location:{search:descriptor.actualLaunchSearch},c:{d_:decodeURI},a:{I:{},lr:{}},G:{}});
 const run=s=>new vm.Script(s).runInContext(ctx,{timeout:100}),fn=s=>run('('+s+')'),L=data.newNecessaryLeaves;
 ctx.a.I.ra=fn(L.isNumber.source);ctx.a.as=fn(L.valueOr.source);ctx.a.lr.ra=fn(L.numericParse.source);
 ctx.h=fn(L.urlGetParameter.source);
 const numeric=fn(L.urlNumeric.source);
 // Require native parsed absence, not an invalid nonempty parameter that numerically falls back.
 need(ctx.h('frbet',null,undefined)===null&&numeric('frbet',null)===null,'NATIVE_LAUNCH_FRBET_ABSENT');
 ctx.G.bt={};run(L.maxModeEnum.source.replace('})(a.bt||(a.bt={}));','})(G.bt);'));
 ctx.a.metaDataBundle={getMaxWinStatus:fn(L.ownMetadataMaxWinStatus.source)};
 const platformMode=fn(L.nativeBQModeGetter.source).call({});
 const currentCampaign=run('('+data.sourceInitialCampaign.initializerExpression+')');
 const frInfoHeader=fn(data.reusedLeaves.headerInput.source)(currentCampaign);
 need(platformMode===ctx.G.bt.Yaa&&ctx.G.bt.Yaa!==ctx.G.bt.nb&&currentCampaign===null&&frInfoHeader===null,'SOURCE_DERIVED_INITIAL_STATE');
 let sealed=false;
 function guard(){
  need(!sealed&&source.hasFreshEntry(entry)===true&&source.readFreshEntry(sessionScope)===entry&&source.readEntryDescriptor(entry)===descriptor,'CURRENT_SAME_ENTRY');
  if(source.readPlatformInputEpoch(entry)!==0){sealed=true;need(false,'EXTERNAL_PLATFORM_INPUT_OR_STATE_CHANGE');}
 }
 guard();
 return Object.freeze({
  readAtRequest({frame,roundScope,requestTicket}){
   guard();
   need(requestTicket&&source.hasOriginalRequestTicket(requestTicket)===true&&source.readCurrentRequestTicket(sessionScope)===requestTicket&&requestTicket.game===game&&requestTicket.sessionScope===sessionScope&&requestTicket.originalResponseFrame===frame&&requestTicket.roundScope===roundScope,'CURRENT_ORIGINAL_REQUEST_TICKET');
   if(frame===null)need(requestTicket.event==='Init'&&roundScope===null&&source.readCurrentFrame(sessionScope)===null,'ONE_INITIAL_REQUEST');
   else need(source.has(frame)===true&&source.readCurrentFrame(sessionScope)===frame&&frame.game===game&&frame.sessionScope===sessionScope&&source.originalMoneyCommitted(frame)===true,'CURRENT_ACCEPTED_FRAME_AND_MONEY');
   return Object.freeze({game,sessionScope,roundScope,originalResponseFrame:frame,requestTicket,sourceEntry:entry,platformBranch:'SG.lf.BQ',currentCampaign,platformMode,frInfoHeader,sourceProjectionOnly:true,actualNativeBQInstanceCreated:false,actualProviderACK:false});
  },
  seal(){sealed=true}
 });
};
