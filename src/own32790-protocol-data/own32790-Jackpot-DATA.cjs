'use strict';
const proof=require('./own32790-Jackpot-source-DATA.json');
exports.createOwn32790JackpotDATA=function({vm,native,closeGate,need}){
 need(proof.schema==='own32790-current-JackpotInfo-native-local-effect-DATA-v1'&&proof.gameId==='32790','JACKPOT_SOURCE_PROOF');
 const write=new vm.Script('('+proof.leaves.jackpotState.source+')').runInNewContext({}, {timeout:100});
 return Object.freeze({apply(model,node){
  for(const name of ['jackpotIndex','jackpotUpgrade','jackpotIndexAfterUpgrade','jackpotWinnings'])need(node.attributes.getNamedItem(name),'ACTUAL_JACKPOT_'+name);
  const value=native.parse('jackpot',node);
  need([value.fm,value.lJa,value.nJa].every(x=>Number.isSafeInteger(x)&&x>=0)&&typeof value.$m==='boolean','ACTUAL_TYPED_JACKPOT');
  const freeBefore=JSON.stringify(model.M.Ua),stateBefore=JSON.stringify(model.M.state),closeBefore=closeGate.call(model);
  // The own SDK bMa writes M.ze only. Neither free budget nor the native
  // close gate takes a jackpot field as an input, and no amount is replaced.
  model.M.ze={};write.call(model,value);
  need(JSON.stringify(model.M.Ua)===freeBefore&&JSON.stringify(model.M.state)===stateBefore&&closeGate.call(model)===closeBefore,'JACKPOT_LOCAL_EFFECT_PRESERVES_NATIVE_NEXT');
  return Object.freeze({nativeCloseUnchanged:true,providerRequests:0,displayCallbacksExecuted:0});
 }});
};
