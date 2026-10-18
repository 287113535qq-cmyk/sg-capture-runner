'use strict';
const vm=require('node:vm'),DOM=require('../own32769-node-dom.cjs');
const platformData=require('./own32803-fresh-BQ-normal-platform-entry-DATA-v1.json'),wireData=require('./own32803-source-native-normal-wire-close-DATA-v3.json'),callerData=require('./own32803-source-derived-typed-state-close-path-DATA-v2.json'),entryData=require('./source-entry-context-DATA.json');
const createPlatform=require('./own32803-fresh-BQ-normal-platform-entry-v2.cjs').createOwn32803FreshBQNormalEntryDATA,createWire=require('./own32803-source-native-feature-wire-v9.cjs').createOwn32803SourceNativeNormalWireDATA,createCaller=require('./own32803-typed-state-normal-close-path-v2.cjs').createOwn32803TypedStateClosePathDATA,edFactory=require('./own32803-Ed-projection-DATA.cjs').createOwn32803EdProjectionDATA;
const featureData=require('./own32803-Free-Choice-source-request-chain-DATA-v1.json'),createFeature=require('./own32803-Free-Choice-source-chain-v4.cjs').createOwn32803FreeChoiceRequestChainDATA;
const makeFreeAwareEd=require('./own32803-source-scoped-Free-current-Ed-DATA.cjs').createOwn32803FreeAwareEdFactoryDATA;
const create=require('./own32803-original-SG-source-connection.cjs').createOwn32803OriginalSGSourceConnection;
exports.create=d=>create({...d,vm,DOM,platformData,wireData,callerData,featureData,entryData,createPlatform,createWire,createCaller,createFeature,makeFreeAwareEd,edFactory});
