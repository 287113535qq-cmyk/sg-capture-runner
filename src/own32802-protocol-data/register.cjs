'use strict';
const DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs'),vm=require('node:vm'),data=require('./selected-original-SG-connection-DATA-v1.json');
const {createOwn32802SelectedProtocol:createProtocol}=require('./own32802-selected-protocol-DATA.cjs');
const {createOwn32802OriginalSGConnection:create}=require('./own32802-original-SG-protocol-connection.cjs');
exports.createOwn32802OriginalSGConnection=d=>create({...d,DOM,vm,data,createProtocol});
