'use strict';
const DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs'),vm=require('node:vm'),data=require('./selected-original-SG-connection-DATA-v1.json');
const {createOwn32796SelectedProtocol:createProtocol}=require('./own32796-selected-protocol-DATA.cjs');
const {createOwn32796OriginalSGConnection:create}=require('./own32796-original-SG-protocol-connection.cjs');
exports.createOwn32796OriginalSGConnection=d=>create({...d,DOM,vm,data,createProtocol});
