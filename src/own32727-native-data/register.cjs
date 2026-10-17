"use strict";
// SG connection registration only. Original AG owns transport, capture and Mongo.
const assert=require('node:assert/strict');
const {bindOwn32727OriginalAGNativeInitDATA}=require('./runtime/Medusa-original-Init-next-DATA-v1/own32727-original-AG-native-Init-factory-DATA-v1.mjs');
const {bindOwn32727PrivateNativePaidGameplayDATA22}=require('./runtime/Medusa-original-Init-next-DATA-v1/own32727-private-native-paid-gameplay-driver-DATA-v22.mjs');
module.exports.registerOwn32727NativeDATA=function(sg){
 assert(typeof sg.bindOwnClassicGdmInitDataFactory==='function'&&typeof sg.bindOwnClassicGdmGameplayDataFactory==='function');
 bindOwn32727OriginalAGNativeInitDATA({sgSessionExports:sg});
 bindOwn32727PrivateNativePaidGameplayDATA22({sgSessionExports:sg});
};
