
'use strict';
exports.createOwn32763TerminalProtocolLeaf=function({vm,DOM,data}){
 const need=(ok,s)=>{if(!ok)throw Object.assign(new Error('OWN32763_PROTOCOL_HOLD_'+s),{code:'OWN32763_UNMAPPED_PROTOCOL_STATE',newRequestNotSent:true})};
 need(vm?.Script&&DOM?.DOMParser&&data?.schema==='own32763-native-source-counter-terminal-protocol-DATA-v3','OWN_DATA_DEPENDENCIES');
 const c=vm.createContext({game:{},server:{},dragonwings:{},console:{log(){}}});
 new vm.Script(data.originalProgramSource,{filename:'own32763-original-protocol-only-DATA.js'}).runInContext(c,{timeout:1000});
 const states=c.game.BaseGameStates, expected=[['FREESPIN_OUTRO','BIG_BET_CONTINUE_STATE'],['BIG_BET_CONTINUE_STATE','BIG_WIN_STATE'],['BIG_WIN_STATE','END_GLS_STATE']];
 for(const [from,to]of expected){const e=data.stateEdges.filter(e=>e.from===from);need(e.length===1&&e[0].to===to,'EXACT_UNIQUE_SOURCE_EDGE_'+from)}
 need(data.finishedFSBranchTargets.length===2&&data.finishedFSBranchTargets.every(x=>x==='FREESPIN_OUTRO'),'EXACT_SOURCE_FINISHED_SELECTOR');
 const parsers=[new c.server.GLSReelResultParser(),new c.game.BaseGameParser(),new c.game.FreeSpinParser(),new c.game.HydeSpinsParser(),new c.game.TrailParser()];
 const memo=new WeakMap();let ownInit=null;
 function document(text){need(typeof text==='string'&&text.length>0,'ACTUAL_RAW_XML');const d=new DOM.DOMParser().parseFromString(text,'text/xml');need(d.getElementsByTagName('Error').length===0,'SUCCESSFUL_ENVELOPE');return d}
 function header(d){const h=d.getElementsByTagName('Header');need(h.length===1&&h[0].getAttribute('gameID')==='20126'&&h[0].getAttribute('versionID')==='1_0','OWN_HEADER');return h[0]}
 return Object.freeze({prepare({initFrame,frame,metadata,partnerAdapter,readReplayMode}){
  need(initFrame&&frame&&typeof initFrame==='object'&&typeof frame==='object','ACTUAL_FRAME_OBJECTS');
  need(typeof readReplayMode==='function','ORIGINAL_ROUTE_REPLAY_POLICY');const replay=readReplayMode();need(replay===false,'NO_HISTORY_OR_UNKNOWN_MODE');
  const cached=memo.get(frame);if(cached){need(cached.init===initFrame&&cached.request===frame.requestPayload&&cached.response===frame.responsePayload&&cached.metadata===metadata&&cached.partner===partnerAdapter&&cached.replayReader===readReplayMode&&cached.initRequest===initFrame.requestPayload&&cached.initResponse===initFrame.responsePayload&&initFrame.httpStatus===200&&frame.httpStatus===200&&initFrame.msgId==='Init'&&frame.msgId==='Logic','UNCHANGED_CURRENT_FRAME_SCOPE');if(cached.portHeader){const now=new c.server.GLSHeader(metadata,partnerAdapter.getSessionData(),cached.responseSID,'20126','1_0');need(now.parse()===cached.portHeader,'UNCHANGED_CURRENT_CONNECTION_METADATA')}return cached.value}
  need(initFrame.msgId==='Init'&&initFrame.httpStatus===200&&frame.msgId==='Logic'&&frame.httpStatus===200,'ACCEPTED_OWN_INIT_AND_LOGIC');
  const initRequestDocument=document(initFrame.requestPayload),initResponseDocument=document(initFrame.responsePayload);const acceptedInitHeader=header(initResponseDocument);need(initRequestDocument.documentElement.getAttribute('type')==='Init'&&initResponseDocument.documentElement.getAttribute('type')==='Init'&&acceptedInitHeader.getAttribute('isRecovering')==='N','OWN_ACCEPTED_NORMAL_INIT');
  const init=header(initRequestDocument),request=header(document(frame.requestPayload)),response=document(frame.responsePayload),h=header(response);
  need(init.getAttribute('gameCodeRGI')==='drjekyllgoeswild'&&request.getAttribute('gameCodeRGI')==='drjekyllgoeswild'&&h.getAttribute('isRecovering')==='N','KNOWN_OWN_NONRECOVERY_SCOPE');
  need(response.documentElement.getAttribute('type')==='Logic'&&document(frame.requestPayload).documentElement.getAttribute('type')==='Logic','CURRENT_LOGIC_ENVELOPE');
  need(response.getElementsByTagName('HSInfo').length===0&&response.getElementsByTagName('TrailInfo').length===0,'UNKNOWN_HYDE_OR_TRAIL_BRANCH');
  const gameResults=response.getElementsByTagName('GameResult');need(gameResults.length===1,'ONE_ACTUAL_GAME_RESULT');
  const directNames=Array.from(gameResults[0].childNodes).filter(n=>n.nodeType===1).map(n=>n.nodeName);for(const name of ['FSInfo','BGInfo','ReelResults'])need(directNames.filter(n=>n===name).length===1,'ONE_DIRECT_'+name);need(directNames.filter(n=>n==='BaseGameRecoveryInfo').length<=1,'ONE_RECOVERY_INFO');
  need(response.getElementsByTagName('FSInfo').length===1&&response.getElementsByTagName('BGInfo').length===1,'UNAMBIGUOUS_SOURCE_COUNTER_INPUTS');
  const sourceFS=response.getElementsByTagName('FSInfo')[0];for(const key of ['freeSpinNumber','freeSpinsTotal']){const raw=sourceFS.getAttribute(key);need(typeof raw==='string'&&/^(?:0|[1-9]\d*)$/.test(raw)&&Number.isSafeInteger(Number(raw)),'SOURCE_COUNTER_ATTRIBUTE_'+key)}
  const typed={};for(const p of parsers)p.parse(response,typed);
  const fs=typed.fsData,bg=typed.baseGameData;
  need(fs&&bg&&Number.isSafeInteger(fs.freeSpinNumber)&&fs.freeSpinNumber>=0&&Number.isSafeInteger(fs.freeSpinsTotal)&&fs.freeSpinsTotal>=0,'SOURCE_COUNTER_TYPES');
  need(bg.baseGameSpinsRemaining===0&&bg.isBigBet===false&&bg.isMaxWin===false&&Number.isSafeInteger(bg.totalWagerWin)&&bg.totalWagerWin>=0,'KNOWN_BASE_GAME_PROTOCOL_SCOPE');
  need(!ownInit||ownInit===initFrame,'ONE_ACTUAL_INIT_SCOPE');
  const owner={_server:{getLogicResponse:()=>typed}},prototype=c.HandleFSLogicChoiceCmd.prototype;
  const more=prototype.hasFreespins.call(owner),finished=prototype.hasFreespinsFinished.call(owner);
  let result,portHeader=null,responseSID=null;
  if(more){need(!finished,'EXCLUSIVE_SOURCE_DECISION');result=Object.freeze({kind:'continuation',event:'Logic',protocolState:states.LOGIC_GLS_STATE,actualEndConstructed:false})}
  else{
   need(finished===true,'ACTUAL_ORIGINAL_FINISHED_PREDICATE');
   let protocolState=states.FREESPIN_OUTRO;
   const protocolTrace=[states.FREESPIN_EXIT_STATE,protocolState], effects=[];
   const projection={getCurrentState:()=>({stateName:protocolState}),gotoNextState(){const edge=data.stateEdges.filter(e=>states[e.from]===protocolState);need(edge.length===1,'UNIQUE_PROJECTED_NEXT');protocolState=states[edge[0].to];protocolTrace.push(protocolState)},doChangeStateByName(next){need(protocolState===states.BIG_WIN_STATE&&next===states.END_GLS_STATE,'ORIGINAL_COMPLETION_NEXT');protocolState=next;protocolTrace.push(next)}};
   projection.gotoNextState();
   c.HandleBigBetCmd.prototype.execute.call({_serverModel:{getLogicResponse:()=>typed},_bigBetStakesModel:{setIsBigBet(value){effects.push({field:'isBigBet',value})}},_statesModel:projection});
   need(protocolState===states.BIG_WIN_STATE&&effects.length===1&&effects[0].value===false,'ORIGINAL_BIGBET_ZERO_BRANCH');
   c.HandleBigWinComplete.prototype.execute.call({_statesModel:projection});
   need(protocolState===states.END_GLS_STATE,'ORIGINAL_END_STATE_SELECTED');
   need(metadata&&['isRealMoney','getGameCode','getLocale'].every(k=>typeof metadata[k]==='function')&&partnerAdapter&&['getSessionData','finishedPlay','finishedPostGameAnimations'].every(k=>typeof partnerAdapter[k]==='function'),'ORIGINAL_CONNECTION_PORTS');
   const sid=h.getAttribute('sessionID');need(typeof sid==='string'&&sid.length>0,'ACTUAL_RESPONSE_CURSOR');
   const nativeHeader=new c.server.GLSHeader(metadata,partnerAdapter.getSessionData(),sid,'20126','1_0');
   portHeader=nativeHeader.parse();responseSID=sid;
   const nativeHeaderDocument=document('<Envelope>'+nativeHeader.parse()+'</Envelope>'),preparedHeader=header(nativeHeaderDocument);
   for(const key of data.headerAttributes){if(key!=='sessionID')need(preparedHeader.getAttribute(key)===request.getAttribute(key)&&request.getAttribute(key)===init.getAttribute(key),'CURRENT_CONNECTION_HEADER_'+key)}
   let nativeData;const command=new c.MakeEndRequestCmd();
   command._partnerAdapter=partnerAdapter;command._history={getIsHistoryReplay:()=>replay};command._server={makeEndRequest(value){need(!nativeData,'ONE_NATIVE_END_CANDIDATE');nativeData=value}};
   command.execute();
   need(nativeData instanceof c.server.GLSRequest&&nativeData.getEncoders().length===0,'ACTUAL_ORIGINAL_END_CONSTRUCTOR');
   const nativeRequestPayload=c.GLSEndRequester.prototype.parseRequestData.call({_partnerAdapter:partnerAdapter,_metaData:metadata,_sessionId:sid,_glmId:'20126',_glmVersion:'1_0'},nativeData);
   result=Object.freeze({kind:'native-end-candidate',event:'EndGame',requestPayload:nativeRequestPayload,protocolPath:Object.freeze(protocolTrace),originalProtocolEffects:Object.freeze(effects),sourceDecision:'originalFSFinished+uniqueSourceTable+baseRemaining0+originalEndCommandAndRequester',actualEndConstructed:true,transportAttempted:false,newProviderACK:false})
  }
  ownInit=initFrame;memo.set(frame,{init:initFrame,request:frame.requestPayload,response:frame.responsePayload,metadata,partner:partnerAdapter,replayReader:readReplayMode,initRequest:initFrame.requestPayload,initResponse:initFrame.responsePayload,portHeader,responseSID,value:result});return result
 }})
};
