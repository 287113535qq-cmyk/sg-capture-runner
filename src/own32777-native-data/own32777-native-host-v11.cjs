"use strict";
const vm=require('node:vm');
const ownPaidArraySource="(function(a){(function(f){(function(f){var h;(function(e){e.clear=function(d){a.Ba.By.clear(d);d.ob={};f.wb.clear(d.ob)};e.clone=function(d){var b=a.Ba.By.clone(d);return y(y({},b),{ob:{ub:d.ob.ub.slice(),xi:d.ob.xi.clone(),Xm:d.ob.Xm},yb:y(y({},b.yb),{nB:y({},d.yb.nB),ek:d.yb.ek&&d.yb.ek.slice(),kn:d.yb.kn&&d.yb.kn.slice(),Vj:d.yb.Vj})})}})(h=f.aDa||(f.aDa={}));(function(a){a.clear=function(a){a.length=0};a.clone=function(a){return a.map(function(a){return h.clone(a)})}})(f.UR||(f.UR={}))})(f.Ba||\n(f.Ba={}))})(a.$||(a.$={}))})(F||(F={}));";
const usedContexts=new WeakSet();
let registered;
function need(ok,reason){if(!ok)throw Object.assign(new Error('AG integrity: own32777 '+reason),{code:'OWN32777_NATIVE_SOURCE_HOST_HOLD',reason});}
function registerOwn32777NativeSource(binding){
 need(!registered&&binding?.contract==='own32777-source-owned-native-context-and-root-v11','ONE_EXPLICIT_OWN_SOURCE_BINDING');
 for(const k of ['createNativeContext','installOriginalRoot','serializeXML'])need(typeof binding[k]==='function','REQUIRED_SOURCE_BINDING_'+k);
 need(typeof binding.originalSettingsExpression==='string'&&binding.originalSettingsExpression.length>0,'PINNED_ORIGINAL_SETTINGS_EXPRESSION');
 registered=Object.freeze({...binding});
}
function createOwn32777NativeHostFactory(binding){
 need(binding?.contract==='own32777-source-owned-native-context-and-root-v11','EXPLICIT_SOURCE_BINDING');
 need(typeof binding.bindOriginalPlatform==='function'||binding.controlledOfflineFixture===true,'SOURCE_PLATFORM_BINDER_REQUIRED');
 return function(input){
  const context=binding.createNativeContext(input);
  need(context&&vm.isContext(context)&&!usedContexts.has(context),'FRESH_EXCLUSIVE_OWN_SOURCE_VM');
  need(context.Z?.Hg?.Hg&&context.SG?.Mc?.ne?.Ht?.yn&&context.F?.cj?.Nh,'ORIGINAL_NATIVE_CONSTRUCTORS');
  usedContexts.add(context);context.__ownSerializeXML=binding.serializeXML;
  if(!context.F.$.Ba.UR)new vm.Script(ownPaidArraySource,{filename:"own32777-original-paid-wager-array.js"}).runInContext(context);
  need(typeof context.F.$.Ba.UR?.clear==="function","ORIGINAL_PAID_WAGER_ARRAY_CLEAR");
  let engineBound=false,closed=false;
  return Object.freeze({
   context,
   initialSettings(){need(!closed&&!engineBound,'ONE_ORIGINAL_NATIVE_SETTINGS');return new vm.Script('(function(qd){return ('+binding.originalSettingsExpression+');})(Z)',{filename:'own32777-pinned-settings-DATA.js'}).runInContext(context);},
   bindOriginalPlatform(request,frame){
    need(!closed&&!engineBound&&request?.ti&&frame.msgId==='Init','ONE_ACTUAL_INIT_PLATFORM_BINDING');engineBound=true;
    if(typeof binding.bindOriginalPlatform==='function'){binding.bindOriginalPlatform({...input,context,request,frame});return;}
    need(binding.controlledOfflineFixture===true,'CONTROLLED_PLATFORM_PORTS_ARE_TEST_ONLY');
    const h=request.ti;need(typeof h.ny==='string'&&h.ny.length>0&&typeof h.om==='string'&&h.om===frame.requestSessionID,'ACTUAL_INIT_USER_AND_SESSION');
    const platform={zA:h.lang,OI:h.vI,$O:{unboundPresentationMode:true}};
    const replay={lg:false,error:false,$g:null};
    context.SG.Lh={yda:{get(){return replay;}}};
    context.SG.Ze={WF:class Own32777NativeFreeRoundBrand{}};
    context.F.Zb={get(){return platform;}};
    const original=context.F.$.Zb?.get;
    context.F.$.Zb={get(){return Object.assign({},typeof original==='function'?Reflect.apply(original,null,[]):{}, {U$:{userName:h.ny,om:h.om},dP(){input.record('native-platform-presentation-notification',{});}});}};
   },
   installRoot(args){need(engineBound&&!closed,'NATIVE_MODEL_BEFORE_ORIGINAL_ROOT');const root=binding.installOriginalRoot({...input,...args});need(root&&typeof root.advance==='function'&&typeof root.readErrors==='function'&&typeof root.isOriginalProtocolIdle==='function','ACTUAL_SOURCE_ROOT_REQUIRED');return root;},
   close(){if(closed)return;closed=true;binding.closeContext?.(context);}
  });
 };
}
function requireRegisteredOwn32777NativeHostFactory(){need(registered,'ORIGINAL_NATIVE_ROOT_NOT_REGISTERED');return createRegisteredOwn32777NativeHost;}
function createRegisteredOwn32777NativeHost(input){need(registered,'ORIGINAL_NATIVE_ROOT_NOT_REGISTERED');return createOwn32777NativeHostFactory(registered)(input);}
function hasRegisteredOwn32777NativeSource(){return !!registered;}
module.exports=Object.freeze({hasRegisteredOwn32777NativeSource,registerOwn32777NativeSource,createOwn32777NativeHostFactory,createRegisteredOwn32777NativeHost,requireRegisteredOwn32777NativeHostFactory});
