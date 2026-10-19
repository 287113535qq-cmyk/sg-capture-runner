'use strict';
const DOM=require('./vendor/own32769-node-dom.cjs'),data=require('./own32754-native-typed-wire-DATA-v4.json');
const {createOwn32754NativeWire}=require('./own32754-native-typed-wire-v4.cjs');
const {createOwn32754OriginalSGConnection:create}=require('./own32754-original-SG-connection.cjs');
exports.createOwn32754OriginalSGConnection=({game,sessionScope,readOriginalState})=>{const need=(ok,m)=>{if(!ok)throw Object.assign(new Error('AG integrity: own Arthur native wire '+m),{own32754DeterministicIntegrityStop:true,retryAllowed:false})};return create({game,sessionScope,readOriginalState,wire:createOwn32754NativeWire({DOM,data,need})});};
