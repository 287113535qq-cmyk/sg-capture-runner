'use strict';
const vm=require('node:vm'),DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs');
const data=require('./original-SG-connection-DATA-v1.json'),flowData=require('./own32814-original-protocol-next-end-DATA-v1338.json');
const {createOwn32814WireNextEndDATA}=require('./own32814-wire-next-end-DATA.cjs');
const {createOwn32814OriginalSGProtocolConnection}=require('./own32814-original-SG-connection-private.cjs');
exports.createOwn32814OriginalSGConnection=d=>createOwn32814OriginalSGProtocolConnection({...d,DOM,data,flowData,createFlow:()=>createOwn32814WireNextEndDATA({DOM,vm,data:flowData})});
