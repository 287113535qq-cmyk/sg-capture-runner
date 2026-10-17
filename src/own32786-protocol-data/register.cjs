'use strict';
const vm=require('node:vm'),DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs');
const data=require('./original-SG-connection-DATA-v1.json'),flowData=require('./own32786-wire-model-DATA-v1298.json');
const {createOwn32786WireNextEndDATA}=require('./own32786-wire-next-end-DATA.cjs');
const {createOwn32786OriginalSGProtocolConnection}=require('./own32786-original-SG-connection-private.cjs');
exports.createOwn32786OriginalSGConnection=d=>createOwn32786OriginalSGProtocolConnection({...d,DOM,data,flowData,createFlow:()=>createOwn32786WireNextEndDATA({DOM,vm,data:flowData})});
