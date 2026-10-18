'use strict';
const vm=require('node:vm'),DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs');
const data=require('./original-SG-connection-DATA-v1.json'),flowData=require('./source-control-DATA.json'),requestData=require('./source-request-DATA.json');
const {createOwn32815WireNextEndDATA}=require('./own32815-wire-next-end-DATA.cjs');
const {createOwn32815OriginalSGProtocolConnection}=require('./own32815-original-SG-connection.cjs');
exports.createOwn32815OriginalSGConnection=d=>createOwn32815OriginalSGProtocolConnection({...d,DOM,data,flowData,requestData,createFlow:()=>createOwn32815WireNextEndDATA({DOM,vm,data:flowData})});
