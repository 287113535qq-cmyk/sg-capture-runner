// Separate offline +10 cash retrigger scope. No source authorization.
import {pyramidsFreeSequence,pyramidsFreeReview} from './pyramids-free-review.mjs';
import {parseXml,one,children} from './pearl-protocol.mjs';
const need=(v,e)=>{if(!v)throw Error(e);};
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
