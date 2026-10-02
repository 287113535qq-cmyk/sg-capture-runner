import assert from 'node:assert/strict';
import {pyramidsFields} from './sg.pyramids';
import {validatePyramidsMixedXml} from './sg.pyramids-mixed';
import {XMLParser} from 'fast-xml-parser';
const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false});
export function hasPyramidsRetrigger(raw:any){
 return raw?.sourceKey==='hyperchargedpyramidsofra96-round-one-base-v1'&&raw.steps?.length>0
  &&new URLSearchParams(raw.steps[0].responsePayload).get('TFG')==='10'
  &&raw.steps.slice(1).some((s:any)=>/^\d+$/.test(new URLSearchParams(s.responsePayload).get('TFG')??'')&&Number(new URLSearchParams(s.responsePayload).get('TFG'))>10);
}
export function retriggerFields(raw:any,mappingHash:string){
 assert(hasPyramidsRetrigger(raw),'COLLECTOR_RETRIGGER_REQUIRED');
 for(const step of raw.steps){
  validatePyramidsMixedXml(step);const root=parser.parse(step.responseXml).GDMRESPONSE;
  assert(root&&Object.keys(root).every(k=>['SUCCESS','PAYLOAD','OGS_RC'].includes(k))&&(root.OGS_RC===undefined||root.OGS_RC==='0'),'COLLECTOR_XML');
 }
 return {...pyramidsFields(raw,mappingHash,false,10,false,false,true),bonus:8};
}
