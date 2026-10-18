'use strict';
// Frozen own serializers and Init currency DATA; no HTTP implementation loaded.
exports.createOwn32757OriginalWire=function({DOM,vm,data,game}){
 const need=(x,m)=>{if(!x)throw Object.assign(new Error('OWN32757_REQUEST_HOLD_'+m),{retryAllowed:false,newRequestNotSent:true})};
 need(data?.schema==='own32757-original-request-DATA-v1455'&&game?.gameId==='32757'&&game.sg?.header?.gameID==='20132'&&game.sg.header.gameCodeRGI==='cheshirecat','OWN_IDENTITY');
 const context=vm.createContext({server:{PlatformData:function(){}}}),own=n=>new vm.Script('('+data.leaves[n].source+')').runInContext(context,{timeout:100});
 const Header=own('headerConstructor'),headerXML=own('headerXML'),stakeXML=own('stakeXML'),currencyXML=own('currencyXML'),platform=own('platform');
 let current;
 return Object.freeze({
  init(text){const d=new DOM.DOMParser().parseFromString(text,'text/xml'),root=d.documentElement,h=d.getElementsByTagName('Header');need(root?.nodeName==='GameResponse'&&root.getAttribute('type')==='Init'&&h.length===1&&h[0].getAttribute('gameID')==='20132'&&h[0].getAttribute('isRecovering')==='N'&&!d.getElementsByTagName('Error').length&&!d.getElementsByTagName('Errors').length,'ACTUAL_NORMAL_INIT');
   const value={};platform.call({},d,value);need(Number.isSafeInteger(value.platformData.currencyMultiplier)&&value.platformData.currencyMultiplier>0,'ACTUAL_OUTGOING_MULTIPLIER');
   const menus=d.getElementsByTagName('Stakes');need(menus.length===1,'OWN_MENU');const menu=menus[0].textContent.split('|').map(Number);need(menu.every(Number.isSafeInteger)&&menu.includes(game.sg.betRaw),'ACTUAL_SELECTED_WAGER');current=value.platformData;return current;
  },
  wire(event,sid){need(['Init','Logic','EndGame'].includes(event)&&typeof sid==='string'&&sid.length>0,'EXPLICIT_EVENT_CURSOR');need(event==='Init'||current,'INIT_REQUIRED');const h=game.sg.header,metadata={isRealMoney:()=>h.freePlay!=='Y',getGameCode:()=>h.gameCodeRGI,getLocale:()=>h.lang},session={getContextID:()=>h.affiliate,getPlayerID:()=>h.userID};
   const header=new Header(metadata,session,sid,h.gameID,h.versionID);let body='';if(event==='Logic'){need(Number.isSafeInteger(game.sg.betRaw)&&game.sg.betRaw>0,'OWN_WAGER');body=stakeXML.call({_stake:game.sg.betRaw})+currencyXML.call({_currencyMultiplier:current.currencyMultiplier})}
   return '<GameRequest type="'+event+'">'+headerXML.call(header)+body+'</GameRequest>';
  }
 });
};
