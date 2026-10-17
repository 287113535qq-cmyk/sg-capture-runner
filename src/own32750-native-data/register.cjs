'use strict';
// Private FIRST32750 DATA registration. SG session retains ownerHooks; no network/client/DB here.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function validateOwn32750Runtime(game){
 assert(game?.gameId==='32750'&&game.dbName==='sg_eightyeightfortunes'&&game.sg?.runtimeGameId===32972&&game.sg.protocol==='wms'&&game.sg.endpoint==='https://gls.atc.casinarena.com/gls.rgsx','Own32750 exact original game');
 assert(String(game.sg.header?.gameID)==='20077'&&game.sg.header.gameCodeRGI==='eightyeightfortunes'&&game.sg.header.versionID==='1_0','Own32750 exact native header');
 const data=game.sg.own32750NativeData;assert(data?.contract==='own32750-original-AG-native-next-end-DATA-v16'&&data.hostContract==='own32750-active-timers-dirty-canvas-v12'&&data.group==='FIRST'&&data.originalOwner==='first20','Own32750 explicit private DATA contract');
 require('./own32750-relative-installation-paths-v14.cjs').validateOwn32750RelativeInstallation(data.installation);
 assert(typeof data.resourcePrefix==='string'&&data.resourcePrefix==='https://d10ml311dd14ci.cloudfront.net/5.0.4.1-1787670669/resource-service/content/eightyeightfortunes/resources/','Own32750 actual own resource prefix');
 return data;
}
function createOwn32750SessionBundle({sessionScope,game,sessionData,readRawEnvelope,assertOriginalSessionOpen,localIOTimeoutMs}){
 const data=validateOwn32750Runtime(game);assert(sessionScope&&typeof sessionScope==='object'&&typeof readRawEnvelope==='function'&&typeof assertOriginalSessionOpen==='function','Own32750 private SG callbacks');
 for(const key of ['getSessionID','getContextID','getPlayerID'])assert(typeof sessionData?.[key]==='function'&&typeof sessionData[key]()==='string'&&sessionData[key]().length>0,'Own32750 actual current '+key);
 assert(Number.isSafeInteger(localIOTimeoutMs)&&localIOTimeoutMs>=1000&&localIOTimeoutMs<=120000,'Own32750 existing SG request-timeout binding');
 const p=require('./own32750-relative-installation-paths-v14.cjs').resolveOwn32750Installation(data.installation,__dirname);
 assert(JSON.parse(fs.readFileSync(p.canvasPackageJSON,'utf8')).version==='0.1.100','Own32750 certified Canvas version only; alternate backend requires own affected admission');
 const {createOwn32750OriginalSGSource,createOwn32750OriginalSGUnitReader}=require('./own32750-original-SG-private-source-v11.cjs');
 const pair=createOwn32750OriginalSGSource({sessionScope,game,readRawEnvelope});
 try{
  const DOM=require('./own32750-private-dom-adoption-proposal.cjs').loadOwn32750DOMPort(p.domPortModule),Canvas=require(p.canvasModule),sax=require(p.saxModule);
  const {createOwn32750Native}=require('./own32750-native-amd-v3.cjs'),audio=require('./own32750-unavailable-audio-abi-v3.cjs').createUnavailableAudioABI();
  const assetPath=url=>{assert(typeof url==='string'&&url.startsWith(data.resourcePrefix),'Own32750 exact static resource URL');const u=new URL(url),file=path.resolve(p.staticRoot,u.hostname,decodeURIComponent(u.pathname).replace(/^\//,'')),root=path.resolve(p.staticRoot);assert(file.startsWith(root+path.sep),'Own32750 static path escape');return file};
  const host=require('./own32750-current-session-Main-host-v12.cjs').createOwn32750MainCanvasHost({DOM,Canvas,sax,root:p.nativeRoot,createNative:o=>createOwn32750Native({...o,Audio:audio.Audio}),readSource:file=>fs.readFileSync(file,'utf8'),metadataSource:fs.readFileSync(p.metadataPath,'utf8'),sessionData,resourcePrefix:data.resourcePrefix,assetPath,readAsset:url=>fs.readFileSync(assetPath(url))});
  const project=require('./own32750-original-SG-money-projection-v9.cjs').createOwn32750OriginalSGMoneyProjection({source:pair.source,readOwnOriginalUnit:createOwn32750OriginalSGUnitReader(pair.source)});
  const connection=require('./own32750-original-AG-native-DATA-connection-v11.cjs').createOwn32750OriginalAGNativeDataConnection({group:data.group,originalOwner:data.originalOwner,host,sessionScope,game,source:pair.source,localIOTimeoutMs,assertOriginalSessionOpen,projectOriginalSGMoneyAndReplay:project,DOM,vm,originalGameWrapperSource:fs.readFileSync(p.wrapperPath,'utf8')});
  pair.ownerHooks.attachConnection(connection);return Object.freeze({source:pair.source,ownerHooks:pair.ownerHooks,connection,host});
 }catch(error){pair.ownerHooks.seal(error);throw error}
}
module.exports={validateOwn32750Runtime,createOwn32750SessionBundle};
