import assert from 'node:assert/strict';
import {pyramidsFields} from './sg.pyramids';
import {validatePyramidsMixedXml} from './sg.pyramids-mixed';
import {XMLParser} from 'fast-xml-parser';
const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false});
const uint=(value:any)=>{assert((typeof value==='number'||typeof value==='string'&&/^\d+$/.test(value))&&Number.isSafeInteger(Number(value))&&Number(value)>=0,'COLLECTOR_COIN_MONEY');return Number(value);};
function fields(text:string){
 assert(typeof text==='string','COLLECTOR_PARAMETERS');const p:Record<string,string>=Object.create(null);
 for(const part of text.split('&').filter(Boolean)){const at=part.indexOf('='),key=part.slice(0,at);assert(at>0&&!Object.prototype.hasOwnProperty.call(p,key),'COLLECTOR_PARAMETERS');p[key]=part.slice(at+1);}return p;
}
export function hasPyramidsCashCoins(raw:any){
 if(raw?.sourceKey!=='hyperchargedpyramidsofra96-round-one-base-v1'||!raw.steps?.length)return false;
 const first=fields(raw.steps[0].responsePayload);
 if(!['1','1|'].includes(first.FID)||first.TFG!=='10')return false;
 const retrigger=raw.steps.slice(1).some((s:any)=>uint(fields(s.responsePayload).TFG??'0')>10);
 return raw.steps.some((s:any)=>(fields(s.responsePayload).GSD??'').split('#').some((segment:string)=>segment.startsWith('CL~')&&segment.slice(3).split('|').some(row=>['-4','-2'].includes(row.split(';')[2])||retrigger&&row.split(';')[2]==='-3')));
}
export function cashCoinFields(raw:any,mappingHash:string){
 assert(hasPyramidsCashCoins(raw),'COLLECTOR_COIN_REQUIRED');const start=uint(raw.startBalanceRaw);let previousWin=0;
 for(const step of raw.steps){
  validatePyramidsMixedXml(step);const root=parser.parse(step.responseXml).GDMRESPONSE;
  assert(root&&Object.keys(root).every(k=>['SUCCESS','PAYLOAD','OGS_RC'].includes(k))&&(root.OGS_RC===undefined||root.OGS_RC==='0'),'COLLECTOR_XML');
  const p=fields(step.responsePayload),win=uint(p.TW),balance=uint(p.B),available=uint(p.AB);
  assert(win>=previousWin&&balance===start-20+win,'PYRAMIDS_COIN_CUMULATIVE_MONEY');
  assert(available===(uint(p.NFG)===0?balance:start-20),'PYRAMIDS_COIN_AVAILABLE_BALANCE');
  if(Object.prototype.hasOwnProperty.call(step,'responseBalance'))assert(uint(step.responseBalance)===available,'PYRAMIDS_COIN_RESPONSE_BALANCE');previousWin=win;
 }
 return {...pyramidsFields(raw,mappingHash,false,10,false,false,true,true),bonus:9};
}
