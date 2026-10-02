import assert from 'node:assert/strict';
import {preparedCampaignSelector} from './work-line-events.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

// A reviewed publication narrows the existing online ready set. It cannot
// activate needs-adapter games, replace an applied plan, or create permission.
// Use content hashes instead of directory mtimes to fence reusable evidence.
export function publishedPreparedSelector({publication,plans,readEvidence}){
 assert(publication?.schema==='sg-prepared-publication-v1'&&publication.sourceAllowance===0
  &&publication.inventory?.sourceAllowance===0&&typeof readEvidence==='function','PREPARED_PUBLICATION_SCOPE');
 return preparedCampaignSelector(publication.inventory,{verifyProof:async(proof,{group,gameId})=>{
  const binding=publication.bindings?.[String(gameId)],plan=plans[gameId];
  if(!binding||!plan||binding.group!==group||binding.planHash!==hash(plan)
   ||binding.proofHash!==hash(proof))return false;
  for(const [gate,item] of Object.entries(proof.gates)){
   const ref=binding.evidence?.[gate];
   assert(typeof ref==='string'&&/^config\/preparation-evidence\/[a-f0-9]{64}\.json$/.test(ref),'PREPARED_EVIDENCE_PATH');
   const value=await readEvidence(ref);
   if(hash(value)!==item.evidenceHash||value.gameId!==gameId||value.revisionHash!==proof.revisionHash
    ||value.gate!==gate||value.verified!==true)return false;
  }
  return true;
 }});
}
