"use strict";
const vm=require('node:vm');
// Explicit local artifact reader only. No disk writes, source requests, DB or host registration on import.
function createOwn32777V18Binding({readArtifact,parents,xmlJS,serializeXML,documentLifecycleFactory,inputPolicy,paidLifecyclePolicy}){
 function need(ok,reason){if(!ok)throw Object.assign(new Error('AG integrity: own32777 V18 assembly '+reason),{code:'OWN32777_V18_ASSEMBLY_HOLD',reason})}
 need(typeof readArtifact==='function'&&parents&&typeof serializeXML==='function'&&typeof documentLifecycleFactory==='function','explicit own artifacts/XML/document IO');
 const text=k=>{const value=readArtifact(k);need(typeof value==='string'&&value.length>0,'missing exact artifact '+k);return value};
 const json=k=>JSON.parse(text(k));
 function cjs(k){const module={exports:{}};new vm.Script('(function(require,module,exports){'+text(k)+'\n})',{filename:k}).runInThisContext()(require,module,module.exports);return module.exports}
 for(const version of ['v5','v6','v7','v8','v9','v10'])need(parents[version]&&typeof parents[version]==='object','cached parent '+version);
 const assembled=cjs('test/own32777-cached-parent-source-assembler-v12.cjs').buildOwn32777FixtureSources(parents);
 const nativeModules=json('test/own32777-real-reels-native-modules-v13.json');
 const platformSources=json('src/own32777-native-data/own32777-original-platform-source-v16.json');
 const platformAPI=cjs('src/own32777-native-data/own32777-original-AG-platform-binding-v16.cjs');
 const sourceFactory=cjs('test/own32777-isolated-cached-source-context-v12.cjs').createOwn32777IsolatedSourceContext;
 const contextFactory=cjs('src/own32777-native-data/own32777-original-protocol-context-v16.cjs').createOwn32777OriginalAGProtocolContextFactory;
 const createNativeContext=contextFactory({createOriginalSourceContext:sourceFactory,bundle:assembled.bundle,xmlJS,platformAPI,platformSources,originalTickerSource:nativeModules.ticker,documentLifecycleFactory});
 const rootConfiguration={paidLifecyclePolicy,parents:assembled.sources,nativeModules,loadOrder:['range','logDecorator','ticker','reelLogicalData','baseSingleReel','reelDrawOrder','baseReels','ownTopReel','ownVerticalReel','ownReels','symbols','array','reelSettings','variableHeight','batAndCollector','batSettings'],drawingPorts:text('test/own32777-real-reels-drawing-frame-ports-v13.js'),viewMethods:json('test/own32777-real-reels-original-view-methods-v13.json'),spriteModules:json('test/own32777-actual-Sheet-Sprite-source-v14.json'),spritePorts:text('test/own32777-actual-Sprite-pixel-ports-v14.js'),batFrameJSON:json('test/own32777-actual-Bat-desktop-v14.json'),batResourceRow:json('test/own32777-actual-Bat-resource-row-v14.json'),idleModules:json('test/own32777-original-idle-modules-v15.json'),nativeMainTable:assembled.bundle.mainTable,prePlayModules:json('src/own32777-native-data/own32777-original-prePlay-source-v18.json')};
 const rootRegistration=cjs('src/own32777-native-data/own32777-source-root-registration-v17.cjs').createOwn32777SourceRootRegistration({createOriginalRoot:cjs('src/own32777-native-data/own32777-original-Init-prePlay-End-root-v18.cjs').createOwn32777RealReelsLockedRoot,parentConfiguration:rootConfiguration,sourceBaseBuild:text('src/own32777-native-data/own32777-source-base-context-v18.js'),sourceNativeBindings:text('src/own32777-native-data/own32777-source-native-bindings-v18.js'),sourceIdleBinderScript:text('src/own32777-native-data/own32777-source-idle-IO-v17.js'),inputPolicy});
 const binding=platformAPI.createOwn32777RequiredSourceBinding({createNativeContext,rootRegistration,originalSettingsExpression:assembled.settingsExpression,serializeXML});
 let registered=false;
 return Object.freeze({binding,rootRegistration,registerWithHost(host){need(!registered&&typeof host?.registerOwn32777NativeSource==='function','one explicit original source host');host.registerOwn32777NativeSource(binding);registered=true;},status(){return {contract:'own32777-v18-one-paid-source-assembly',registered,maxPaidRounds:paidLifecyclePolicy?.maxPaidRoundsAllowed??1,nextPaidSupported:(paidLifecyclePolicy?.maxPaidRoundsAllowed??1)>1,currentACKCertified:false,originalAGReplayAndMongoCertified:false,productionReady:false}}});
}
module.exports=Object.freeze({createOwn32777V18Binding});
