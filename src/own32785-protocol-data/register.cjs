'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const DOM=require('../own32750-native-data/vendor/own32750-dom/own32769-node-dom.cjs');
const data=require('./source-DATA.json');
const sharedSource=fs.readFileSync(path.join(__dirname,'../vendor/own-fudaole/gls-comms/gls-comms.js'),'utf8');
const {createOwn32785OriginalSGConnection}=require('./own32785-original-SG-connection.cjs');
exports.createOwn32785OriginalSGConnection=d=>createOwn32785OriginalSGConnection({...d,DOM,data,vm,sharedSource});
