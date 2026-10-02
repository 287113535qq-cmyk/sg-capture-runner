import assert from 'node:assert/strict';
import {pyramidsFields} from './sg.pyramids';
import {hasPyramidsSuperFree} from './sg.pyramids-super-free';
import {validatePyramidsMixedXml} from './sg.pyramids-mixed';
import {XMLParser} from 'fast-xml-parser';
const xml=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false});
function fields(text:string){const p:Record<string,string>=Object.create(null);for(const part of text.split('&').filter(Boolean)){const at=part.indexOf('='),key=part.slice(0,at);assert(at>0&&!Object.prototype.hasOwnProperty.call(p,key),'COLLECTOR_PARAMETERS');p[key]=part.slice(at+1);}return p;}
const uint=(v:any)=>{assert((typeof v==='number'||typeof v==='string'&&/^\d+$/.test(v))&&Number.isSafeInteger(Number(v))&&Number(v)>=0,'PYRAMIDS_SUPER_COIN_MONEY');return Number(v);};
export function hasPyramidsSuperCoins(raw:any){return hasPyramidsSuperFree(raw)&&raw.steps.some((s:any)=>(fields(s.responsePayload).GSD??'').split('#').some((g:string)=>g.startsWith('CL~')&&g.slice(3).split('|').some(row=>['-4','-3','-2'].includes(row.split(';')[2]))));}
export function superCoinFields(raw:any,mappingHash:string){
 assert(hasPyramidsSuperCoins(raw),'COLLECTOR_SUPER_COIN_REQUIRED');const start=uint(raw.startBalanceRaw);let previous=0;
 for(const step of raw.steps){validatePyramidsMixedXml(step);const root=xml.parse(step.responseXml).GDMRESPONSE;
  assert(root&&Object.keys(root).every(k=>['SUCCESS','PAYLOAD','OGS_RC'].includes(k))&&(root.OGS_RC===undefined||root.OGS_RC==='0'),'COLLECTOR_XML');
  const p=fields(step.responsePayload),win=uint(p.TW),b=uint(p.B),ab=uint(p.AB);
  assert(win>=previous&&b===start-20+win,'PYRAMIDS_SUPER_COIN_MONEY');assert(ab===(uint(p.NFG)===0?b:start-20),'PYRAMIDS_SUPER_COIN_AVAILABLE');
  if(Object.prototype.hasOwnProperty.call(step,'responseBalance'))assert(uint(step.responseBalance)===ab,'PYRAMIDS_SUPER_COIN_RESPONSE_BALANCE');previous=win;
 }
 return {...pyramidsFields(raw,mappingHash,false,10,false,true,false,true,true),bonus:10};
}
