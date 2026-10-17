'use strict';
const sg=require('./sg.session');
const init=require('./own32536-native-data/runtime/own32536-original-AG-native-Init-factory-DATA-private.cjs');
const driver=require('./own32536-native-data/runtime/own32536-private-native-free-gameplay-driver-DATA-v9.cjs');
init.bindOwn32536OriginalAGNativeInitDATA({sgSessionExports:sg});
driver.bindOwn32536PrivateNativeFreeGameplayDATA({sgSessionExports:sg});
