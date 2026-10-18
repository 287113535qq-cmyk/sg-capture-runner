'use strict';
const DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs'),vm=require('node:vm'),data=require('./selected-original-SG-connection-DATA-v1.json');
const {createOwn32804SelectedProtocol:createProtocol}=require('./own32804-selected-protocol-DATA.cjs');
const {createOwn32804OriginalSGConnection:create}=require('./own32804-original-SG-protocol-connection.cjs');
exports.createOwn32804OriginalSGConnection=d=>create({...d,DOM,vm,data,createProtocol});
