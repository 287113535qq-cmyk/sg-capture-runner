'use strict';
const DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs');
const data=require('./original-SG-connection-DATA-v1.json'),terminalData=require('./original-next-end-DATA-v4.json');
const {createOwn32756NextEndDATA:createTerminalLeaf}=require('./own32756-next-end-private.cjs');
const {createOwn32756OriginalSGProtocolConnection:create}=require('./own32756-original-SG-connection-private.cjs');
exports.createOwn32756OriginalSGConnection=d=>create({...d,DOM,data,terminalData,createTerminalLeaf});
