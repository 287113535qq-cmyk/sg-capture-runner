'use strict';
const proof=require('./own32790-CoinPrize-source-DATA.json');
exports.createOwn32790CoinPrizeDATA=function({coinState,closeGate,need}){
 need(proof.schema==='own32790-native-CoinPrize-local-effect-DATA-v1'&&proof.gameId==='32790'&&proof.leaves.coinFeatureClose.source==='function(){return null}','COIN_PRIZE_SOURCE_CALLER_PROOF');
 return Object.freeze({apply(model,coin){
  need(Array.isArray(coin.qo)&&coin.qo.every(Number.isFinite),'ACTUAL_COIN_TYPES');
  for(const key of ['jy','Lp'])need(coin[key]==null||Array.isArray(coin[key])&&coin[key].every(Number.isFinite),'ACTUAL_COIN_ARRAY_'+key);
  const beforeUa=JSON.stringify(model.M.Ua),beforeState=JSON.stringify(model.M.state),beforeClose=closeGate.call(model);
  coinState.call(model,coin);
  need(JSON.stringify(model.M.Ua)===beforeUa&&JSON.stringify(model.M.state)===beforeState&&closeGate.call(model)===beforeClose,'COIN_LOCAL_EFFECT_PRESERVES_NATIVE_NEXT');
  need(coin.jy==null||coin.jy.every((x,i)=>model.M.Tc.jy[i]===x),'ACTUAL_PRIZE_COPIED');
  need(coin.Lp==null||coin.Lp.every((x,i)=>model.M.Tc.Lp[i]===x),'ACTUAL_JACKPOT_COPIED');
  return Object.freeze({sourcePrizePresent:coin.jy!=null,sourceCoinJackpotPresent:coin.Lp!=null,nativeCloseUnchanged:true,providerRequests:0,displayCallbacksExecuted:0});
 }});
};
