import assert from 'node:assert/strict';
import {pyramidsFields} from './sg.pyramids';
import {validatePyramidsMixedXml} from './sg.pyramids-mixed';
import {XMLParser} from 'fast-xml-parser';
const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false});
function fields(text:string){const p:Record<string,string>=Object.create(null);for(const part of text.split('&').filter(Boolean)){const at=part.indexOf('='),key=part.slice(0,at);assert(at>0&&!Object.prototype.hasOwnProperty.call(p,key),'COLLECTOR_PARAMETERS');p[key]=part.slice(at+1);}return p;}
export function hasPyramidsSuperFree(raw:any){return raw?.sourceKey==='hyperchargedpyramidsofra96-round-one-base-v1'&&raw.steps?.some((s:any)=>fields(s.responsePayload).GSD?.split('#').includes('SFGT~1'));}
export function superFreeFields(raw:any,mappingHash:string){
 assert(hasPyramidsSuperFree(raw),'COLLECTOR_SUPER_FREE_REQUIRED');
 for(const step of raw.steps){validatePyramidsMixedXml(step);const root=parser.parse(step.responseXml).GDMRESPONSE;assert(root&&Object.keys(root).every(k=>['SUCCESS','PAYLOAD','OGS_RC'].includes(k))&&(root.OGS_RC===undefined||root.OGS_RC==='0'),'COLLECTOR_XML');assert(['1','1|'].includes(fields(step.responsePayload).FID),'PYRAMIDS_UNREVIEWED_FEATURE');}
 return {...pyramidsFields(raw,mappingHash,false,10,false,true),bonus:7};
}
