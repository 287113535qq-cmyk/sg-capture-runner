'use strict';
const DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs'),vm=require('node:vm'),data=require('./own32809-original-SG-protocol-DATA.json');
const {createOwn32809OriginalSGConnection:create}=require('./own32809-original-SG-connection.cjs');
exports.createOwn32809OriginalSGConnection=d=>create({...d,DOM,vm,data});
