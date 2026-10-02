// Independent known signed cash-coin validator. Mapping does not grant admission.
import {pyramidsFreeSequence,pyramidsFreeReview} from './pyramids-free-review.mjs';
import {validatePyramidsRetriggerXml} from './pyramids-retrigger-review.mjs';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const integer=v=>{need((typeof v==='number'||typeof v==='string'&&/^\d+$/.test(v))&&Number.isSafeInteger(Number(v))&&Number(v)>=0,'PYRAMIDS_COIN_MONEY');return Number(v);};
export const PYRAMIDS_COIN_EXTENSION='hyperchargedpyramidsofra96-round-one-base-v1-pyramids-cash-coins-v1';
export function pyramidsHasCashCoins(raw){
 if(raw?.sourceKey!=='hyperchargedpyramidsofra96-round-one-base-v1'||!raw.steps?.length)return false;
 const first=new URLSearchParams(raw.steps[0].responsePayload);
 if(!['1','1|'].includes(first.get('FID'))||first.get('TFG')!=='10')return false;
 const retrigger=raw.steps.slice(1).some(s=>integer(new URLSearchParams(s.responsePayload).get('TFG')??'0')>10);
 return raw.steps.some(s=>(new URLSearchParams(s.responsePayload).get('GSD')??'').split('#').some(segment=>segment.startsWith('CL~')&&segment.slice(3).split('|').some(row=>['-4','-2'].includes(row.split(';')[2])||retrigger&&row.split(';')[2]==='-3')));
}
export function reviewPyramidsCoins(raw){
 validatePyramidsRetriggerXml(raw);
 const options={retriggerTen:true,reviewedCashCoins:true};
 const sequence=pyramidsFreeSequence(raw,options),start=integer(raw.startBalanceRaw);let previousWin=0;
 for(const step of raw.steps){
  const p=new URLSearchParams(step.responsePayload),win=integer(p.get('TW')),balance=integer(p.get('B')),available=integer(p.get('AB'));
  need(win>=previousWin&&balance===start-20+win,'PYRAMIDS_COIN_CUMULATIVE_MONEY');
  need(available===(integer(p.get('NFG'))===0?balance:start-20),'PYRAMIDS_COIN_AVAILABLE_BALANCE');
  if(Object.hasOwn(step,'responseBalance'))need(integer(step.responseBalance)===available,'PYRAMIDS_COIN_RESPONSE_BALANCE');
  previousWin=win;
 }
 const result={nextRequestHypothesis:sequence.next?{MSGID:sequence.next}:null,complete:sequence.next===null,
  captureAuthorization:false,sourceRequests:0,naturalCoinTerminalObserved:false,mappingRegistered:true};
 if(result.complete){const settled=pyramidsFreeReview(raw,options);result.settlement={complete:true,betRaw:settled.betRaw,endBalanceRaw:settled.endBalanceRaw,totalWinRaw:settled.totalWinRaw,sourceRequests:0,captureAuthorized:false};}
 return result;
}
