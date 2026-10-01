import {pyramidsFreeSequence,PYRAMIDS_FREE_SOURCE} from './pyramids-free-review.mjs';
import {pyramidsHasMixed,reviewMixedSequence} from './pyramids-mixed-review.mjs';
import {parseXml,one,children} from './pearl-protocol.mjs';
const check=(v,e)=>{if(!v)throw Error(e);};
function fields(s){const p=Object.create(null);for(const q of s.split('&').filter(Boolean)){const i=q.indexOf('='),k=q.slice(0,i);check(i>0&&!Object.hasOwn(p,k),'AMBIGUOUS_PARAMETERS');p[k]=q.slice(i+1);}return p;}
const number=v=>{check(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(+v),'INVALID_NUMBER');return +v;};
export const PYRAMIDS_FIFTEEN_EXTENSION=PYRAMIDS_FREE_SOURCE+'-pyramids-fifteen-free-v1';
export function pyramidsHasFifteen(raw){return raw.sourceKey===PYRAMIDS_FREE_SOURCE&&raw.steps?.length>0&&fields(raw.steps[0].responsePayload).TFG==='15';}
export function reviewFifteenSequence(raw){
 check(pyramidsHasFifteen(raw),'PYRAMIDS_FIFTEEN_REQUIRED');
 for(const s of raw.steps){const p=fields(s.responsePayload),xml=parseXml(s.responseXml),success=one(xml,'SUCCESS'),payload=one(xml,'PAYLOAD');
  check(xml.tag.toUpperCase()==='GDMRESPONSE'&&children(success).length===0&&children(payload).length===0&&success.children.map(c=>c.text??'').join('').toLowerCase()==='true'&&payload.children.map(c=>c.text??'').join('')===s.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
  check(Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw-number(p.B)+number(p.TW)===20,'PYRAMIDS_FIFTEEN_MONEY');
 }
 if(pyramidsHasMixed(raw))return reviewMixedSequence(raw,{freeTotal:15});
 const result=pyramidsFreeSequence(raw,{reviewedMajor:true,freeTotal:15});
 if(result.next)return {complete:false,next:result.next};
 const end=number(result.last.B),win=number(result.last.TW);check(end===number(result.last.AB),'BALANCE_MISMATCH');
 if(raw.steps.at(-1).responseBalance!==undefined)check(Number(raw.steps.at(-1).responseBalance)===end,'BALANCE_MISMATCH');
 return {complete:true,next:null,betRaw:20,endBalanceRaw:end,totalWinRaw:win};
}
