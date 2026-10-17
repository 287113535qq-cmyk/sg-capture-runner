'use strict';
const vm=require('node:vm'),DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs');
const data=require('./original-SG-connection-DATA-v1.json'),flowData=require('./own32761-wire-model-DATA-v1261.json');
const {createOwn32761ExplicitChoiceDATA}=require('./own32761-explicit-choice-DATA.cjs');
const {createOwn32761WireNextEndDATA}=require('./own32761-wire-next-end-DATA.cjs');
const {createOwn32761OriginalSGProtocolConnection}=require('./own32761-original-SG-connection-private.cjs');
exports.createOwn32761OriginalSGConnection=d=>createOwn32761OriginalSGProtocolConnection({...d,DOM,data,flowData,createFlow:()=>{
 const choice=createOwn32761ExplicitChoiceDATA({DOM,choiceDomain:flowData.sourceChoiceDomain,vm,modelDATA:flowData});
 return createOwn32761WireNextEndDATA({DOM,vm,data:flowData,choice});
}});
