'use strict';
const vm=require('node:vm'),DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs');
const data=require('./original-SG-connection-DATA-v1.json'),flowData=require('./source-control-DATA.json'),requestData=require('./source-request-DATA.json');
const {createOwn32757WireNextEndDATA}=require('./own32757-wire-next-end-DATA.cjs');
const {createOwn32757OriginalSGProtocolConnection}=require('./own32757-original-SG-connection.cjs');
exports.createOwn32757OriginalSGConnection=d=>createOwn32757OriginalSGProtocolConnection({...d,DOM,data,flowData,requestData,createFlow:()=>createOwn32757WireNextEndDATA({DOM,vm,data:flowData})});
