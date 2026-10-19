'use strict';
exports.createOwn32790BGNativeDATA=function({vm,native,coinState,coinPrize,jackpot,closeGate,game,proof,need}){
 need(proof?.schema==='own32790-ordinary-BG-native-clear-close-source-v1'&&proof.gameId==='32790'&&proof.nativeHeaderGameID==='20460'&&proof.nativeBGCallerComplete===true&&proof.leaves?.clearFree?.source&&proof.leaves?.baseResponse?.source&&proof.leaves?.providerClose?.source&&proof.leaves?.ownCloseCaller?.source,'BG_NATIVE_CALLER_PROOF_REQUIRED');
 const clear=new vm.Script('('+proof.leaves.clearFree.source+')').runInNewContext({}, {timeout:100}),children=(n,t)=>Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===t);
 return Object.freeze({select({g,typedBG,win,jackpotNode}){
  need(!children(g,'FSInfo').length&&typedBG.Ck===false,'BG_NATIVE_ACTUAL_NO_FS_NONMAX');
  const cs=children(g,'CoinInfo');need(cs.length===1,'BG_NATIVE_ACTUAL_ONE_CoinInfo');const cn=cs[0],ci=native.parse('coin',cn);
  need(cn.attributes.getNamedItem('coinType')&&Array.isArray(ci.qo)&&ci.qo.every(Number.isFinite),'BG_NATIVE_ACTUAL_COIN_ARRAY');
  const model={M:{Ua:{},Tc:{qo:[],jy:[]},state:{Ck:typedBG.Ck}},ENa:{Bf:false},settings:{qea:true}};
  // This is the exact own SDK clear invoked by native base t4, not a missing-FS fallback or a synthetic Free budget.
  clear(model.M.Ua);if(ci.jy!=null||ci.Lp!=null)coinPrize.apply(model,ci);else coinState.call(model,ci);need(model.M.Ua.oe===false&&model.M.Ua.df===null,'BG_NATIVE_CLEAR_BRANCH_REQUIRED');
  if(jackpotNode){need(jackpot&&typeof jackpot.apply==='function','BG_NATIVE_JACKPOT_CALLER_REQUIRED');jackpot.apply(model,jackpotNode);}
  need(closeGate.call(model)===true,'BG_NATIVE_CLOSE_GATE_HELD');
  return Object.freeze({event:'EndGame',action:'PLAY',sourceCumulativeWin:win,sourceProtocolKind:'BGInfo+CoinInfo-native-clear',sourceCoinCounts:{blue:model.M.Tc.I_,green:model.M.Tc.a2,red:model.M.Tc.W4},requestNotSent:true,actualEndACK:false,roundComplete:false,noDisplayCallbackExecuted:true});
 }});
};
