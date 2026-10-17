import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const data=JSON.parse(readFileSync(new URL('../Medusa-own-native-Reelstrip-and-ReelManager-DATA-v1/own32727-native-ReelstripParser-private.json',import.meta.url),'utf8'));
const parsed=new WeakMap();
export function readOwn32727OriginalNativeReelstripDATA({sgSessionExports:sg,originalSessionScope:session}){
 const init=sg.readOwnClassicGdmInitData(session);init.assertCurrent();assert(init.gameId==='32727'&&init.originalSessionScope===session);
 const source=sg.readOwnClassicGdmReelstripSource(session),frame=source.read(session);
 assert(source.has(frame)&&frame.sessionScope===session&&frame.game===init.originalFactoryInitFrame.game&&frame.step.msgId==='REELSTRIP','Actual original REELSTRIP frame required');
 const prior=parsed.get(frame);if(prior){prior.assertCurrent();return prior;}
 const context=createContext({}),Parser=runInContext('('+data.row.source+')',context,{timeout:1000}),parser=Reflect.construct(Parser,[]);
 Reflect.apply(parser.processResponse,parser,[frame.step.responsePayload]);
 const sets=[];for(let i=0;i<parser.getNumSets();i++)sets.push(parser.getReelstripSet('RST_'+i));
 const current=()=>{init.assertCurrent();assert(source.has(frame)&&source.read(session)===frame&&sg.readOwnClassicGdmInitData(session)===init,'Original REELSTRIP source revoked');};
 const result=Object.freeze({gameId:'32727',originalSessionScope:session,originalReelstripFrame:frame,originalNativeParser:parser,retainedSDKSourceSHA256:data.retainedSDKSourceSHA256,nativeReelstripSets:sets,assertCurrent:current,sourceRequests:0,providerACKClaimed:false,productionAdmission:false});
 current();parsed.set(frame,result);return result;
}
