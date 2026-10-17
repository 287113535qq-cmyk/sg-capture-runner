import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {buildOwnClassicPaidRequestDATA} from '../classic-two-free-native-DATA-v1/own-classic-paid-native-DATA-v2-private.mjs';
import {readOwn32727OriginalNativeReelstripDATA} from './own32727-original-native-Reelstrip-DATA-v1.mjs';
import {createOwn32727NativePaidRoundMachineDATA22} from './own32727-native-paid-round-machine-DATA-v22.mjs';
const data=JSON.parse(readFileSync(new URL('../Medusa-own-native-feature-producers-DATA-v2/own32727-native-feature-producers-private.json',import.meta.url),'utf8'));
const realm=createContext({}),enums=Object.fromEntries(data.enums.map(r=>[r.name,runInContext('('+r.source+')',realm)]));enums.RUN_DEFAULT_ENTER=-1;
export function bindOwn32727PrivateNativePaidGameplayDATA22({sgSessionExports:sg}){
 return sg.bindOwnClassicGdmGameplayDataFactory('32727',(session,init)=>{
  assert(sg.readOwnClassicGdmInitData(session)===init&&init.gameId==='32727');
  const strips=readOwn32727OriginalNativeReelstripDATA({sgSessionExports:sg,originalSessionScope:session}),native=init.nativeInitAccount,account=native.account;
  let phase='idle',round,machine,result;
  const current=()=>{assert(phase!=='closed','Own Medusa native driver closed');init.assertCurrent();assert(sg.readOwnClassicGdmInitData(session)===init);};
  const readonly=new Proxy(account,{get(target,key){if(key==='takeBet'||key==='clearWin')return()=>{};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  const preview=()=>buildOwnClassicPaidRequestDATA({gameId:'32727',originalSessionScope:session,originalRoundScope:{},nativeInitAccount:{...native,account:readonly},actualNativeGameConfig:init.nativeConfigRecord.config.game,actualNativeFreeRounds:init.nativeFreeRounds,actualNativeEnums:enums,nativeDebug:{debugScreen:{}},nativeRoundActive:false,nativeSlotBetGSD:''});
  const wire=r=>({event:r.event,parameters:{GN:init.originalFactoryInitFrame.game.sg.runtimeSlug,...Object.fromEntries(Object.entries(r.parameters).map(([k,v])=>[k,String(v)]))}});
  return Object.freeze({kind:'own32727-private-native-paid-real-reel-flow-v1',
   getInitialRequest(){current();assert(phase==='idle');return wire(preview());},
   getExactFollowUpRequest(){current();assert(phase==='followup-ready'&&result?.pendingNativeRequest,'Own native follow-up is not ready');return wire(machine.readSelectedNativeRequest());},
   beforeSend(event,parameters){current();if(phase==='followup-ready'){const request=machine.readSelectedNativeRequest();assert.deepEqual({event,parameters},wire(request),'Exact own original native follow-up parameters required');machine.acceptSelectedNativeRequest(request);phase='awaiting-response';return{roundScope:round,isInitialPaid:false};}assert(phase==='idle'&&event==='BET','Own Medusa paid driver phase');const expected=wire(preview());assert.deepEqual({event,parameters},expected);assert(account.canBet());round={};phase='preparing';machine=createOwn32727NativePaidRoundMachineDATA22({originalSessionScope:session,originalRoundScope:round,originalNativeInitData:init,originalNativeReelstripData:strips});assert.deepEqual(wire(machine.paidRequest),expected);phase='awaiting-response';return{roundScope:round,isInitialPaid:true};},
   consume(source){current();assert(phase==='awaiting-response');result=machine.consumeOriginalSuccess(source);phase=result.pendingNativeRequest?'followup-ready':'response-consumed';return result;},
   acceptClosedRound(){current();assert(phase==='response-consumed'&&result.nativeRoundCloseObserved&&result.nativeResultShownObserved&&!result.nativeRoundActiveAfter);machine.close();phase='idle';round=machine=result=undefined;},
   close(){try{machine?.close();}finally{phase='closed';round=machine=result=undefined;}}
  });
 });
}
