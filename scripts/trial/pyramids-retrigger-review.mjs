// Separate +10 cash retrigger validation. No source authorization.
import {pyramidsFreeSequence,pyramidsFreeReview,PYRAMIDS_FREE_SOURCE} from './pyramids-free-review.mjs';
import {parseXml,one,children} from './pearl-protocol.mjs';
const need=(v,e)=>{if(!v)throw Error(e);};
export const PYRAMIDS_RETRIGGER_EXTENSION=PYRAMIDS_FREE_SOURCE+'-pyramids-ten-retrigger-v1';
export function pyramidsHasRetrigger(raw){
 return raw?.sourceKey===PYRAMIDS_FREE_SOURCE&&raw.steps?.length>0&&new URLSearchParams(raw.steps[0].responsePayload).get('TFG')==='10'
  &&raw.steps.slice(1).some(s=>/^\d+$/.test(new URLSearchParams(s.responsePayload).get('TFG')??'')&&Number(new URLSearchParams(s.responsePayload).get('TFG'))>10);
}
export function reviewPyramidsRetrigger(raw){
 for(const step of raw.steps){
  const xml=parseXml(step.responseXml),success=one(xml,'SUCCESS'),payload=one(xml,'PAYLOAD');
  const rc=children(xml).filter(n=>n.tag==='OGS_RC');
  need(rc.length<=1&&rc.every(n=>children(n).length===0&&n.children.map(x=>x.text??'').join('')==='0'),'PYRAMIDS_RETRIGGER_XML');
  need(xml.tag==='GDMRESPONSE'&&children(xml).length===2+rc.length&&children(success).length===0&&children(payload).length===0&&success.children.map(x=>x.text??'').join('').toLowerCase()==='true'&&payload.children.map(x=>x.text??'').join('')===step.responsePayload,'PYRAMIDS_RETRIGGER_XML');
 }
 const sequence=pyramidsFreeSequence(raw,{retriggerTen:true});
 return {...pyramidsFreeReview(raw,{retriggerTen:true}),last:sequence.last};
}
