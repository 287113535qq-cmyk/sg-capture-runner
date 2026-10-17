"use strict";
const host=require('./own32777-native-host-v11.cjs');
const {createOwn32777V18Binding}=require('./own32777-explicit-source-assembly-v18.cjs');
const data=require('./runtime-source-DATA.json');
function ensureOwn32777Registered(paidLifecyclePolicy){
 if(host.hasRegisteredOwn32777NativeSource())return;
 const assembly=createOwn32777V18Binding({paidLifecyclePolicy,readArtifact:name=>{const text=data.artifacts[name];if(typeof text!=='string')throw Error('Own32777 undeclared native source DATA '+name);return text},parents:data.parents,xmlJS:require('./vendor/node_modules/xml-js'),serializeXML:doc=>doc.toString(),documentLifecycleFactory:c=>({contract:'own32777-explicit-document-lifecycle-IO-v16',ready:new c.F.Sb(false)}),inputPolicy:{contract:'own32777-explicit-native-legal-input-policy-v17',gameId:'32777',cards:Array.from({length:12},(_,i)=>i),closeHoldTicks:40}});
 assembly.registerWithHost(host);
 return assembly.rootRegistration.maxPaidRounds;
}
module.exports=Object.freeze({ensureOwn32777Registered});
