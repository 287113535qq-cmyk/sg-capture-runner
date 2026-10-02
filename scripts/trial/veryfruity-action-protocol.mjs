import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reviewVeryFruitySettlement} from './veryfruity-settlement-review.mjs';
import {VERYFRUITY_CLIENT_SHA} from './veryfruity-action-review.mjs';
import {parseXml,one,children} from './pearl-protocol.mjs';
export const VERYFRUITY_SOURCE='veryfruity-wms-action-v1',ACTION_VERSION='veryfruity-action-v1';
export const ACTION_CONTRACT={schema:'sg-action-contract-v1',gameId:32812,sourceKey:VERYFRUITY_SOURCE,protocol:'wms',betRaw:20,
 version:ACTION_VERSION,clientHash:VERYFRUITY_CLIENT_SHA,supportedActions:['Logic','EndGame'],classification:'independent-journal',
 glsGameID:'20206',glsVersionID:'1_0',stakePerLine:'1',paylineCount:'20'};
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
export const ACTION_CONTRACT_HASH=createHash('sha256').update(canonical(ACTION_CONTRACT)).digest('hex');
function scope(plan,raw){
 assert(plan?.gameId===32812&&plan.runtimeGameId===33172&&plan.sourceKey===VERYFRUITY_SOURCE&&plan.adapter==='veryfruity-wms-action-v1'
  &&plan.featureProfile===ACTION_VERSION&&plan.actionContractHash===ACTION_CONTRACT_HASH&&plan.betRaw===20&&plan.buy===0&&plan.mode==='demo','VERYFRUITY_ACTION_PROFILE');
 assert(plan.requestHeader?.gameID==='20206'&&plan.requestHeader.versionID==='1_0'&&plan.requestHeader.gameCodeRGI==='veryfruity','VERYFRUITY_ACTION_PROFILE');
 assert(raw.fixtureOnly===false&&raw.protocol==='wms'&&raw.sourceKey===VERYFRUITY_SOURCE&&raw.roundFieldsVersion==='sg-round-fields-v1'
  &&raw.requestFlowVersion===ACTION_VERSION&&raw.actionContractHash===ACTION_CONTRACT_HASH,'VERYFRUITY_ACTION_RAW');
}
export function veryFruityActionNext(plan,raw){
 scope(plan,raw);
 if(Array.isArray(raw.steps)&&raw.steps.length===0){assert(Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=20,'VERYFRUITY_ACTION_START');return {MSGID:'Logic'};}
 const result=reviewVeryFruitySettlement(raw,{expectedHeader:plan.requestHeader,stakePerLine:'1',paylineCount:'20'});
 return result.nextRequestHypothesis?{MSGID:result.nextRequestHypothesis}:null;
}
export function veryFruityActionMapping(plan,raw){
 scope(plan,raw);const r=reviewVeryFruitySettlement(raw,{expectedHeader:plan.requestHeader,stakePerLine:'1',paylineCount:'20'});
 assert(r.endGameAcknowledged&&r.nextRequestHypothesis===null,'VERYFRUITY_ACTION_INCOMPLETE');
 return {buy:0,bonus:null,typeMappingHash:ACTION_CONTRACT_HASH,classificationStatus:'pending'};
}
export function veryFruityActionIntent(plan,raw,payload){
 const next=veryFruityActionNext(plan,raw);assert(next,'VERYFRUITY_ACTION_AFTER_TERMINAL');
 const q=parseXml(payload),h=one(q,'Header');
 assert(q.tag==='GameRequest'&&JSON.stringify(q.a)===JSON.stringify({type:next.MSGID}),'VERYFRUITY_ACTION_INTENT');
 assert(Object.keys(h.a).length===Object.keys(plan.requestHeader).length+1&&!children(h).length
  &&Object.entries(plan.requestHeader).every(([k,v])=>h.a[k]===v),'VERYFRUITY_ACTION_INTENT');
 assert(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'VERYFRUITY_ACTION_SESSION');
 if(raw.steps.length)assert.equal(h.a.sessionID,one(parseXml(raw.steps.at(-1).responseXml),'Header').a.sessionID,'VERYFRUITY_ACTION_SESSION');
 const logic=next.MSGID==='Logic';assert.deepEqual(children(q).map(n=>n.tag).sort(),['Header','AccountData',...(logic?['Stake','PaylineCount']:[])].sort(),'VERYFRUITY_ACTION_INTENT');
 const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');
 assert(!Object.keys(a.a).length&&children(a).length===1&&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','VERYFRUITY_ACTION_INTENT');
 if(logic){const s=one(q,'Stake'),p=one(q,'PaylineCount');assert.deepEqual(s.a,{perLine:'1',total:'20'});assert.deepEqual(p.a,{count:'20'});assert(!children(s).length&&!children(p).length,'VERYFRUITY_ACTION_INTENT');}
 return {validated:true};
}
