import assert from 'node:assert/strict';
import {pyramidsFields} from './sg.pyramids';
import {validatePyramidsMixedXml} from './sg.pyramids-mixed';
import {XMLParser} from 'fast-xml-parser';
const xmlParser=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false});
function fields(s:string){const p:Record<string,string>=Object.create(null);for(const part of s.split('&').filter(Boolean)){const i=part.indexOf('='),k=part.slice(0,i);assert(i>0&&!Object.prototype.hasOwnProperty.call(p,k),'COLLECTOR_PARAMETERS');p[k]=part.slice(i+1);}return p;}
export function hasPyramidsSuperHold(raw:any){return raw?.sourceKey==='hyperchargedpyramidsofra96-round-one-base-v1'&&raw.steps?.slice(1).some((s:any)=>fields(s.responsePayload).GSD?.split('#').includes('SHNST~1'));}
export function superHoldFields(raw:any,mappingHash:string){
 assert(hasPyramidsSuperHold(raw),'COLLECTOR_SUPER_HOLD_REQUIRED');
 for(const s of raw.steps){validatePyramidsMixedXml(s);const root=xmlParser.parse(s.responseXml).GDMRESPONSE;assert(root&&Object.keys(root).every(k=>['SUCCESS','PAYLOAD','OGS_RC'].includes(k))&&(root.OGS_RC===undefined||root.OGS_RC==='0'),'COLLECTOR_XML');const p=fields(s.responsePayload);assert(['0','0|'].includes(p.FID),'PYRAMIDS_UNREVIEWED_FEATURE');}
 return {...pyramidsFields(raw,mappingHash,false,10,true),bonus:6};
}
