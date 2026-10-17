'use strict';
const DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs');
const data=require('./original-SG-connection-DATA-v1.json'),flowData=require('./original-wire-next-end-DATA-v2.json');
const {createOwn32760NextEndDATA:createFlow}=require('./own32760-wire-next-end-private.cjs');
const {createOwn32760OriginalSGProtocolConnection:create}=require('./own32760-original-SG-connection-private.cjs');
exports.createOwn32760OriginalSGConnection=d=>create({...d,DOM,data,flowData,createFlow});
