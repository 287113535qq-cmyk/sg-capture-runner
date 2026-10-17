// Own Medusa native Init/Account DATA. The caller must first validate the original
// transport/envelope. This module does not certify transport, mint sessions or send.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const read=name=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const own=read('classic-Medusa-native-Init-DATA-v2/own32727-native-Init-functions-private.json');
const accountDATA={gameId:own.gameId,retainedSDKSourceSHA256:own.retainedSDKSourceSHA256,functions:own.functions.filter(x=>['Account','InitState'].includes(x.name))};
const parserDATA={gameId:own.gameId,retainedSDKSourceSHA256:own.retainedSDKSourceSHA256,parser:own.functions.find(x=>x.name==='parseGameMessage'),accountSetup:own.accountSetup};
const dependencies={gameId:own.gameId,retainedSDKSourceSHA256:own.retainedSDKSourceSHA256,functions:own.functions.filter(x=>x.name==='dateFix')};
assert(own.gameId==='32727'&&!parserDATA.parser.source.includes('dGString'));
const required=(o,k)=>{assert(o&&Object.hasOwn(o,k)&&o[k]!==undefined,'Actual native input missing: '+k);return o[k];};
const finite=(n,label)=>{assert(typeof n==='number'&&Number.isFinite(n),'Actual finite '+label+' required');return n;};
const ref=(x,label)=>{assert(x&&typeof x==='object',label+' required');return x;};

export function initializeOwn32727NativeAccountWithNativeFreeRounds({originalSessionScope,nativeInitPayload,actualNativeConfig,actualCurrency,actualMetrics}){
 ref(originalSessionScope,'original session scope');assert(typeof nativeInitPayload==='string');
 const config=ref(actualNativeConfig,'actual merged native config');
 const game=ref(required(config,'game'),'actual game config');assert([0,1,2].includes(required(game,'type')));
 const ante=ref(required(game,'anteBet'),'actual ante config');finite(required(ante,'betAdjustment'),'bet adjustment');finite(required(ante,'superBetDefault'),'native superbet default');
 const currency=ref(actualCurrency,'actual currency'),metrics=ref(actualMetrics,'actual metrics');
 assert(typeof currency.config==='function'&&typeof metrics.setFROptions==='function','Actual original native Init consumers required');
 const self={featureData:{}},NOVA={config,currency},ENUM={winSequence:{PAYLINE:0,PAYWAY:1,JJ:2},XC_NULL:-1};
 const context=createContext({self,NOVA,ENUM,METRICS:metrics});
 const native=(source)=>runInContext('('+source+')',context,{timeout:1000});
 const ownFreeDATA=read('classic-two-native-FreeRounds-own-source-v2/own32727-FreeRoundsBase-private.json');assert(ownFreeDATA);
 const free=Reflect.construct(native(ownFreeDATA.source),[]);self.freeRounds=free;
 // Rendering sinks only. All promotional state/getters remain the untouched own native constructor.
 free.roundNumberMeter={snapTo(){}};free.totalWinMeter={snapTo(){},rollTo(){}};
 const parser=native(parserDATA.parser.source);
 for(const row of dependencies.functions)self[row.name]=native(row.source);
 // Preserve the original wire ordering, including the original FGT/FID decoder order.
 const fields=new Map();for(const pair of nativeInitPayload.split('&')){const at=pair.indexOf('=');if(at>0)fields.set(pair.slice(0,at),pair.slice(at+1));}
 assert(fields.get('MSGID')==='INIT','Actual original INIT response required');
 for(const key of ['AB','BD','BDD','CUR'])assert(fields.has(key)&&fields.get(key)!=='','Actual Init field missing: '+key);
 const response=Reflect.apply(parser,self,[nativeInitPayload.split('&')]);
 assert(!response.inRecovery,'Own normal Init recovery path is not mapped');
 // A fresh connection cannot adopt a feature or promotional round already in progress.
 assert(!response.inFreeGames&&!(response.numberFreeGames>0)&&!response.pickFeatureTrigger&&!(response.freeGameTrigger>0),'Own normal Init has a pending feature');
 assert(!response.freeRounds.inFreeRounds&&!(response.freeRounds.roundsRemaining>0),'Own normal Init promotional round is not mapped');
 finite(required(response,'balance'),'Init balance');
 const bets=required(response,'betDefaults'),defaultBet=finite(required(response,'betCurrentBetDefault'),'Init default wager');
 assert(Array.isArray(bets)&&bets.length>0&&bets.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)&&bets.includes(defaultBet),'Actual native Init wager menu/default required');
 // Native Account stores an absent optional ABM as undefined; no ante choice or zero is invented.
 if(response.anteBetMultiples!==undefined)assert(Array.isArray(response.anteBetMultiples)&&response.anteBetMultiples.every(n=>typeof n==='number'&&Number.isFinite(n)),'Actual native ante menu malformed');
 if(game.type===1){
  finite(required(required(config,'payways'),'activeReels'),'active reels');
  assert(Array.isArray(response.payWayReelMultiplier),'Actual Init RBM required');
 }else finite(required(required(config,'lines'),'activeLines'),'active lines');
 const Account=native(accountDATA.functions.find(x=>x.name==='Account').source);
 self.account=Reflect.construct(Account,[free]);
 for(const row of parserDATA.accountSetup)runInContext(row.source,context,{timeout:1000});
 self.serverResponse=response;
 const Init=native(accountDATA.functions.find(x=>x.name==='InitState').source),state=Reflect.construct(Init,['INIT']);
 const exit=Reflect.apply(state.handleEvent,state,['MSG',nativeInitPayload]);assert(exit===0,'Own normal Init did not complete');
 finite(self.account.getBalance(),'native account balance');finite(self.account.getTotalBetAmount(),'native current wager');
 const snapshot=()=>Object.freeze({balance:self.account.getBalance(),betPerLine:self.account.getCurrentBetPerLine(),activeLines:self.account.getNumPaylinesSelected(),activeReels:self.account.getNumReelsSelected(),superbet:self.account.superbet,betAdjustment:self.account.betAdjustment,totalBet:self.account.getTotalBetAmount()});
 return Object.freeze({gameId:'32727',originalSessionScope,account:self.account,decodedNativeResponse:response,
  originalPayload:nativeInitPayload,nativeConfig:config,nativeInitExitCode:exit,nativeFreeRounds:free,nativeFreeRoundsSourceSHA256:ownFreeDATA.fragmentSHA256,nativeFreeRoundsAndParserShareRealm:true,
  selectOriginalCapturePerReel(value){finite(value,'original selected wager');assert(bets.includes(value),'Original selected wager not in actual Init menu');self.account.setCurrentBetAmount(value);return snapshot();},
  snapshot,sourceRequests:0,providerACKClaimed:false,productionAdmission:false,
  originalFactorySuccessfulEnvelopeAssociationStillRequired:true});
}
