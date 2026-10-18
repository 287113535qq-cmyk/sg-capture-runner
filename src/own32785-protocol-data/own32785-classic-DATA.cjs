'use strict';
// Pure request/next/End DATA. Never construct GLSRequestor or its HTTP actor.
exports.createOwn32785ClassicDATA=function({DOM,vm,data,sharedSource,game,need}){
 const shared={},later=[];let emits=[],custom,base,platform,logic={gameState:0};
 const ctx=vm.createContext({document:{implementation:DOM.implementation,createAttribute:n=>new DOM.DOMParser().parseFromString('<x/>','text/xml').createAttribute(n)},XMLSerializer:DOM.XMLSerializer,
  define:(deps,f)=>f(()=>{throw Error('No shared network dependency');},shared,{}, {}, {}),
  TweenLite:{delayedCall:(delay,f)=>later.push(f)},setTimeout:(f)=>later.push(f),ladyofegypt:{Config:{REQUEST_DELAY_TIME:0,BONUS_GUARANTEE_BANNER_WAIT_TIME:0}},console:{log(){}}});
 vm.runInContext(sharedSource,ctx,{timeout:1000});
 const own=n=>vm.runInContext('('+data.newOwnSourceLeaves[n].source+')',ctx,{timeout:1000});
 const select=own('stateSelector'),spinComplete=own('realEndCaller'),transition=own('freeTransitionCompleted'),startFree=own('startFreeGame'),payload=own('wagerSerializer'),currencyParser=own('parseCurrentCurrency');
 // The exact own Init parser only calls these shared DATA classes.
 ctx.glscomms=shared;
 const noop=()=>{},view=new Proxy({getWin:()=>undefined,getFGGaffing:()=>false,isWinMeterShown:()=>true},{get:(o,n)=>o[n]||noop});
 Object.assign(logic,{historyData:null,isHistoryReplay:false,endSent:false,freeGameIntro:false,lastWager:Object.freeze({getTotalBet:()=>game.sg.betRaw}),
  slot:{resetMultiplier:noop,getWinDisplayController:()=>({showMessages:noop,startBonusSymAnimation:noop})},uiController:view,
  getBaseGameData:()=>base,getFreeSpinData:()=>custom,getFreeGeemReelSet:()=>undefined,
  glsRequestor:{makeEndRequest:()=>emits.push('EndGame')},sendWager:()=>emits.push('Logic'),showFreeGameRetriggerBanner:noop,
  fgTransitionController:{removeFreeGameIntroBanner:noop,getISAssetsLoaded:()=>true,startFreeGameTransition:noop,showBonusGaurantBanner:noop}});
 const int=(node,name)=>{const a=node?.attributes?.getNamedItem(name);need(a&&/^-?\d+$/.test(a.value)&&Number.isSafeInteger(Number(a.value)),'actual '+name);return Number(a.value)};
 const children=(n,name)=>Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===name);
 const doc=text=>new DOM.DOMParser().parseFromString(text,'text/xml');
 const tags=(d,name)=>Array.from(d.getElementsByTagName(name));
 function wire(event,sid){
  need(event==='Init'||platform,'actual initialized request DATA');
  const metadata={isRealMoney:()=>game.sg.header.freePlay!=='Y',getGameCode:()=>game.sg.header.gameCodeRGI,getLocale:()=>game.sg.header.lang};
  const session={getContextID:()=>game.sg.header.affiliate,getPlayerID:()=>game.sg.header.userID};
  const h=new shared.GLSRequestHeader(metadata,session,{id:game.sg.header.gameID,version:game.sg.header.versionID},sid,event==='Init'?null:platform);
  const q=new shared.GLSRequestData(event,h);
  if(event==='Logic'){
   const m=platform.getCurrencyMultiplier();need(Number.isSafeInteger(m)&&m>0,'own outgoing multiplier');
   q.addCustomPayload(new shared.CurrencyMultiplierPayload(m));q.addCustomPayload({toXML:()=>payload.call({totalStake:game.sg.betRaw})});
  }
  return q.toXMLString();
 }
 return Object.freeze({
  wire,
  init(text){const d=doc(text);platform=currencyParser.call({},d);need(!platform.isRecovering,'nonrecovery own Init');const menus=tags(d,'Stakes');need(menus.length===1,'one own actual stake menu');const values=menus[0].textContent.split('|').map(Number);need(values.every(Number.isSafeInteger)&&values.includes(game.sg.betRaw),'actual selected stake in own menu');return platform},
  begin(){need(!emits.length&&!later.length,'prior protocol transition consumed');logic.gameState=0;logic.endSent=false;logic.freeGameIntro=false;custom=base=undefined},
  next(text){
   const d=doc(text),results=tags(d,'GameResult');need(results.length===1,'one actual own game result');const g=results[0],bg=children(g,'BaseGame');need(bg.length===1,'actual own BaseGame');
   const recovery=children(g,'BaseGameRecoveryInfo');need(recovery.length<=1,'one actual own base recovery marker');
   const win=recovery.length?int(bg[0],'totalWagerWin'):int(g,'totalWin');need(win>=0&&int(g,'stake')===game.sg.betRaw,'actual stake and cumulative money');
   const max=bg[0].getAttribute('isMaxWin');need(max==='Y'||max==='N','actual own max selector');
   const features=children(g,'Feature'),freeNodes=features.filter(x=>x.getAttribute('name')==='FreeSpins');need(freeNodes.length<=1,'one own FreeSpins source');
   // Other features are retained raw. Only an unmapped network mode is a stop;
   // RandomWild/Jackpot are passive under the own reply/next selector.
   need(features.every(x=>['FreeSpins','RandomWild','Jackpot','bonusGuarantee'].includes(x.getAttribute('name'))),'unmapped actual feature');

   let bonus=false,free;
   const bgTag={getIsMaxWin:()=>max==='Y',getTotalWagerWin:()=>win};
   if(recovery.length){
    need(freeNodes.length===1,'actual free selector data');const n=freeNodes[0].childNodes[0];
    const total=int(n,'totalFreeSpinsAwarded'),played=int(n,'currentSpinNumber'),award=int(n,'freeSpinsAwarded');need(total>=played&&played>=0&&award>=0,'own actual free counter domain');
    const remaining=total-played,bonusNodes=features.filter(x=>x.getAttribute('name')==='bonusGuarantee');need(bonusNodes.length<=1,'one own bonus flag');
    const fsWin=int(n,'freeSpinTotalWin');need(fsWin>=0,'actual free total win');
    // No absent bonus amount is exported, and no UI display equation is tested.
    const bonusAmount=bonusNodes.length?int(bonusNodes[0],'bonusAwarded'):undefined;
    custom={getSpinsRemaining:()=>remaining,getSpinsAwarded:()=>award,getFGTriggerWin:()=>int(n,'triggerWin'),getBGTagData:()=>bgTag,getIsBonusGuarantee:()=>bonusNodes.length===1,getBonusAmount:()=>bonusAmount,getTotalWin:()=>win};
    bonus=award>0;free=Object.freeze({freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:remaining,accumulativeWin:fsWin/100});
   }else{
    need(logic.gameState===0,'free current frame lost actual source selector');let freeGameInfo;
    if(freeNodes.length){const n=freeNodes[0].childNodes[0];need(n?.attributes,'actual own trigger child');if(n.attributes.length===2){const award=int(n,'freeSpinsAwarded'),trigger=int(n,'triggerWin');need(award>=0,'own trigger count');freeGameInfo={getFreeGameAward:()=>award,getFreeTriggerWin:()=>trigger}}}
    base={getFreeGameInfo:()=>freeGameInfo};bonus=freeGameInfo!==undefined;
   }
   const gameData={isBonusTriggered:()=>bonus,getCustomData:()=>custom};logic.gameState=select.call(logic,logic.gameState,gameData);
   emits=[];need(!later.length,'no old callback');
   if(logic.gameState===6){transition.call(logic)}
   else{
    spinComplete.call(logic);
    if(logic.gameState===2){startFree.call(logic);transition.call(logic)}
    else if(logic.gameState===5){spinComplete.call(logic);spinComplete.call(logic)}
   }
   while(later.length){const f=later.shift();f()}
   need(emits.length===1&&['Logic','EndGame'].includes(emits[0]),'one real own request callback');const event=emits.shift();
   return Object.freeze({event,action:event==='Logic'?'FREE_SPIN':'PLAY',sourceCumulativeWin:win,...(free?{free}:{}),sourceState:logic.gameState});
  },
  acceptedEnd(){need([0,6].includes(logic.gameState),'own completed source state');if(logic.gameState===6)logic.gameState=select.call(logic,6,null);logic.endSent=false}
 });
};
