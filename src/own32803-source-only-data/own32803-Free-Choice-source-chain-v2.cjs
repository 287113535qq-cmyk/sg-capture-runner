'use strict';
// Protocol DATA only. The native menu is a source-derived AG choice domain, never a native UI instance.
exports.createOwn32803FreeChoiceRequestChainDATA=function({vm,DOM,data,game,sessionScope,source,entry,wire,initModel,nativeCaller,edFactory}){
 const need=(x,m)=>{if(!x)throw Object.assign(new Error('OWN32803_FREE_CHOICE_HOLD_'+m),{retryAllowed:false})};
 need(data?.schema==='own32803-Free-Choice-source-request-chain-DATA-v1'&&game?.gameId==='32803'&&game.dbName==='sg_rrraceday'&&game.sg?.runtimeGameId===33163&&game.sg.nativeGameID==='20456'&&sessionScope,'OWN_DATA_SCOPE');
 need(vm?.Script&&wire?.deriveReplayMode().gg===false&&nativeCaller?.readDerivedState&&nativeCaller?.readConfiguredEndRequesterCapability&&typeof edFactory==='function'&&initModel?.game===game&&initModel.sessionScope===sessionScope,'CERTIFIED_OWN_PEERS');
 for(const k of ['has','readCurrent','readCurrentRound','hasOriginalRound','isAcceptedOriginalACK','originalMoneyCommitted','readFrameRequestTicket','hasOriginalRequestTicket','readCurrentRequestTicket','readCurrentFrame','readOriginalRequestEvent','readCurrentWireContext','readOriginalConnectionState','hasFreshEntry','readFreshEntry'])need(typeof source?.[k]==='function','SOURCE_PORT_'+k);
 need(source.hasFreshEntry(entry)&&source.readFreshEntry(sessionScope)===entry,'SAME_FRESH_OWN_ENTRY');
 const ctx=vm.createContext({a:{te:{La:'Y.te.La'}},G:{ea:{ka:{Fza:'G.ea.ka.Fza'}},wa:{Error:{fa:{nb:0}}}}}),fn=s=>new vm.Script('('+s+')').runInContext(ctx,{timeout:100});
 const gpa=fn(data.projection.gpa),dRa=fn(data.projection.dRa),Kwa=fn(data.projection.innerKwa),equal=fn(data.projection.equalPreset),acceptMap=fn(data.projection.acceptedChoiceMap.source);
 let round=null,current=null,native=null,edRows=null,cursor=0,phase='new',menu=null,allocation=null,pending=null,sealed=false,qW=false;
 const menus=new WeakSet(),allocs=new WeakMap(),bindings=new WeakSet(),byTicket=new WeakMap(),usedNext=new WeakSet(),registeredPlans=new WeakSet(),callers=new WeakMap(),controls=new WeakMap();
 const edSource={has:x=>source.has(x),readCurrent:(s,r)=>source.readCurrent(s,r),readCurrentRound:s=>source.readCurrentRound(s),hasOriginalRound:r=>source.hasOriginalRound(r),isAcceptedOriginalACK:f=>source.isAcceptedOriginalACK(f),originalMoneyCommitted:f=>source.originalMoneyCommitted(f),ownCurrentEdWasCleared:f=>nativeCaller.ownCurrentEdWasCleared(f)};
 const ed=edFactory({DOM,source:edSource,game,sessionScope});
 const guard=q=>{need(!sealed&&q?.game===game&&q.sessionScope===sessionScope&&q.frame&&q.roundScope&&q.requestTicket&&(!round||round===q.roundScope),'CURRENT_SCOPE');need(source.hasFreshEntry(entry)&&source.readFreshEntry(sessionScope)===entry&&source.readCurrentFrame(sessionScope)===q.frame&&source.readCurrentRequestTicket(sessionScope)===q.requestTicket&&source.hasOriginalRequestTicket(q.requestTicket)&&source.hasOriginalRound(q.roundScope)&&source.readCurrentRound(sessionScope)===q.roundScope,'CURRENT_FRAME_ROUND_TICKET');};
 const currentContext=q=>{const c=source.readCurrentWireContext(q.frame,q.requestTicket);need(c&&c.game===game&&c.sessionScope===sessionScope&&c.frame===q.frame&&c.roundScope===q.roundScope&&c.requestTicket===q.requestTicket&&c.entry===entry&&c.initModel===initModel&&c.currentCampaign===null&&c.recovery===false&&c.extraRequestHooks===0&&c.extraHeaderHooks===0&&typeof c.Ms?.jm==='string'&&c.Ms.jm.length>0,'SAME_INIT_SID_NATIVE_CONTEXT');return c;};
 const J=()=>({state:{state:native.state,$j:native.max},vb:{...native.free,DO:allocation?allocation.Z7:null},error:{type:0}});
 const activate=(q,origin)=>{const c=currentContext(q);menu=Object.freeze({game,sessionScope,roundScope:round,frame:current,initModel,activationSID:c.Ms.jm,origin,nativeRoute:'Y.te.La.hVa->Db.by',kind:'own32803-current-native-pot-menu',originalAGAction:'PICK_FREE_SPINS',active:true,logicalOptions:Object.freeze([Object.freeze({pickIndex:1,nativePreset:'mX equal then explicit accept'})]),otherNativeAllocationsRemainUnmapped:true,sourceProjectionOnly:true,nativeUIExecuted:false});menus.add(menu);phase='awaiting-positive-AG-choice';return Object.freeze({kind:'positive-choice-menu',menu,actualEndACK:false});};
 const bind=(q,stage,cap)=>{guard(q);currentContext(q);need(current===q.frame&&round===q.roundScope&&source.readOriginalRequestEvent(q.requestTicket)==='Logic'&&!pending,'ONE_ORIGINAL_FEATURE_LOGIC_TICKET');const a=allocs.get(cap);need(a&&cap===allocation&&a.menu.game===game&&a.menu.sessionScope===sessionScope&&a.menu.roundScope===round,'OWN_ALLOCATION_SCOPE');if(stage==='choice-request')need(phase==='positive-choice-selected'&&!a.choiceACK&&q.frame===a.menu.frame,'EXPLICIT_MENU_AG1_BEFORE_CHOICE_REQUEST');else need(phase==='free-ready'&&a.choiceACK&&a.choiceACK.sessionScope===sessionScope&&a.choiceACK.roundScope===round,'ACTUAL_OWN_ACCEPTED_CHOICE_ACK_BEFORE_FREE');const b=Object.freeze({game,sessionScope,roundScope:round,frame:current,requestTicket:q.requestTicket,initModel,stage,Z7:cap.Z7,allocationCapability:cap,sourceProjectionOnly:true});bindings.add(b);byTicket.set(q.requestTicket,b);return b;};
 return Object.freeze({
  acceptOriginalLogic(q,receipt,platform){
   guard(q);need(source.has(q.frame)&&source.readCurrent(sessionScope,q.roundScope)===q.frame&&source.isAcceptedOriginalACK(q.frame)===true&&source.originalMoneyCommitted(q.frame)===true&&q.frame.msgId==='Logic','ACTUAL_SUCCESSFUL_LOGIC_MONEY');
   need(receipt&&receipt.game===game&&receipt.sessionScope===sessionScope&&receipt.roundScope===q.roundScope&&receipt.frame===q.frame&&receipt.requestTicket===q.requestTicket&&receipt.originalLogicRequestTicket===source.readFrameRequestTicket(q.frame)&&receipt.originalRawLogic===q.frame.responsePayload,'ACTUAL_PEER_TYPED_RECEIPT');
   need(platform&&platform.game===game&&platform.sessionScope===sessionScope&&platform.roundScope===q.roundScope&&platform.originalResponseFrame===q.frame&&platform.requestTicket===q.requestTicket&&platform.currentCampaign===null&&platform.platformMode===1,'CURRENT_AUTHENTIC_FRESH_PLATFORM');
   currentContext(q);const state=nativeCaller.readDerivedState();need(JSON.stringify(state)===JSON.stringify(receipt.controlState)&&typeof state.max==='boolean'&&state.state===0,'UNCHANGED_SOURCE_TYPED_STATE');
   let acceptedAllocation=null;if(pending){need(source.readFrameRequestTicket(q.frame)===pending.binding.requestTicket&&q.frame.requestPayload===pending.plan.raw&&receipt.originalLogicRequestTicket===pending.binding.requestTicket,'REAL_FEATURE_REQUEST_TO_CHOICE_FREE_ACK');acceptedAllocation=allocs.get(pending.binding.allocationCapability);need(acceptedAllocation&&pending.binding.allocationCapability===allocation,'CURRENT_ACK_ALLOCATION');}else need(phase==='new','UNPLANNED_OR_REUSED_LOGIC_ACK');
   const projected=ed.project(q.frame,q.roundScope);
   if(pending){if(pending.binding.stage==='choice-request')acceptedAllocation.choiceACK=Object.freeze({game,sessionScope,roundScope:q.roundScope,frame:q.frame,executedRequestTicket:pending.binding.requestTicket,currentSelectionTicket:q.requestTicket});phase='inside-free';pending=null;}
   round=q.roundScope;current=q.frame;native=state;edRows=projected.frames;cursor=0;return Object.freeze({game,sessionScope,roundScope:round,frame:current,typedSourceState:state,actualChoiceACKBound:!!allocation&&!!allocs.get(allocation)?.choiceACK,sourceProjectionOnly:true,actualEndACK:false});
  },
  next(q){
   guard(q);need(current===q.frame&&native&&edRows&&!pending&&!usedNext.has(q.requestTicket),'ACTUAL_NEXT_ONCE_NO_PENDING_UNKNOWN');currentContext(q);usedNext.add(q.requestTicket);
   if(phase==='awaiting-positive-AG-choice')return Object.freeze({kind:'positive-choice-menu',menu,actualEndACK:false});
   need(['new','inside-free'].includes(phase),'UNMAPPED_NEXT_PHASE');
   if(cursor<edRows.length){const ordinal=cursor++;return Object.freeze({kind:'data',game,sessionScope,roundScope:round,frame:current,requestTicket:q.requestTicket,ordinal,orderedEd:edRows[ordinal],originalRawLogic:current.responsePayload,actualEndACK:false});}
   const j=J(),context={K:{J:j}};
   if(allocation&&allocs.get(allocation)?.choiceACK){
    const inner=Kwa.call({_context:context});if(inner==='continue-inner'){phase='free-ready';return Object.freeze({kind:'free-Logic-ready',originalAGAction:'FREE_SPIN',nativeRoute:'Kwa->wi->Fza/wF->NT->pI->own Logic',allocationCapability:allocation,actualEndACK:false});}
    need(inner==='finish-inner','SOURCE_INNER_ROUTE');allocs.get(allocation).completed=true;allocation=null;phase='feature-complete'; // Original kLa clears DO before outer transition.
   }else{
    need(!allocation,'CHOICE_ACK_REQUIRED_BEFORE_NATIVE_FREE');
    if(gpa.call({context})==='Y.te.La')return activate(q,'source-gpa/fresh-lI-false');
   }
   const trace=['source-typed-current-state','source-feature-gpa-or-inner-Kwa','te.La.kLa:DO=null-if-inner-finished','outer-DQ.Cia'];
   if(!qW){qW=true;const route=dRa.call({context});if(route==='Y.te.La')return activate(q,'source-Cia-dRa/fresh-lI-false');need(route===null,'MISSING_OWN_SELECTED_ALLOCATION_FOR_NATIVE_FREE');}
   need(phase==='feature-complete','NO_FEATURE_COMPLETION_END_FROM_INDEX');
   const c=currentContext(q),cap=nativeCaller.readConfiguredEndRequesterCapability(),connection=source.readOriginalConnectionState(sessionScope);need(nativeCaller.isOwnConfiguredEndFactory(cap)===true&&connection?.connected===true,'OWN_END_CAPABILITY_CONNECTION');
   const control=Object.freeze({Dqa:Object.freeze({gg:wire.deriveReplayMode().gg}),settings:Object.freeze({Mia:cap}),J:Object.freeze({...j,vb:Object.freeze({...j.vb,DO:null})}),lj:c.Ms});
   trace.push('IU(no-prior-result)','original-XW','own-End-requester-capability');
   const caller=Object.freeze({game,sessionScope,roundScope:round,frame:current,requestTicket:q.requestTicket,registration:'G.ea.Nb.DQ@G.ea.ka.jo',enteredFrom:'Cia',method:'IU',priorCloseResult:null,stateAlreadyTf:native.state===2,featuresCompletedWithoutRoute:true,Mia:cap,connected:connection.connected,extraRequestHooks:c.extraRequestHooks,originalMoneyCommitted:source.originalMoneyCommitted(current),sourceDerivedProtocolCallEntry:true,sourceProjectionOnly:true,trace:Object.freeze(trace)});
   callers.set(q.requestTicket,caller);controls.set(q.requestTicket,control);phase='End-ready';return Object.freeze({kind:'EndGame-ready-for-original-wire',originalAGAction:'PLAY',caller,control,actualEndACK:false});
  },
  readOriginalAGPositiveMenu(q){guard(q);return phase==='awaiting-positive-AG-choice'&&menu?.frame===q.frame?menu:undefined;},
  selectOriginalAGPositiveChoice(q,activeMenu,logicalIndex){
   guard(q);const c=currentContext(q);need(phase==='awaiting-positive-AG-choice'&&menus.has(activeMenu)&&activeMenu===menu&&menu.frame===q.frame&&menu.activationSID===c.Ms.jm&&menu.initModel===initModel,'ACTUAL_CURRENT_NATIVE_MENU');need(source.readOriginalRequestEvent(q.requestTicket)==='originalAG-positive-choice'&&Number.isInteger(logicalIndex)&&logicalIndex===1,'EXPLICIT_ORIGINAL_AG_POSITIVE_ONE');need(native.max===false,'MENU_MAX_INNER_START_UNMAPPED');
   const controls={Kl:{value:undefined},Hj:Array.from({length:5},()=>({value:undefined}))};equal.call(controls);const vector=acceptMap.call(controls);need(vector.length===5&&vector.every(x=>x===18),'SOURCE_EQUAL_ACCEPT_MAPPING');const cap=Object.freeze({game,sessionScope,roundScope:round,menu,selectionTicket:q.requestTicket,logicalIndex:1,Z7:Object.freeze([...vector]),sourcePreset:'equal-value28/explicit-accept-valueMinus10',sourceProjectionOnly:true});allocs.set(cap,{menu,choiceACK:null,completed:false});allocation=cap;phase='positive-choice-selected';return cap;
  },
  bindChoiceLogicRequest(q,cap){return bind(q,'choice-request',cap)},
  bindNextFreeLogicRequest(q){return bind(q,'free-request',allocation)},
  registerOriginalFeatureWirePlan(binding,plan){need(!sealed&&bindings.has(binding)&&byTicket.get(binding.requestTicket)===binding&&!pending&&!registeredPlans.has(plan)&&wire.isOwnWirePlan(plan)&&plan.kind==='Logic'&&plan.game===game&&plan.sessionScope===sessionScope&&plan.frame===binding.frame&&plan.roundScope===round&&plan.requestTicket===binding.requestTicket,'ONE_OWN_FEATURE_WIRE_PLAN');registeredPlans.add(plan);pending={binding,plan};phase='awaiting-actual-choice-or-free-ACK';return Object.freeze({event:'Logic',requestTicket:binding.requestTicket,roundScope:round,actualProviderRequestNotSentHere:true});},
  isOwn32803FeatureLogicBinding(b){return bindings.has(b)&&byTicket.get(b.requestTicket)===b&&b.game===game&&b.sessionScope===sessionScope&&b.roundScope===round&&b.frame===current&&b.initModel===initModel&&allocation===b.allocationCapability&&!allocs.get(allocation)?.completed},
  readCurrent32803FeatureLogicBinding(frame,ticket){const b=byTicket.get(ticket);return b?.frame===frame?b:undefined},
  readCloseCallerBinding(frame,ticket){const b=callers.get(ticket);return b?.frame===frame?b:null},
  readSourceControlBinding(frame,ticket){return callers.get(ticket)?.frame===frame?controls.get(ticket):null},
  isOwnConfiguredEndFactory(cap){return nativeCaller.isOwnConfiguredEndFactory(cap)},
  status(){return {phase,roundScope:round,currentFrame:current,pendingOriginalIntentRetained:!!pending,selectedAllocationRetained:!!allocation,actualChoiceACKBound:!!allocation&&!!allocs.get(allocation)?.choiceACK,qW,sourceProjectionOnly:true,actualEndACK:false}},
  seal(){sealed=true;ed.seal()},
 });
};
