import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
// A deferral only removes source eligibility. It never changes quotas, old
// task records, accepted prefixes, write claims or completion evidence.
export function inspectSourceDeferrals(profile,readBytes){
 const d=profile.sourceDeferrals;if(d===undefined)return new Set();
 assert(profile.resume&&d?.schema==='sg-ag-source-deferrals-v1'
  &&Object.keys(d).sort().join(',')==='evidenceFile,evidenceSha256,games,previousActivation,previousRun,schema'
  &&d.previousActivation===profile.resume.previousActivation&&d.previousRun===profile.resume.previousRun
  &&hex(d.evidenceSha256)&&d.evidenceFile===`config/ag-source-deferrals-${d.evidenceSha256}.json`
  &&Array.isArray(d.games)&&d.games.length>0&&d.games.length<=profile.payload.games.length,'SG_SOURCE_DEFERRAL_POLICY');
 const ids=new Set();for(const row of d.games){
  const entry=profile.manifest.find(g=>g.gameId===row.gameId);
  assert(Object.keys(row).sort().join(',')==='gameId,planHash,reason'&&/^32\d{3}$/.test(row.gameId)
   &&hex(row.planHash)&&entry?.planHash===row.planHash&&profile.payload.games.some(g=>g.gameId===row.gameId)
   &&row.reason==='OWN_UNRESOLVED_FEATURE_FAULT'&&!ids.has(row.gameId)
   &&!profile.fullAgControl?.completedBusinessReceipts?.[row.gameId],'SG_SOURCE_DEFERRAL_GAME');ids.add(row.gameId);
 }
 if(readBytes){const bytes=readBytes(d.evidenceFile);assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=1024*1024
  &&createHash('sha256').update(bytes).digest('hex')===d.evidenceSha256,'SG_SOURCE_DEFERRAL_EVIDENCE_HASH');
  const e=JSON.parse(bytes);assert(e.schema==='sg-ag-source-deferral-evidence-v1'&&e.previousActivation===d.previousActivation
   &&e.previousRun===d.previousRun&&e.sourceJobsEnded===true&&hex(e.endedProofHash)
   &&e.endedProofHash===profile.resume.endedProofHash&&hash(e.games)===hash(d.games)
   &&Array.isArray(e.origins)&&e.origins.length>0&&e.origins.every(o=>hex(o.sha256)&&typeof o.file==='string')
   &&e.sourceRequests===0&&e.databaseWrites===0&&e.completedCredit===0,'SG_SOURCE_DEFERRAL_EVIDENCE');
 }
 return ids;
}
export function sourceEligibleView(profile,view){
 const excluded=inspectSourceDeferrals(profile),games=view.payload.games.filter(g=>!excluded.has(g.gameId));
 return {...view,payload:{...view.payload,games},manifest:view.manifest.filter(g=>!excluded.has(g.gameId)),
  deferred:view.payload.games.filter(g=>excluded.has(g.gameId)).map(g=>g.gameId)};
}
