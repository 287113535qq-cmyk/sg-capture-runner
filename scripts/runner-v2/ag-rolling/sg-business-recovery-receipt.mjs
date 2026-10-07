// A future generation may consume a separately reviewed recovery chain. This
// reader never turns the old unknown write into an ordinary completion.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const recoveryNativeHash='7bad6525fbc07040382f4e8fc766c7eb0b0abe1c3c33faddd43109d9ec24011a';
export const recoveryProposalHash='711b4a2092fbc9d4b7dea7603dc7752efbf1b3a9186513f78f3aa09861d37107';
const oldRoot='game:32547:'+recoveryNativeHash;
const root=oldRoot+':recovery:'+recoveryProposalHash,claim=oldRoot+':recovery-claim';
export const recoveryContinuationHash='1c26c68f6f8f4cd31c51e1008d6cfcc5031ad34cd66d153b43dd67c7340f921f';
const continuationRoot=oldRoot+':recovery-continuation:'+recoveryContinuationHash;
const priorOwner='independent-recovery-32547-1791365162472-3791091';
const priorAuditHashes=[
 [claim,'53b1de792feb03eae8276751fa12a1434a0f80ff4514ad3451c729015446c6bc'],
 [root+':validated','306602a6fafb61e3a782d028ffd33c33794a912976f052c3a03f5d3a3680a3e9']
];
const namespace=p=>p.auditCompleteKey===continuationRoot+':complete'
 ? {root:continuationRoot,claim:continuationRoot+':claim',continuation:true}
 : {root,claim,continuation:false};
export function isRecoveryReceiptReference(gameId,p){
 return gameId==='32547'&&p?.kind==='recovery-chained'
  &&Object.keys(p).sort().join(',')==='auditCompleteKey,auditDocumentHash,evidenceFile,evidenceSha256,kind,nativeReceiptHash'
  &&p.nativeReceiptHash===recoveryNativeHash&&[root+':complete',continuationRoot+':complete'].includes(p.auditCompleteKey)&&hex(p.auditDocumentHash)
  &&hex(p.evidenceSha256)&&p.evidenceFile===`config/ag-business-recovery-${p.evidenceSha256}.json`;
}
function expectedNewKeys({root,claim}){
 const keys=[claim,root+':validated',root+':resolution:11:100',root+':complete'];
 for(let worker=11;worker<20;worker++)for(let end=worker===11?200:100;end<=15000;end+=100)
  keys.push(root+':intent:'+worker+':'+end,root+':ack:'+worker+':'+end);
 return keys.sort();
}
export function inspectRecoveryReceiptEvidence({proof,bytes,binding,game,native}){
 assert(isRecoveryReceiptReference(game.gameId,proof),'SG_AG_RECOVERY_REFERENCE');
 assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=4*1024*1024
  &&createHash('sha256').update(bytes).digest('hex')===proof.evidenceSha256,'SG_AG_RECOVERY_EVIDENCE_BYTES');
 const e=JSON.parse(bytes),done=e.receipt;
 const ns=namespace(proof);
 assert(e.schema==='sg-ag-recovery-receipt-evidence-v1'&&e.gameId==='32547'&&e.kind==='recovery-chained'
  &&e.complete===true&&e.oldOutcomeUnknownRetained===true&&e.mayReplayOldIntent===false
  &&e.independentPostExitVerified===true&&hex(e.independentPostExitFileSha256)&&hex(e.supervisedOutcomeFileSha256)
  &&e.auditCompleteKey===proof.auditCompleteKey&&e.auditDocumentHash===proof.auditDocumentHash
  &&e.nativeReceiptHash===proof.nativeReceiptHash&&hash(native)===proof.nativeReceiptHash,'SG_AG_RECOVERY_EVIDENCE_BINDING');
 assert(String(binding.gameId)==='32547'&&done?.schema==='sg-ag-final-business-recovery-complete-v1'
  &&done.gameId==='32547'&&done.database===binding.database&&done.queueId===binding.queueId
  &&native.queueId===binding.queueId&&native.trialId===binding.trialId&&native.campaignId===game.campaignId
  &&native.count===300000&&native.fullReadback===true&&native.independentlyVerified===true
  &&done.sourceProofHash===proof.nativeReceiptHash&&done.sourceRecordsHash===native.recordsHash
  &&done.recoveryClaimKey===ns.claim&&done.recoveryRootKey===ns.root&&done.proposalHash===recoveryProposalHash
  &&/^independent-recovery-32547-\d+-\d+$/.test(done.recoveryOwner)
  &&done.oldOwner!==done.recoveryOwner&&hex(done.oldRootHash)
  &&done.oldResultFileSha256==='a23acb908bf7d5a492e4a981b03442596e8f09fdf675d92f63a7c5f44b8300d2'
  &&done.reviewEvidenceHash==='49a7aff0287676646807f7790a85e4fb5eb6d1b49d3eb997ec622bff2825223e'
  &&done.campaignCount===300000&&done.businessCount===300100&&done.originalCount===100
  &&done.newInserted===134900&&done.retainedTargetCount===165100&&done.sourcePasses===3
  &&['fullReadback','independentlyVerified','originalUnchanged','targetReadbackFull','oldOutcomeUnknownRetained'].every(k=>done[k]===true)
  &&done.sourceRequests===0&&done.nativeWrites===0,'SG_AG_RECOVERY_FINAL_RECEIPT');
 const valid=rows=>Array.isArray(rows)&&rows.every(r=>Array.isArray(r)&&r.length===2&&typeof r[0]==='string'&&hex(r[1]))
  &&new Set(rows.map(r=>r[0])).size===rows.length;
 assert(valid(e.oldAuditHashes)&&e.oldAuditHashes.length===3504&&valid(e.newAuditHashes)&&e.newAuditHashes.length===2702
  &&e.oldAuditHashes.every(([k])=>k===oldRoot||k.startsWith(oldRoot+':')&&!k.includes(':recovery')&&!k.endsWith(':complete'))
  &&stable(e.newAuditHashes.map(([k])=>k).sort())===stable(expectedNewKeys(ns))
  &&e.oldAuditHashes.find(([k])=>k===oldRoot)?.[1]===done.oldRootHash
  &&e.newAuditHashes.find(([k])=>k===proof.auditCompleteKey)?.[1]===proof.auditDocumentHash
  &&hash(e.oldAuditHashes.slice().sort((a,b)=>a[0].localeCompare(b[0])))===done.oldAuditHash
  &&hash(e.newAuditHashes.filter(([k])=>k!==proof.auditCompleteKey).sort((a,b)=>a[0].localeCompare(b[0])))===done.newAuditHash,
  'SG_AG_RECOVERY_FULL_CHAIN_INVENTORY');
 if(ns.continuation){
  assert(e.failedRecoveryAuditRetained===true&&e.continuationEvidenceHash===recoveryContinuationHash
   &&done.continuationEvidenceHash===recoveryContinuationHash&&done.failedRecoveryAuditRetained===true
   &&done.priorRecoveryOwner===priorOwner&&done.recoveryOwner!==priorOwner&&done.priorRecoveryTargetWrites===0
   &&done.priorRecoveryOutcomeFileSha256==='af43738e5a7fa985af6663bfd91f313d83a50edfeeeff5c3e9b432ddf9879ecb'
   &&valid(e.priorAuditHashes)&&stable(e.priorAuditHashes)===stable(priorAuditHashes)
   &&done.priorRecoveryAuditHash===hash(priorAuditHashes),'SG_AG_RECOVERY_CONTINUATION_PREDECESSOR');
 }else assert(e.priorAuditHashes===undefined&&e.continuationEvidenceHash===undefined&&done.continuationEvidenceHash===undefined,
  'SG_AG_RECOVERY_CONTINUATION_NAMESPACE_REQUIRED');
 return e;
}
export async function readReviewedRecoveryReceipt({proof,bytes,binding,game,native,readExact,guard=async()=>{}}){
 const e=inspectRecoveryReceiptEvidence({proof,bytes,binding,game,native});
 const ns=namespace(proof),incompleteKeys=[oldRoot+':complete',...(ns.continuation?[root+':complete']:[])];
 assert(typeof readExact==='function'&&typeof guard==='function','SG_AG_RECOVERY_READ_PORT');
 const exact=async keys=>{
  await guard();const rows=await readExact(keys);await guard();
  assert(Array.isArray(rows)&&rows.length===keys.length&&rows.every((r,i)=>r===null||r?._id===keys[i]),'SG_AG_RECOVERY_EXACT_READ');
  return rows;
 };
 assert((await exact(incompleteKeys)).every(d=>d===null),'SG_AG_RECOVERY_OLD_UNKNOWN_CHANGED');
 let savedComplete=null;
 for(const [kind,entries] of [['old',e.oldAuditHashes],...(ns.continuation?[['prior',e.priorAuditHashes]]:[]),['new',e.newAuditHashes]]){
  for(let offset=0;offset<entries.length;offset+=100){
   const batch=entries.slice(offset,offset+100),docs=await exact(batch.map(([k])=>k));
   for(let i=0;i<batch.length;i++){
    const d=docs[i];assert(d?.immutable===true&&hash(d)===batch[i][1],'SG_AG_RECOVERY_AUDIT_CHANGED');
    if(kind==='old')assert(d.owner===e.receipt.oldOwner,'SG_AG_RECOVERY_OLD_OWNER');
    else assert(d.schema==='sg-current-recovery-audit-v1'&&d.owner===(kind==='prior'?priorOwner:e.receipt.recoveryOwner)
     &&d.oldOwner===e.receipt.oldOwner&&d.oldClaimKey===oldRoot&&d.oldRootHash===e.receipt.oldRootHash
     &&d.proposalHash===recoveryProposalHash,'SG_AG_RECOVERY_NEW_OWNER');
    if(d._id===proof.auditCompleteKey){assert(stable(d.value?.done)===stable(e.receipt),'SG_AG_RECOVERY_RECEIPT_CHANGED');savedComplete=d;}
   }
  }
 }
 const [last,...oldAgain]=await exact([proof.auditCompleteKey,...incompleteKeys]);
 assert(savedComplete&&stable(last)===stable(savedComplete)&&oldAgain.every(d=>d===null),'SG_AG_RECOVERY_FINAL_RACE');
 return {kind:'recovery-chained',complete:true,receipt:structuredClone(e.receipt),oldOutcomeUnknownRetained:true,mayReplayOldIntent:false};
}
