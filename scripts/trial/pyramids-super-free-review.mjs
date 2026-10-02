// Independent SFGT cash scope, with no source allowance. Natural trigger only.
import {pyramidsFreeSequence,pyramidsFreeReview,PYRAMIDS_FREE_SOURCE} from './pyramids-free-review.mjs';
import {parseXml,one,children} from './pearl-protocol.mjs';
export const PYRAMIDS_SUPER_FREE_EXTENSION=PYRAMIDS_FREE_SOURCE+'-pyramids-super-free-v1';
const need=(v,e)=>{if(!v)throw Error(e);};
export function pyramidsHasSuperFree(raw){return raw?.sourceKey===PYRAMIDS_FREE_SOURCE&&raw.steps?.some(s=>s.responsePayload.split('&').some(p=>p.startsWith('GSD=')&&p.slice(4).split('#').includes('SFGT~1')));}
export function pyramidsSuperFreeReview(raw){
 for(const step of raw.steps){
  const xml=parseXml(step.responseXml),success=one(xml,'SUCCESS'),payload=one(xml,'PAYLOAD');
  const rc=children(xml).filter(n=>n.tag==='OGS_RC');
  need(rc.length<=1&&rc.every(n=>children(n).length===0&&n.children.map(x=>x.text??'').join('')==='0'),'PYRAMIDS_SUPER_FREE_XML');
  need(xml.tag==='GDMRESPONSE'&&children(xml).length===2+rc.length&&children(success).length===0&&children(payload).length===0&&success.children.map(x=>x.text??'').join('').toLowerCase()==='true'&&payload.children.map(x=>x.text??'').join('')===step.responsePayload,'PYRAMIDS_SUPER_FREE_XML');
 }
 const sequence=pyramidsFreeSequence(raw,{superFree:true});
 return {...pyramidsFreeReview(raw,{superFree:true}),last:sequence.last};
}
