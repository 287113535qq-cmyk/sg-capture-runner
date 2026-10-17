'use strict';
const DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs');
const data=require('./original-SG-connection-DATA-v1.json'),terminalData=require('./original-terminal-protocol-DATA-v3.json');
const {createOwn32763TerminalProtocolLeaf:createTerminalLeaf}=require('./own32763-terminal-protocol-private.cjs');
const {createOwn32763OriginalSGProtocolConnection:create}=require('./own32763-original-SG-protocol-connection-private.cjs');
exports.createOwn32763OriginalSGConnection=d=>create({...d,DOM,data,terminalData,createTerminalLeaf});