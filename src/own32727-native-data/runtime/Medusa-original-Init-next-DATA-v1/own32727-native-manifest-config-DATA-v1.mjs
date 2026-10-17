// Own release inputs and own native loader only. No wrapper response or source request is made.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const data=JSON.parse(readFileSync(new URL('../Medusa-own-native-config-components-DATA-v2/own32727-native-config-components-private.json',import.meta.url),'utf8'));
const inputsBase=new URL('../Medusa-own-native-manifest-inputs-v1/',import.meta.url);
const inputs=JSON.parse(readFileSync(new URL('result.json',inputsBase),'utf8'));
assert(data.gameId==='32727'&&inputs.gameId==='32727'&&inputs.allOwnBodiesPresent&&inputs.manifestInputSHA256===data.manifestInputSHA256);
export function own32727OriginalAGManifestConfigContract(){return Object.freeze({kind:'own-release-manifest-protocol-DATA-v1',gameId:'32727',language:data.originalGdmLanguage,ownSDKFileSHA256:data.retainedSDKSourceSHA256,manifestSHA256:data.manifestInputSHA256});}
export function createOwn32727NativeManifestConfigFromOriginalAGDATA({originalSessionScope,originalFactoryInitSource}){
 assert(originalSessionScope&&typeof originalFactoryInitSource?.read==='function'&&typeof originalFactoryInitSource.has==='function','Actual original Init source required');
 const frame=originalFactoryInitSource.read(originalSessionScope);
 assert(originalFactoryInitSource.has(frame)&&frame.sessionScope===originalSessionScope,'Actual original Init scope revoked');
 const game=frame.game,contract=game?.sg?.ownNativeManifestConfig;
 assert(game?.gameId==='32727'&&game.sg.ownGDMContract?.ownSDKFileSHA256===data.retainedSDKSourceSHA256,'Own Medusa game/SDK scope changed');
 assert(contract?.kind==='own-release-manifest-protocol-DATA-v1'&&contract.gameId==='32727'&&contract.language===data.originalGdmLanguage&&contract.ownSDKFileSHA256===data.retainedSDKSourceSHA256&&contract.manifestSHA256===data.manifestInputSHA256,'Own Medusa manifest DATA contract required');
 assert(frame.requestBody.includes('<lang>'+contract.language+'</lang>'),'Actual original GDM language changed');
 assert(!Object.hasOwn(contract,'actualWrapperExternalConfigValue'),'AG manifest DATA is not a wrapper response');
 const bodies=inputs.inputs.map((row,index)=>{assert(row.manifestIndex===index&&row.relative===data.manifest.config[index],'Own Medusa manifest order changed');return readFileSync(new URL(row.inputFile,inputsBase),'utf8');});
 const warnings=[],context=createContext({console:{warn:message=>warnings.push(String(message))}});
 runInContext(data.lexicalSource+';var r={},$=r,NOVA={},defaultConfig={};',context);
 for(const row of data.rows)context[row.name]=runInContext('('+row.source+')',context,{timeout:1000});
 runInContext('r.type=jqueryType;r.isFunction=jqueryIsFunction;r.isArray=Array.isArray;r.isPlainObject=jqueryIsPlainObject;r.extend=jqueryExtend;r.extendext=jqueryExtendExt;r.parseJSON=JSON.parse;',context);
 // The native jQuery class-to-type initializer executes in this same realm.
 runInContext(data.typeNamesSource+'.forEach(function(value,index){('+data.typeCallbackSource+')(index,value)});',context,{timeout:1000});
 assert(data.configInitializer.source==='this.config={}');runInContext('(function(){'+data.configInitializer.source+';}).call(NOVA);',context);
 let fetches=0,completed=0;
 context.self={manifest:data.manifest,fetchConfigs(id,callback){assert(id==='config'&&fetches++===0,'Own one native config load required');Reflect.apply(callback,undefined,[bodies,data.manifest.config.findIndex(name=>name.includes('language'))]);}};
 Reflect.apply(context.loadConfig,context.self,['config',()=>completed++]);
 assert(completed===1&&fetches===1&&warnings.length===0,'Own Medusa native config loader did not fully parse inputs');
 assert(originalFactoryInitSource.has(frame),'Original Init scope revoked during native merge');
 return Object.freeze({gameId:'32727',sessionScope:originalSessionScope,originalInitFrame:frame,originalAGManifestContract:contract,config:context.NOVA.config,manifestInputCount:bodies.length,ownConfigInputRecords:inputs.inputs,nativeLoaderFragmentSHA256:data.rows.find(r=>r.name==='loadConfig').fragmentSHA256,sourceRequests:0,providerACKClaimed:false,productionAdmission:false,actualProviderACKStillUnproved:true});
}
