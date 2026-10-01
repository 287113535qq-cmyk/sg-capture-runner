import assert from 'node:assert/strict';
import {pyramidsFields} from './sg.pyramids';
import {hasPyramidsMixed,reviewMixedCollector,validatePyramidsMixedXml} from './sg.pyramids-mixed';
function fields(s:string){const p:Record<string,string>=Object.create(null);for(const part of s.split('&').filter(Boolean)){const i=part.indexOf('='),k=part.slice(0,i);assert(i>0&&!Object.prototype.hasOwnProperty.call(p,k),'COLLECTOR_PARAMETERS');p[k]=part.slice(i+1);}return p;}
export function hasPyramidsFifteen(raw:any){return raw?.sourceKey==='hyperchargedpyramidsofra96-round-one-base-v1'&&raw.steps?.length>0&&fields(raw.steps[0].responsePayload).TFG==='15';}
export function fifteenFields(raw:any,mappingHash:string){
 assert(hasPyramidsFifteen(raw),'COLLECTOR_FIFTEEN_REQUIRED');
 for(const s of raw.steps){validatePyramidsMixedXml(s);const p=fields(s.responsePayload);assert(['B','TW'].every(k=>/^\d+$/ .test(p[k]??'')&&Number.isSafeInteger(+p[k]))&&Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw-Number(p.B)+Number(p.TW)===20,'PYRAMIDS_FIFTEEN_MONEY');}
 if(hasPyramidsMixed(raw)){const r=reviewMixedCollector(raw,mappingHash,15);assert(r.complete&&r.fields,'COLLECTOR_INCOMPLETE');return {...r.fields,bonus:5};}
 return {...pyramidsFields(raw,mappingHash,true,15),bonus:5};
}
