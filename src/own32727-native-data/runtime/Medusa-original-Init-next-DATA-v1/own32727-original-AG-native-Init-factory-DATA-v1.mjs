// Own Medusa DATA attaches to the existing original SG Init frame. BET remains held.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createOwn32727NativeManifestConfigFromOriginalAGDATA} from './own32727-native-manifest-config-DATA-v1.mjs';
import {initializeOwn32727NativeAccountWithNativeFreeRounds} from './own32727-native-Init-account-with-native-FreeRounds-v4-private.mjs';
const data=JSON.parse(readFileSync(new URL('../Medusa-own-native-config-components-DATA-v2/own32727-native-config-components-private.json',import.meta.url),'utf8'));
export function bindOwn32727OriginalAGNativeInitDATA({sgSessionExports}){
 assert(typeof sgSessionExports?.bindOwnClassicGdmInitDataFactory==='function'&&typeof sgSessionExports.readOwnClassicGdmInitData==='function','Same original SG module exports required');
 return sgSessionExports.bindOwnClassicGdmInitDataFactory('32727',(session,source)=>{
  const frame=source.read(session);assert(source.has(frame)&&frame.sessionScope===session,'Actual original Medusa Init frame required');
  const configRecord=createOwn32727NativeManifestConfigFromOriginalAGDATA({originalSessionScope:session,originalFactoryInitSource:source});
  assert(configRecord.originalInitFrame===frame,'Own Medusa config changed its original source');
  const observations=[],metrics=Object.freeze({setFROptions:value=>observations.push({event:'setFROptions',value}),setCurrencyCode:value=>observations.push({event:'setCurrencyCode',value}),takeBet:value=>observations.push({event:'takeBet',value}),addWin:value=>observations.push({event:'addWin',value})});
  const context=createContext({METRICS:metrics,NOVA:{config:configRecord.config,languageCode:data.originalGdmLanguage}});
  runInContext('var '+data.trimRegexBindingSource+';',context);
  context.$={trim:runInContext('('+data.trim.source+')',context,{timeout:1000})};
  const Currency=runInContext('('+data.currency.source+')',context,{timeout:1000}),currency=Reflect.construct(Currency,[]);
  const native=initializeOwn32727NativeAccountWithNativeFreeRounds({originalSessionScope:session,nativeInitPayload:frame.step.responsePayload,actualNativeConfig:configRecord.config,actualCurrency:currency,actualMetrics:metrics});
  if(frame.game.sg.requestParams?.BPR!==undefined)native.selectOriginalCapturePerReel(frame.game.sg.requestParams.BPR);
  assert(native.account.getBalance()===Number(frame.decoded.AB),'Native and original Medusa account changed');
  assert(native.account.getTotalBetAmount()===frame.game.sg.betRaw,'Original AG selected Medusa wager does not match native account');
  const current=()=>{assert(source.has(frame)&&source.read(session)===frame,'Original Medusa Init scope revoked');return native;};
  return Object.freeze({kind:'own32727-original-AG-native-Init-model-DATA-only',gameId:'32727',originalSessionScope:session,originalFactoryInitFrame:frame,nativeInitAccount:native,nativeFreeRounds:native.nativeFreeRounds,nativeCurrency:currency,nativeConfigRecord:configRecord,nativeMetrics:metrics,nativeMetricObservations:observations,assertCurrent(){current();},snapshot(){return current().snapshot();},originalTransportEnvelopeAndRawWireOwnedBySGModule:true,browserWrapperResponseFabricated:false,nativeNextEndGraphReady:false,sourceRequests:0,providerACKClaimed:false,productionAdmission:false,independentFinalCredit:0});
 });
}
