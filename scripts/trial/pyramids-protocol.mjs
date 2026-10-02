import {pyramidsHoldReview,PYRAMIDS_SOURCE} from './pyramids-hold-review.mjs';
import {pyramidsFreeSequence,PYRAMIDS_FREE_EXTENSION} from './pyramids-free-review.mjs';
import {reviewMixedSequence,pyramidsHasMixed} from './pyramids-mixed-review.mjs';
import {pyramidsHasFifteen,reviewFifteenSequence,PYRAMIDS_FIFTEEN_EXTENSION} from './pyramids-fifteen-review.mjs';
import {pyramidsHasSuperHold,pyramidsSuperHoldReview,PYRAMIDS_SUPER_HOLD_EXTENSION} from './pyramids-super-hold-review.mjs';
import {pyramidsHasSuperFree,pyramidsSuperFreeReview,PYRAMIDS_SUPER_FREE_EXTENSION} from './pyramids-super-free-review.mjs';
export {PYRAMIDS_SUPER_HOLD_EXTENSION,PYRAMIDS_SUPER_FREE_EXTENSION};
export {PYRAMIDS_SOURCE,PYRAMIDS_FREE_EXTENSION,PYRAMIDS_FIFTEEN_EXTENSION};
export const PYRAMIDS_MAJOR_EXTENSION=PYRAMIDS_SOURCE+'-pyramids-free-major-v1';
export const PYRAMIDS_MIXED_EXTENSION=PYRAMIDS_SOURCE+'-pyramids-free-hold-v1';
export function pyramidsHasMajor(raw){return raw.steps.some(s=>String(pairs(s.responsePayload).GSD??'').split('#').some(g=>g.startsWith('CL~')&&g.slice(3).split('|').some(r=>r.split(';')[2]==='-3')));}
const need=(v,e)=>{if(!v)throw Error(e);};
function pairs(text){const p=Object.create(null);need(typeof text==='string','PYRAMIDS_PARAMETERS');for(const part of text.split('&').filter(Boolean)){const i=part.indexOf('='),k=part.slice(0,i);need(i>0&&!Object.hasOwn(p,k),'PYRAMIDS_PARAMETERS');p[k]=part.slice(i+1);}return p;}
function uint(v){need(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(+v),'PYRAMIDS_NUMBER');return +v;}
export function pyramidsSequence(raw){
 need(raw.sourceKey===PYRAMIDS_SOURCE&&raw.protocol==='nextgen'&&raw.steps?.length>0&&raw.steps.length<=100,'PYRAMIDS_PROFILE');
 if(pyramidsHasSuperFree(raw)){const result=pyramidsSuperFreeReview(raw);return {...result,free:true,superFree:true};}
 if(pyramidsHasSuperHold(raw)){const result=pyramidsSuperHoldReview(raw);return {...result,free:false,superHold:true,last:pairs(raw.steps.at(-1).responsePayload)};}
 if(pyramidsHasFifteen(raw)){const result=reviewFifteenSequence(raw);return {...result,free:true,fifteen:true,last:pairs(raw.steps.at(-1).responsePayload)};}
 if(pyramidsHasMixed(raw)){const result=reviewMixedSequence(raw);return {...result,free:true,mixed:true,last:pairs(raw.steps.at(-1).responsePayload)};}
 const free=raw.steps.some(s=>['1','1|'].includes(pairs(s.responsePayload).FID));
 if(free)return{...pyramidsFreeSequence(raw,{reviewedMajor:pyramidsHasMajor(raw)}),free:true};
 const first=pairs(raw.steps[0].responsePayload),last=pairs(raw.steps.at(-1).responsePayload);
 if(raw.steps.length>1||uint(first.NFG??'0')>0)return{next:pyramidsHoldReview(raw).next,free:false,last};
 const s=raw.steps[0],q=pairs(s.requestPayload);
 need(s.msgId==='BET'&&q.MSGID==='BET'&&last.MSGID==='BET'&&q.GN==='hyperchargedpyramidsofra96'&&q.BPL==='1'&&q.LB==='40'&&Object.keys(q).length===5&&/^gdmgcm.{1,505}$/.test(q.PID??''),'PYRAMIDS_REQUEST');
 need(['','0','0|'].includes(last.FID??'')&&['0','1'].includes(last.IFG)&&!['CFG','ABPM','SB','JPV'].some(k=>Object.hasOwn(last,k))&&!Object.keys(last).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k)),'PYRAMIDS_UNREVIEWED_FEATURE');
 return{next:null,free:false,last};
}
export function pyramidsNextRequest(raw){if(!raw.steps.length)return{MSGID:'BET'};const{next}=pyramidsSequence(raw);return next?{MSGID:next}:null;}
export function pyramidsMapping(raw,baseHash,extensionHash){
 const{next,free,mixed,fifteen,superHold,superFree,last}=pyramidsSequence(raw);need(!next,'INCOMPLETE_ROUND');
 const end=uint(last.B),win=uint(last.TW);
 need(raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1'&&Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=0&&raw.startBalanceRaw-end+win===20&&end===uint(last.AB),'PYRAMIDS_MONEY');
 if(raw.steps.at(-1).responseBalance!==undefined)need(Number(raw.steps.at(-1).responseBalance)===end,'PYRAMIDS_BALANCE');
 const major=free&&pyramidsHasMajor(raw);
 const typeMappingHash=superFree?extensionHash?.superFree:superHold?extensionHash?.superHold:free?(fifteen?extensionHash?.fifteen:mixed?extensionHash?.mixed:major?extensionHash?.major:typeof extensionHash==='object'?extensionHash.free:extensionHash):baseHash;need(typeof typeMappingHash==='string'&&/^[a-f0-9]{64}$/.test(typeMappingHash),'PYRAMIDS_MAPPING_REQUIRED');
 return{buy:0,bonus:superFree?7:superHold?6:free?(fifteen?5:mixed?4:major?3:2):raw.steps.length>1?1:0,typeMappingHash};
}
