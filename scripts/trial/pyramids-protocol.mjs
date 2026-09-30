import {pyramidsHoldReview,PYRAMIDS_SOURCE} from './pyramids-hold-review.mjs';
import {pyramidsFreeSequence,PYRAMIDS_FREE_EXTENSION} from './pyramids-free-review.mjs';
export {PYRAMIDS_SOURCE,PYRAMIDS_FREE_EXTENSION};
const need=(v,e)=>{if(!v)throw Error(e);};
function pairs(text){const p=Object.create(null);need(typeof text==='string','PYRAMIDS_PARAMETERS');for(const part of text.split('&').filter(Boolean)){const i=part.indexOf('='),k=part.slice(0,i);need(i>0&&!Object.hasOwn(p,k),'PYRAMIDS_PARAMETERS');p[k]=part.slice(i+1);}return p;}
function uint(v){need(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(+v),'PYRAMIDS_NUMBER');return +v;}
export function pyramidsSequence(raw){
 need(raw.sourceKey===PYRAMIDS_SOURCE&&raw.protocol==='nextgen'&&raw.steps?.length>0&&raw.steps.length<=100,'PYRAMIDS_PROFILE');
 const free=raw.steps.some(s=>['1','1|'].includes(pairs(s.responsePayload).FID));
 if(free)return{...pyramidsFreeSequence(raw),free:true};
 const first=pairs(raw.steps[0].responsePayload),last=pairs(raw.steps.at(-1).responsePayload);
 if(raw.steps.length>1||uint(first.NFG??'0')>0)return{next:pyramidsHoldReview(raw).next,free:false,last};
 const s=raw.steps[0],q=pairs(s.requestPayload);
 need(s.msgId==='BET'&&q.MSGID==='BET'&&last.MSGID==='BET'&&q.GN==='hyperchargedpyramidsofra96'&&q.BPL==='1'&&q.LB==='40'&&Object.keys(q).length===5&&/^gdmgcm.{1,505}$/.test(q.PID??''),'PYRAMIDS_REQUEST');
 need(['','0','0|'].includes(last.FID??'')&&['0','1'].includes(last.IFG)&&!['CFG','ABPM','SB','JPV'].some(k=>Object.hasOwn(last,k))&&!Object.keys(last).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k)),'PYRAMIDS_UNREVIEWED_FEATURE');
 return{next:null,free:false,last};
}
export function pyramidsNextRequest(raw){if(!raw.steps.length)return{MSGID:'BET'};const{next}=pyramidsSequence(raw);return next?{MSGID:next}:null;}
export function pyramidsMapping(raw,baseHash,extensionHash){
 const{next,free,last}=pyramidsSequence(raw);need(!next,'INCOMPLETE_ROUND');
 const end=uint(last.B),win=uint(last.TW);
 need(raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1'&&Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=0&&raw.startBalanceRaw-end+win===20&&end===uint(last.AB),'PYRAMIDS_MONEY');
 if(raw.steps.at(-1).responseBalance!==undefined)need(Number(raw.steps.at(-1).responseBalance)===end,'PYRAMIDS_BALANCE');
 const typeMappingHash=free?extensionHash:baseHash;need(typeof typeMappingHash==='string'&&/^[a-f0-9]{64}$/.test(typeMappingHash),'PYRAMIDS_MAPPING_REQUIRED');
 return{buy:0,bonus:free?2:raw.steps.length>1?1:0,typeMappingHash};
}
