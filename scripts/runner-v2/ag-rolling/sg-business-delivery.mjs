import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {businessDocument,verifyBusinessPage} from './sg-business-document.mjs';
import {inspectExistingNextgen} from './sg-existing-business.mjs';
export const digest=v=>createHash('sha256').update(stable(v)).digest('hex');
export function assertCompleteBinding(state,receipt,binding){
 const p=receipt?.value;
 assert(state?.value?.status==='complete'&&stable(state.value.result)===stable(p)
  &&p.schema==='sg-ag-rolling-complete-v1'&&p.gameId===String(binding.gameId)&&p.trialId===binding.trialId
  &&p.queueId===binding.queueId&&p.campaignId===`sg_${binding.gameId}-${binding.queueId}`
  &&p.count===300000&&p.baseline===0&&p.fullReadback===true&&p.independentlyVerified===true
  &&p.selected.length===20&&p.selected.every(n=>n===15000)&&/^[a-f0-9]{64}$/.test(p.recordsHash),'SG_BUSINESS_COMPLETE_PROOF');
 return structuredClone(p);
}
export function missingDocuments(expected,actual){
 const wanted=new Map(expected.map(r=>[r._id,r])),seen=new Set();
 assert(wanted.size===expected.length,'SG_BUSINESS_ID_COLLISION');
 for(const r of actual){assert(wanted.has(r._id)&&!seen.has(r._id)&&stable(wanted.get(r._id))===stable(r),'SG_BUSINESS_CONTENT_CONFLICT');seen.add(r._id);}
 return expected.filter(r=>!seen.has(r._id));
}
// All target data is read before a write. A pending durable batch blocks all
// repeated writes; an uncertain ACK requires a separate ended-actor review.
export async function deliverPage({records,binding,campaignId,parser,sink,audit,batchId}){
 const expected=records.map(r=>businessDocument(r,binding,campaignId));
 const py=await parser.call({op:'business_documents',plan:sink.plan,binding,campaignId,records});
 verifyBusinessPage(records,py,binding,campaignId);
 assert(stable(expected)===stable(py),'SG_BUSINESS_JS_PY_MISMATCH');
 const existing=await sink.read(expected.map(d=>d._id));
 const missing=missingDocuments(expected,existing);
 if(missing.length){
  await audit.begin(batchId,{documents:missing,hash:digest(missing)});
  await sink.insert(missing); // Deliberately one attempt.
 }
 const saved=await sink.read(expected.map(d=>d._id));
 assert(missingDocuments(expected,saved).length===0,'SG_BUSINESS_READBACK_INCOMPLETE');
 if(missing.length)await audit.end(batchId,{hash:digest(missing),readbackVerified:true});
 return {count:expected.length,inserted:missing.length,documents:saved};
}
export async function verifyLegacyPage({documents,plan,binding,parser}){
 for(const d of documents){
  const oldBinding={...binding,rtp:d.rtp};
  const js=inspectExistingNextgen(d,plan,oldBinding);
  const py=(await parser.call({op:'existing_business',plan,binding:oldBinding,documents:[d]}))[0];
  const {recordHash,...fields}=js;
  assert(stable(fields)===stable(py),'SG_BUSINESS_LEGACY_JS_PY_MISMATCH');
 }
 return {verified:true,count:documents.length,newCaptureCredit:0};
}
