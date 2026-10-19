'use strict';
const proof=require('./own32810-Milestone-source-DATA.json');
// A mapping can be accepted only by the flow for the same game object.
const capabilities=new WeakMap();
exports.isOwn32810MilestoneMapping=(mapping,game)=>capabilities.get(mapping)===game;
exports.createOwn32810MilestoneDATA=function({DOM,vm,data,native,game,need}){
 need(proof.schema==='own32810-native-Milestone-next-caller-DATA-v1'&&proof.gameId==='32810','MILESTONE_SOURCE_PROOF');
 const actions={MS_BEGIN:0,MS_END:1,MS_STEP:2,MS_ADVANCE:3,MS_RETREAT:4};
 const ctx=vm.createContext({BF:{Engines:{Responses:{MilestoneTrackAction:actions}}}}),leaf=k=>new vm.Script('('+proof.leaves[k].source+')').runInContext(ctx,{timeout:100});
 const parser={parseFsInfo:leaf('parseFsInfo')},parseFS=leaf('parseFreespins'),parseBG=leaf('parseBGInfo'),parseMax=leaf('parseMaxWinnings'),maxCheck=leaf('checkMaxWin'),parseFeature=new vm.Script('('+data.sourceLeaves.feature.source+')').runInContext(ctx,{timeout:100});
 const active=new WeakSet(),seen=new WeakMap();
 const uint=v=>Number.isSafeInteger(v)&&v>=0,children=(n,t)=>Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===t);
 return Object.freeze({isActive:round=>active.has(round),select({session,round,source,frame,g,cash}){
  need(frame&&source?.has(frame)&&source.readCurrent(session,round)===frame&&frame.game===game&&frame.sessionScope===session&&frame.roundScope===round,'MILESTONE_CURRENT_FRAME');
  if(seen.has(frame))return seen.get(frame);
  const init=source.readAcceptedInit?.();need(init&&source.has(init)&&init.game===game&&init.sessionScope===session&&init.msgId==='Init'&&init.httpStatus>=200&&init.httpStatus<300,'MILESTONE_SAME_ACCEPTED_INIT');
  const initial=native.parse(init.responsePayload).GameResponse?.[0],env=native.parse(frame.responsePayload).GameResponse?.[0],typed=env?.GameResult?.[0],fsNodes=children(g,'FSInfo');
  need(fsNodes.length===1&&typed?.FSInfo?.length===1,'MILESTONE_ACTUAL_ONE_FS');
  const first=typed?.ReelResults?.[0]?.ReelSpin?.[0];need(first&&['Y','N'].includes(first.attr_bonusAwarded?.value),'MILESTONE_ACTUAL_BONUS_FLAG');
  const feature=parseFeature.call({parseFreespins:x=>parseFS.call(parser,x)},typed,first),fs=feature.freespinsData?.fsInfo,bg=typed.BGInfo?.[0]&&parseBG(typed.BGInfo[0]);
  need(feature.featureAwarded===true&&fs&&Number.isSafeInteger(fs.milestoneIndex)&&fs.milestoneIndex>=-1,'MILESTONE_NATIVE_FEATURE');
  need(Array.isArray(fs.mileStones)&&fs.mileStones.length===children(fsNodes[0],'Milestone').length&&fs.mileStones.every(x=>uint(x.index)&&uint(x.spinsUsed)&&uint(x.totalSpins)),'MILESTONE_NATIVE_SOURCE_ARRAY');
  need(bg&&bg.totalWagerWin===cash&&uint(bg.baseGameSpinsRemaining)&&typeof bg.isBigBet==='boolean','MILESTONE_ACTUAL_BG');
  // Nested MAX flags are not a fabricated terminal indication.
  need(fs.isMaxWin===false&&bg.isMaxWin===false,'MILESTONE_MAX_SUBROUTE_DEFERRED');
  const limit=parseMax(initial);need(Number.isSafeInteger(limit)&&limit>0,'MILESTONE_ACTUAL_INIT_MAX');
  const isActive=active.has(round);if(!isActive)need(typed.ReelResults.length===1&&typed.ReelResults[0].ReelSpin.length===1&&typed.attr_totalWin&&uint(typed.attr_totalWin.value),'MILESTONE_ENTRY_SINGLE_SPIN_SOURCE_ONLY');const parseTotal=new vm.Script('('+proof.comparisonSupplement.leaves.parseTotalWin.source+')').runInContext(ctx,{timeout:100}),values=[isActive?cash:parseTotal(env)];
  need(values.length>0&&values.every(uint),'MILESTONE_NATIVE_COMPARISON_VALUES');
  // Source abstraction: all native metadata/comparison alternatives must agree.
  // No host MAX setting is invented; disagreement retains the outcome for A.
  for(const value of values)for(const enabled of [false,true])for(const greaterOrEqual of [false,true]){
   const receiver={maxWinGreaterOrEqual:greaterOrEqual,models:{winModel:{getMaxWinningsEnabled:()=>enabled,getFeatureData:()=>feature,getTotalWin:()=>value,getMaxWinnings:()=>limit}}};
   need(maxCheck.call(receiver,value)===false,'MILESTONE_NATIVE_MAX_METADATA_REQUIRED');
  }
  // Native parseFsInfo leaves action undefined for the observed empty state.
  // Native checkFinished tests only MS_END; no action enum/default is added.
  const entryToSpin=!isActive&&fs.milestoneIndex!==-1;
  const ending=!entryToSpin&&fs.action===actions.MS_END;
  if(ending)need(bg.baseGameSpinsRemaining===0&&bg.isBigBet===false,'MILESTONE_END_BIGBET_ROUTE_DEFERRED');
  const mapping=Object.freeze({event:ending?'EndGame':'Logic',action:ending?'PLAY':'FREE_SPIN',free:undefined,sourceCumulativeWin:cash,sourceProtocolKind:'native-Milestone-next-request',sourceMilestoneAction:fs.action,sourceMilestoneIndex:fs.milestoneIndex,sourceMilestoneSteps:fs.milestoneSteps,sourceNativeRoute:entryToSpin?'DISPLAY-SPINNING':ending?'UPDATE_TRAIL-CLOSE':'UPDATE_TRAIL-SPINNING',requestNotSent:true,actualEndACK:false,roundComplete:false,displayPipelineExecuted:false,displayCallbacksProduced:0,sourceComparisonInvariant:true});
  active.add(round);capabilities.set(mapping,game);seen.set(frame,mapping);return mapping;
 }});
};
