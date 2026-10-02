// SFGT + original Mini/Minor/Major cash coins. No source allowance.
import {pyramidsHasSuperFree} from './pyramids-super-free-review.mjs';
import {pyramidsFreeSequence,pyramidsFreeReview,PYRAMIDS_FREE_SOURCE} from './pyramids-free-review.mjs';
import {validatePyramidsRetriggerXml} from './pyramids-retrigger-review.mjs';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const integer=v=>{need((typeof v==='number'||typeof v==='string'&&/^\d+$/.test(v))&&Number.isSafeInteger(Number(v))&&Number(v)>=0,'PYRAMIDS_SUPER_COIN_MONEY');return Number(v);};
export const PYRAMIDS_SUPER_COIN_EXTENSION=PYRAMIDS_FREE_SOURCE+'-pyramids-super-cash-coins-v1';
export function pyramidsHasSuperCoins(raw){return pyramidsHasSuperFree(raw)&&raw.steps.some(s=>(new URLSearchParams(s.responsePayload).get('GSD')??'').split('#').some(g=>g.startsWith('CL~')&&g.slice(3).split('|').some(row=>['-4','-3','-2'].includes(row.split(';')[2]))));}
export function reviewPyramidsSuperCoins(raw){
 validatePyramidsRetriggerXml(raw);const options={superFree:true,reviewedCashCoins:true},sequence=pyramidsFreeSequence(raw,options),start=integer(raw.startBalanceRaw);let previous=0;
 for(const step of raw.steps){const p=new URLSearchParams(step.responsePayload),win=integer(p.get('TW')),b=integer(p.get('B')),ab=integer(p.get('AB'));
  need(win>=previous&&b===start-20+win,'PYRAMIDS_SUPER_COIN_MONEY');need(ab===(integer(p.get('NFG'))===0?b:start-20),'PYRAMIDS_SUPER_COIN_AVAILABLE');
  if(Object.hasOwn(step,'responseBalance'))need(integer(step.responseBalance)===ab,'PYRAMIDS_SUPER_COIN_RESPONSE_BALANCE');previous=win;
 }
 const result={next:sequence.next,free:true,superCoins:true,last:sequence.last,complete:sequence.next===null,captureAuthorization:false,naturalCombinedTerminalObserved:false};
 if(result.complete)result.settlement=pyramidsFreeReview(raw,options);return result;
}
