'use strict';
// Own SECOND32806 package DATA only. Original SG retains every live request, response, SID and paid capability.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const scopes=new WeakMap(),packages=new Map(),fontBindings=new WeakMap();
const prefix='https://d10ml311dd14ci.cloudfront.net/5.0.4.1-1787670669/resource-service/content/spartacus_prt/';
const version='5.0.4.1-1787670669',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pathsModule=require('./own32806-relative-installation-paths-v1.cjs');
function validateOwn32806Runtime(game){
 assert(game?.provider==='sg'&&game.gameId==='32806'&&game.dbName==='sg_spartacus_prt'&&game.sg?.runtimeGameId===33166&&
  game.sg.protocol==='wms'&&game.sg.endpoint==='https://gls.atc.casinarena.com/gls.rgsx','Own32806 exact original game');
 assert(game.sg.header?.gameID==='20128'&&game.sg.header.gameCodeRGI==='spartacus_prt'&&game.sg.header.versionID==='1_0'&&game.sg.betRaw===50,'Own32806 exact original protocol identity');
 assert(game.sg.own32806OriginalWire?.contract==='own32806-original-wire-native-v1'&&!game.sg.ownMatchedPaidContract,'Own32806 explicit native wire; no legacy paid-response whitelist');
 const d=game.sg.own32806NativeData;
 assert(d?.contract==='own32806-original-AG-native-next-end-DATA-v1'&&d.hostContract==='own32806-exported-native-host-config-v5'&&
  d.group==='SECOND'&&d.originalOwner==='second20'&&d.resourcePrefix===prefix&&d.resourceVersion===version,'Own32806 explicit original ownership and host DATA');
 assert(d.limits?.timeoutMs===30000&&d.limits.maxTicks===10000&&d.rootPaintOptimization===false,'Own32806 original finite budgets and paint default OFF');
 assert(d.menu?.paylineCount===20&&d.menu.totalStake===game.sg.betRaw&&d.viewport?.width===960&&d.viewport.height===540,'Own32806 own menu and viewport DATA');
 assert(d.font?.family==='Arial'&&d.font.originalDeclaredFamily==='Arial'&&d.font.SHA256==='b3658eadae55e682b5f69eb64c439c1ecc8f196c0bb8d4756d145d13bc86476a','Own32806 original real font only');
 assert(/^[a-f0-9]{64}$/.test(d.audioInputsSHA256)&&/^[a-f0-9]{64}$/.test(d.staticReceiptsSHA256),'Own32806 explicit retained DATA index byte bindings');
 pathsModule.validateOwn32806RelativeInstallation(d.installation);return d;
}
function inside(root,target){const rel=path.relative(root,target);return rel===''||(rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel));}
function readBoundJSON(file,expected){const bytes=fs.readFileSync(file);assert.equal(sha(bytes),expected,'Own32806 installed DATA index changed');return JSON.parse(bytes.toString('utf8'));}
function loadPackage(p,data){
 const key=JSON.stringify({installation:p,audioInputsSHA256:data.audioInputsSHA256,staticReceiptsSHA256:data.staticReceiptsSHA256});
 if(packages.has(key))return packages.get(key);
 assert(JSON.parse(fs.readFileSync(p.canvasPackageJSON,'utf8')).version==='0.1.100','Own32806 qualified Canvas version');
 const ogg=JSON.parse(fs.readFileSync(p.oggDecoderPackageJSON,'utf8'));
 assert(ogg.name==='@wasm-audio-decoders/ogg-vorbis'&&ogg.version==='0.1.20','Own32806 qualified actual codec version');
 const DOM=require(p.domPortModule),Canvas=require(p.canvasModule),font=require(p.fontBinderModule);
 assert(typeof DOM.DOMParser==='function'&&typeof Canvas.createCanvas==='function'&&typeof font.bindDeclaredOriginalArial==='function','Own32806 actual installed host services');
 const inputs=readBoundJSON(p.audioInputsIndex,data.audioInputsSHA256),rawReceipts=readBoundJSON(p.staticReceiptsIndex,data.staticReceiptsSHA256);
 assert(inputs.schema==='own32806-retained-real-audio-inputs-DATA-v1'&&inputs.gameId==='32806'&&inputs.version===version&&inputs.inputs.length===61,'Own32806 retained61 actual own inputs');
 assert(rawReceipts.schema==='own32806-retained-static-complete-response-DATA-v1'&&rawReceipts.gameId==='32806'&&rawReceipts.version===version&&rawReceipts.staticOnly===true&&rawReceipts.inputs.length===7,'Own32806 retained7 actual static responses');
 const byURL=new Map(),bySHA=new Map(),receipts=[];
 for(const row of inputs.inputs){
  assert(row.url.startsWith(prefix)&&/^[a-f0-9]{64}$/.test(row.inputSHA256)&&!byURL.has(row.url),'Own32806 exact unique own audio URL');
  assert(Number.isSafeInteger(row.samplesDecoded)&&row.samplesDecoded>0&&Number.isSafeInteger(row.sampleRate)&&row.sampleRate>0&&
   Number.isSafeInteger(row.channels)&&row.channels>0&&Array.isArray(row.pcmSHA256ByChannel)&&row.pcmSHA256ByChannel.length===row.channels&&
   row.pcmSHA256ByChannel.every(x=>/^[a-f0-9]{64}$/.test(x)),'Own32806 retained real PCM certificate metadata');
  const cert=Object.freeze({...row,pcmSHA256ByChannel:Object.freeze(row.pcmSHA256ByChannel.slice()),realPCMInput:true});
  byURL.set(row.url,cert);if(bySHA.has(row.inputSHA256))assert.deepEqual(bySHA.get(row.inputSHA256),cert,'Own32806 duplicate hash with different metadata');else bySHA.set(row.inputSHA256,cert);
 }
 for(const row of rawReceipts.inputs){
  assert(row.url.startsWith(prefix)&&!byURL.has(row.url)&&row.httpStatus===403&&row.completeHTTPResponse===true&&row.actualAttempts===1&&Array.isArray(row.responseHeaders)&&/^[a-f0-9]{64}$/.test(row.bodySHA256),'Own32806 actual closed static403 response only');
  const rel=row.bodyRelativePath;assert(typeof rel==='string'&&rel&&!rel.includes('\0')&&!rel.includes('\\')&&!rel.includes(':')&&!path.isAbsolute(rel)&&!rel.split('/').includes('..'),'Own32806 relative static response body');
  const base=path.dirname(p.staticReceiptsIndex),lexical=path.resolve(base,rel),actual=fs.realpathSync(lexical);
  assert(inside(base,lexical)&&inside(fs.realpathSync(base),actual)&&fs.statSync(actual).isFile(),'Own32806 static response body escaped installation');
  const bytes=fs.readFileSync(actual);assert.equal(sha(bytes),row.bodySHA256,'Own32806 actual static response body changed');
  const cert=Object.freeze({url:row.url,inputSHA256:row.bodySHA256,realPCMInput:false,httpStatus:row.httpStatus});
  byURL.set(row.url,cert);if(!bySHA.has(row.bodySHA256))bySHA.set(row.bodySHA256,cert);
  receipts.push(Object.freeze({...row,bytes,responseHeaders:Object.freeze(row.responseHeaders.map(x=>Object.freeze(x.slice())))}));
 }
 let codecPromise;
 const pcm=require('./own32806-qualified-PCM-cache-v1.cjs').createOwn32806QualifiedPCMCache({certificates:bySHA,
  loadDecoder:()=>codecPromise||(codecPromise=import(pathToFileURL(p.oggDecoderModule).href))});
 const sources=new Map();
 const readSource=file=>{const actual=fs.realpathSync(file);assert(inside(p.nativeRoot,actual),'Own32806 SDK source outside own root');if(!sources.has(actual))sources.set(actual,fs.readFileSync(actual,'utf8'));return sources.get(actual);};
 assert(path.relative(p.nativeRoot,p.requireJSPath)==='lib'+path.sep+'require'+path.sep+'require.js'&&
  path.relative(p.nativeRoot,p.metadataPath)==='resources'+path.sep+'js'+path.sep+'spartacus_prt.metadatabundle.js'&&
  path.relative(p.nativeRoot,p.wrapperPath)==='resources'+path.sep+'js'+path.sep+'spartacus_prt.game.js','Own32806 exact original entry files');
 const entry=Object.freeze({requireJS:readSource(p.requireJSPath),metadata:readSource(p.metadataPath),wrapper:readSource(p.wrapperPath)});
 const result=Object.freeze({DOM,Canvas,entry,readSource,pcm,byURL,receipts,font});packages.set(key,result);return result;
}
function createOwn32806SessionBundle({sessionScope,game,sessionData,readRawEnvelope,assertOriginalSessionOpen,localIOTimeoutMs}){
 const data=validateOwn32806Runtime(game);
 assert(sessionScope&&typeof sessionScope==='object'&&!scopes.has(sessionScope),'Own32806 one factory bundle per original SG session');
 assert(typeof readRawEnvelope==='function'&&typeof assertOriginalSessionOpen==='function','Own32806 original SG private callbacks');
 assert(Number.isSafeInteger(localIOTimeoutMs)&&localIOTimeoutMs>=1000&&localIOTimeoutMs<=120000,'Own32806 original SG request timeout');
 for(const k of ['getSessionID','getContextID','getPlayerID'])assert(typeof sessionData?.[k]==='function','Own32806 dynamic original session getter '+k);
 const scopeState={sealed:false,host:null,binding:null,hostHandedOut:false};scopes.set(sessionScope,scopeState);
 function open(stage){assert(!scopeState.sealed,'Own32806 factory scope sealed');assertOriginalSessionOpen({sessionScope,game,stage});}
 function sessionValue(k){open('native-session-data:'+k);const value=sessionData[k]();assert(typeof value==='string'&&value.length>0,'Own32806 actual current session/header '+k);return value;}
 try{
  const p=pathsModule.resolveOwn32806Installation(data.installation,__dirname),pkg=loadPackage(p,data);
  const bindFont=({Canvas,profile})=>{
   assert(Canvas===pkg.Canvas&&profile.file===p.fontFile&&profile.SHA256===data.font.SHA256,'Own32806 declared current font binding');
   let fonts=fontBindings.get(Canvas);if(!fonts){fonts=new Map();fontBindings.set(Canvas,fonts);}
   const key=profile.file+':'+profile.SHA256;if(!fonts.has(key))fonts.set(key,pkg.font.bindDeclaredOriginalArial({Canvas,profile}));return fonts.get(key);
  };
  const currentSessionData=Object.freeze({getSessionID:()=>sessionValue('getSessionID'),getContextID:()=>sessionValue('getContextID'),getPlayerID:()=>sessionValue('getPlayerID')});
  for(const k of ['getSessionID','getContextID','getPlayerID'])currentSessionData[k]();
  const actualResourceReceipts=new Map(pkg.receipts.map(row=>[row.url,{url:row.url,httpStatus:row.httpStatus,responseHeaders:row.responseHeaders.map(x=>x.slice()),bodySHA256:row.bodySHA256,bytes:Buffer.from(row.bytes),used:false}]));
  const producer=require('./own32806-native-producer-v5.cjs'),audio=require('./own32806-native-audio-port-v5.cjs'),menus=require('./own32806-native-menu-selection-v5.cjs');
  const host=producer.createOwn32806NativeProducer({vm,fs,path,Canvas:pkg.Canvas,DOM:pkg.DOM,sourceRoot:p.nativeRoot,
   viewport:{...data.viewport},epoch:Date.now(),sessionData:currentSessionData,entry:pkg.entry,readSource:pkg.readSource,
   bindDeclaredOriginalArial:bindFont,originalDeclaredFontProfile:{...data.font,file:p.fontFile},actualResourceReceipts,
   ownResourceCacheBinding:{gameId:'32806',version,urlPrefix:prefix,cacheRoot:p.cacheRoot},
   createOwn32806DecodedAudioPort:audio.createOwn32806DecodedAudioPort,
   getOwnQualifiedAudioInput:url=>{const cert=pkg.byURL.get(url);assert(cert,'Own32806 audio outside certified own input set');return Object.freeze({gameId:'32806',version,exactOwnURL:url,inputSHA256:cert.inputSHA256});},
   decodeCompleteOwnVorbis:pkg.pcm.decodeCompleteOwnVorbis,actualWallNow:()=>Date.now()});
  scopeState.host=host;
  return Object.freeze({sourceIsOfflineTest:false,timeoutMs:30000,maxTicks:10000,
   createHost(){open('create-host');assert(!scopeState.hostHandedOut,'Own32806 host already handed to original SG');scopeState.hostHandedOut=true;return host;},
   createBinding(privateInputs){
    try{open('create-binding');assert(!scopeState.binding&&privateInputs?.sessionScope===sessionScope&&privateInputs.game===game,'Own32806 one exact private original SG binding');
    const binding=require('./own32806-original-SG-private-slot-binding-v5.cjs');
    scopeState.binding=binding.createOwn32806OriginalSGNativeBinding({...privateInputs,DOM:pkg.DOM,readNativeHostState:()=>host,
     createNativeSessionView:require('./own32806-native-current-session-view-v944.cjs').createOwn32806NativeSessionView,
     createCurrentNativeRequestPortV2:require('./own32806-current-native-request-port-v2.cjs').createOwn32806CurrentNativeRequestPort,
     createOriginalResponseSourceV2:require('./own32806-original-SG-response-source-v2.cjs').createOwn32806OriginalResponseSource});
    return scopeState.binding;
    }catch(error){scopeState.sealed=true;host.disposed=true;host.timers.clear();throw error;}
   },
   selectOwnNativeMenu(h){open('native-menu');assert(h===host&&scopeState.binding,'Own32806 own bound host only');return menus.selectOwn32806AllowedNativeMenu(host,{paylineCount:data.menu.paylineCount,totalStake:game.sg.betRaw});},
   async yieldNative(h){open('native-yield');assert(h===host,'Own32806 exact host continuation');if(host.audioPort.jobs.size)await host.audioPort.whenCurrentJobsSettled();await new Promise(setImmediate);open('native-yield-return');}
  });
 }catch(error){scopeState.sealed=true;if(scopeState.host){scopeState.host.disposed=true;scopeState.host.timers.clear();}throw error;}
}
module.exports={validateOwn32806Runtime,createOwn32806SessionBundle};
