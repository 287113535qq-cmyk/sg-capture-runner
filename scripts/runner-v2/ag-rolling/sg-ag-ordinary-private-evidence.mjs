import assert from 'node:assert/strict';
import {digest} from './sg-business-delivery.mjs';
import {createPrivateControlWriter} from './sg-ag-private-control.mjs';
export function createOrdinaryPrivateEvidence({persist,owner,claimId,gameId='32529'}){
 assert(typeof owner==='string'&&/^game:32529:[a-f0-9]{64}$/.test(claimId),'SG_AG_ORDINARY_EVIDENCE_SCOPE');
 let poisoned=false,final=false;const pages=new Set();
 const save=value=>{
  assert(!poisoned&&!final,'SG_AG_ORDINARY_EVIDENCE_CONSUMED');poisoned=true;
  const full=persist('own-control-state',structuredClone(value));
  assert(!full?.then&&full?.fullReadback&&full.durable&&full.privateOnly&&full.valueHash===digest(value),'SG_AG_ORDINARY_EVIDENCE_FULL_DURABLE_ACK');
  poisoned=false;return {...full,valueHash:digest(value)};
 };
 return {async appendAndReadback(value){
  assert(value?.owner===owner&&value.claimId===claimId&&value.phase==='delivered-page'&&Array.isArray(value.source)&&Array.isArray(value.target)
   &&value.source.length===100&&value.target.length===100&&Number.isInteger(value.worker)&&value.worker>=0&&value.worker<20
   &&Number.isInteger(value.end)&&value.end>=100&&value.end<=15000&&value.end%100===0,'SG_AG_ORDINARY_EVIDENCE_FULL_PAGE');
  const id=value.worker+':'+value.end;assert(!pages.has(id),'SG_AG_ORDINARY_EVIDENCE_PAGE_ALREADY_SAVED');pages.add(id);return save(value);
 },async writeAndReadback(value){
  assert(value?.owner===owner&&value.claimId===claimId&&value.complete?.gameId===gameId&&value.complete.campaignCount===300000
   &&value.complete.fullReadback&&value.complete.independentlyVerified&&value.complete.originalUnchanged&&pages.size===3000,'SG_AG_ORDINARY_EVIDENCE_ALL_300000_PAGES_REQUIRED');
  const ack=save(value);final=true;return {...ack,fullEnvelopeHash:ack.valueHash,valueHash:digest(value.complete)};
 },get finalAckReceived(){return final;}};
}
export function openOrdinaryPrivateEvidence(options){
 return createOrdinaryPrivateEvidence({...options,persist:createPrivateControlWriter({...options,context:{...options.context,purpose:'full-ordinary-source-target-and-final-proof'}})});
}
