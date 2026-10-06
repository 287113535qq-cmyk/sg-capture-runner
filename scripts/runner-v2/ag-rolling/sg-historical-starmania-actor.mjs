import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {digest,missingDocuments} from './sg-business-delivery.mjs';
import {assertOwnHistoricalAdmission,assertOwnHistoricalSourceEvidence,readOwnHistoricalPages,
 deliverOwnHistoricalPage,verifyOwnHistoricalTargetPage} from './sg-historical-starmania-core.mjs';
import {candidateDocument} from './sg-historical-starmania-document.mjs';

export const HISTORICAL_BRANCH='sg-business-historical-32737-20261006';
export const HISTORICAL_USER='sg_simulate_historical_32737_v1';
export function assertOwnHistoricalClosedWindow(value){
 assert(value?.primaryRun==='37314031299:1'&&value.secondaryRun==='37321135064:1'
  &&value.sourceRequests===0&&value.closure?.sourceRequests===0
  &&/^[0-9]+:1$/.test(value.closure?.run??'')&&/^[a-f0-9]{40}$/.test(value.closure?.commit??''),
  'HISTORICAL_ACTUAL_RECOVERED_FEDERATION_REQUIRED');return value;
}
export function parseHistoricalPrivateCredentials(bytes){
 assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<16384,'HISTORICAL_PRIVATE_CREDENTIALS_REJECTED');
 let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{throw Error('HISTORICAL_PRIVATE_CREDENTIALS_REJECTED');}
 assert(value&&Object.keys(value).sort().join(',')==='ghToken,password'
  &&typeof value.password==='string'&&value.password.length>0&&typeof value.ghToken==='string'&&value.ghToken.length>0,
  'HISTORICAL_PRIVATE_CREDENTIALS_REJECTED');return value;
}
export const MINIMUM_PRIVILEGES=Object.freeze([
 {resource:{db:'sg_starmania',collection:'simulate'},actions:['find','insert','update']},
 {resource:{db:'sg_capture_staging_v1',collection:'business_delivery_v1'},actions:['find','insert']},
 ...['official_rounds','capture_state_v2','capture_journal_v2'].map(collection=>({resource:{db:'sg_capture_staging_v1',collection},actions:['find']}))
]);
const canonicalPrivileges=p=>p.map(v=>({resource:v.resource,actions:[...v.actions].sort()})).sort((a,b)=>stable(a).localeCompare(stable(b)));
export function assertOwnHistoricalActor(env,execution,manifestBytesHash){
 assert(env.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Linux'&&env.RUNNER_ENVIRONMENT==='github-hosted'
  &&env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner'&&env.GITHUB_REF==='refs/heads/'+HISTORICAL_BRANCH
  &&env.GITHUB_JOB==='ag-rolling-business-delivery'&&env.GITHUB_RUN_ATTEMPT==='1'
  &&/^[0-9]+$/.test(env.GITHUB_RUN_ID??'')&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')
  &&env.SG_BUSINESS_GAME_IDS==='32737'&&env.SG_TRIAL_DEMO_CONFIG===undefined,'HISTORICAL_EXCLUSIVE_ACTOR');
 assert(execution?.schema==='sg-historical-starmania-execution-v1'&&execution.enabled===true
  &&execution.branch===HISTORICAL_BRANCH&&stable(execution.gameIds)===stable(['32737'])
  &&execution.manifestSha256===manifestBytesHash,'HISTORICAL_OWN_EXECUTION_ADMISSION_REQUIRED');
 assert(execution.permission?.username===HISTORICAL_USER&&execution.permission.sshAccount==='sghistorical32737'
  &&execution.permission.grantKey==='primary/historical-delivery-permission:32737:'+manifestBytesHash
  &&execution.window?.run==='37314031299:1'&&execution.window.queueId==='rolling-20261003225355-f0d07c84'
  &&/^[a-f0-9]{64}$/.test(execution.window.endedProofHash??''),'HISTORICAL_OWN_WINDOW_AND_SCOPE_REQUIRED');
 return execution;
}
export function assertOwnHistoricalGrant(grant,execution,env){
 const v=grant?.value;
 assert(grant?._id===execution.permission.grantKey&&v?.schema==='sg-historical-starmania-permission-v1'
  &&v.gameId===32737&&v.username===HISTORICAL_USER&&v.minimumPermissionApproved===true&&v.immutable===true
  &&v.branch===HISTORICAL_BRANCH&&v.manifestSha256===execution.manifestSha256
  &&v.privilegesHash===digest(canonicalPrivileges(MINIMUM_PRIVILEGES))
  &&v.sshAccount==='sghistorical32737'&&v.rtpFileSha256==='9339f7fe9b36236d6f8d5271e67612497c48b3681e4b03050e7d61562cb8bc4b',
  'HISTORICAL_MINIMUM_GRANT_REQUIRED');
 assert(v.privateEvidence?.mode==='inherited-fd3'&&v.privateEvidence.gameId===32737
  &&v.privateEvidence.run===env.GITHUB_RUN_ID+':1'&&v.privateEvidence.commit===env.GITHUB_SHA
  &&v.privateEvidence.privateOnly===true,'HISTORICAL_PROTECTED_PRIVATE_EVIDENCE_REQUIRED');
 if(execution.privateProvider!==undefined){
  const p=execution.privateProvider;
  assert(p.schema==='sg-historical-private-provider-v1'&&p.enabled===true
   &&p.endpoint==='https://52.87.94.113/sg-historical-32737'
   &&/^[a-f0-9]{64}$/.test(p.tlsSpkiSha256??'')&&/^[a-f0-9]{64}$/.test(p.signingPublicKeySha256??'')
   &&stable(v.privateProvider)===stable({schema:p.schema,endpoint:p.endpoint,tlsSpkiSha256:p.tlsSpkiSha256,
    signingPublicKeySha256:p.signingPublicKeySha256,privateCredentials:true,privateEvidence:true,
    gameId:32737,run:env.GITHUB_RUN_ID+':1',commit:env.GITHUB_SHA,attempt:1}),
   'HISTORICAL_PROTECTED_OWN_PROVIDER_REQUIRED');
 }
 assert(execution.ssh?.host==='52.87.94.113'&&v.ssh?.nativeAccount==='sgcapture'&&v.ssh.historicalAccount==='sghistorical32737'
  &&v.ssh.resourceOnly===true&&v.ssh.rtpHashOnly===true
  &&v.ssh.hostKeyFingerprint===execution.ssh.hostKeyFingerprint&&v.ssh.knownHostsSha256===execution.ssh.knownHostsSha256
  &&v.ssh.nativeIdentityFingerprint===execution.ssh.nativeIdentityFingerprint
  &&v.ssh.historicalIdentityFingerprint===execution.ssh.historicalIdentityFingerprint,
  'HISTORICAL_APPROVED_SSH_IDENTITY_READBACK_REQUIRED');
 const linux=v.linux;
 assert(linux?.commit===env.GITHUB_SHA&&String(linux.run)===env.SG_BUSINESS_LINUX_RUN&&linux.joinedCommands===14
  &&linux.sealedReceipts?.length===9&&new Set(linux.sealedReceipts.map(r=>r.mailbox)).size===9
  &&linux.sealedReceipts.every(r=>r.received===true&&r.commit===env.GITHUB_SHA&&r.run===linux.run
   &&/^[a-f0-9]{64}$/.test(r.receiptHash??'')),'HISTORICAL_OWN_SEALED_LINUX_GRANT_REQUIRED');
 return v;
}
export function assertOwnHistoricalPrivileges(status,permission){
 const a=status?.authInfo;
 assert(a?.authenticatedUsers?.length===1&&a.authenticatedUsers[0].user===HISTORICAL_USER
  &&a.authenticatedUsers[0].db==='admin'&&permission.username===HISTORICAL_USER
  &&Array.isArray(a.authenticatedUserPrivileges)
  &&stable(canonicalPrivileges(a.authenticatedUserPrivileges))===stable(canonicalPrivileges(MINIMUM_PRIVILEGES)),
  'HISTORICAL_MINIMUM_PRIVILEGE_READBACK_REQUIRED');
}
export async function createOwnHistoricalImmutable({audit,key,value,guard,code='HISTORICAL_IMMUTABLE_FULL_READBACK'}){
 assert(value?.immutable===true&&!Object.hasOwn(value,'_id'),'HISTORICAL_IMMUTABLE_INTENT_SHAPE');
 const expected={_id:key,...structuredClone(value)};
 await guard();await audit.create(key,structuredClone(value));
 assert(stable(await audit.read(key))===stable(expected),code);
 return expected;
}
export async function retagOwnHistoricalOriginal({document,rtp,target,audit,key,guard}){
 const before=await target.readOne(document._id);
 assert(stable(before)===stable(document),'HISTORICAL_ORIGINAL_CHANGED');
 if(stable(document.rtp)===stable(rtp))return false;
 assert(!await audit.read(key+':intent')&&!await audit.read(key+':ack'),'HISTORICAL_EXISTING_RTP_INTENT_REVIEW_REQUIRED');
 const after={...document,rtp:structuredClone(rtp)};
 await createOwnHistoricalImmutable({audit,key:key+':intent',value:{before:document,afterRtp:rtp,immutable:true},guard,code:'HISTORICAL_RTP_INTENT_READBACK'});
 await guard();const result=await target.casRtp(document._id,document.rtp,rtp);
 assert(result.matchedCount===1&&result.modifiedCount===1,'HISTORICAL_RTP_EXACT_CAS');
 const saved=await target.readOne(document._id);
 assert(stable(saved)===stable(after),'HISTORICAL_ORIGINAL_FULL_READBACK');
 await createOwnHistoricalImmutable({audit,key:key+':ack',value:{readbackHash:digest(saved),immutable:true},guard,code:'HISTORICAL_RTP_ACK_READBACK'});return true;
}

// A production orchestrator with read-only source and narrow write adapters.
// Every operation is awaited exactly once. A prior claim or unknown outcome ends this actor.
export async function deliverOwnHistoricalGame({manifest:m,owner,native,target,audit,verifyNative,independentConvert,verifyOriginals,guard,currentRtp,emit=()=>{}}){
 assertOwnHistoricalAdmission(m);
 assert(/^[0-9]+:1:historical-32737$/.test(owner),'HISTORICAL_ACTOR_OWNER');
 const claim='historical-game:32737:'+m.receiptValueHash;
 await guard();const before=await native.evidence();
 assertOwnHistoricalSourceEvidence({...before,manifest:m,now:Date.now()});
 await currentRtp();assert(!await audit.anyPrefix(claim),'HISTORICAL_EXISTING_ACTOR_REVIEW_REQUIRED');
 assert(await target.count()===150,'HISTORICAL_ORIGINAL_COUNT_CHANGED');
 const originals=await target.originals();
 assert(originals.length===150&&new Set(originals.map(d=>d._id)).size===150
  &&originals.every((d,i)=>/^[a-f0-9]{24}$/.test(d._id)&&(i===0||d._id>originals[i-1]._id)),
  'HISTORICAL_ORIGINAL_IDENTITY');
 const originalHash=createHash('sha256');for(const d of originals)originalHash.update(stable(d)+'\n');
 assert(originalHash.digest('hex')===m.originalRecordsHash,'HISTORICAL_ORIGINAL_FULL_HASH_CHANGED');
 await verifyOriginals(originals);
 const each=visit=>readOwnHistoricalPages({source:native.source,manifest:m,originalIds:originals.map(d=>d._id),verify:verifyNative,visit});
 const fullContentHash=createHash('sha256'),candidateHash=createHash('sha256');
 // Full native, independent candidate and all target IDs are examined before the first intent.
 const preflight=await each(async rows=>{
  const expected=rows.map(r=>candidateDocument(r,m.binding,m.plan));
  assert(stable(expected)===stable(await independentConvert(rows)),'HISTORICAL_BUSINESS_JS_PY_MISMATCH');
  assert((await target.read(expected.map(d=>d._id))).length===0,'HISTORICAL_UNCLAIMED_TARGET_RECORDS');
  for(const r of rows)fullContentHash.update(stable(r)+'\n');
  for(const d of expected)candidateHash.update(stable(d)+'\n');
 });
 assert(fullContentHash.digest('hex')===m.fullSourceContentHash&&candidateHash.digest('hex')===m.candidateBusinessHash,
  'HISTORICAL_FULL_CONTENT_AND_CANDIDATE_HASH');
 assertOwnHistoricalSourceEvidence({...await native.evidence(),manifest:m,now:Date.now()});
 await currentRtp();await guard();
 assert(!await audit.anyPrefix(claim)&&await target.count()===150,'HISTORICAL_PREFLIGHT_RACE');
 await createOwnHistoricalImmutable({audit,key:claim,value:{owner,manifestHash:digest(m),proofHash:m.receiptValueHash,status:'validating',immutable:true},guard,code:'HISTORICAL_CLAIM_READBACK'});
 for(let n=0;n<originals.length;n+=100){
  const documents=originals.slice(n,n+100),key=claim+':backup:'+n;
  await createOwnHistoricalImmutable({audit,key,value:{owner,documents,documentsHash:digest(documents),immutable:true},guard,code:'HISTORICAL_BACKUP_FULL_READBACK'});
 }
 await createOwnHistoricalImmutable({audit,key:claim+':validated',value:{owner,originalCount:150,originalHash:m.originalRecordsHash,...preflight,immutable:true},guard});
 let retagged=0;for(const document of originals)retagged+=Number(await retagOwnHistoricalOriginal({document,rtp:m.binding.rtp,target,audit,key:claim+':rtp:'+document._id,guard}));
 let inserted=0,written=0;
 const batchAudit={existing:async id=>Boolean(await audit.read(claim+':intent:'+id)||await audit.read(claim+':ack:'+id)),
  begin:async(id,v)=>createOwnHistoricalImmutable({audit,key:claim+':intent:'+id,value:{owner,...v,immutable:true},guard,code:'HISTORICAL_INTENT_FULL_READBACK'}),
  end:async(id,v)=>createOwnHistoricalImmutable({audit,key:claim+':ack:'+id,value:{owner,...v,immutable:true},guard,code:'HISTORICAL_ACK_READBACK'})};
 const sink={read:target.read,insert:async docs=>{await guard();await target.insert(docs);}};
 const delivered=await each(async(rows,range)=>{
  const result=await deliverOwnHistoricalPage({records:rows,manifest:m,independentConvert,sink,audit:batchAudit,batchId:range.firstSequence+':'+range.lastSequence});
  inserted+=result.inserted;written+=result.count;
  if(written%15000===0||written===m.nativeTarget)emit({gameId:32737,verifiedAndWritten:written,sourceRequests:0});
 });
 assert(inserted===299850&&written===299850&&delivered.recordsHash===m.recordsHash,'HISTORICAL_DELIVERY_INCOMPLETE');
 let readback=0;const businessHash=createHash('sha256');
 await each(async rows=>{const saved=await verifyOwnHistoricalTargetPage({records:rows,manifest:m,independentConvert,read:target.read});
  for(const d of saved)businessHash.update(stable(d)+'\n');readback+=saved.length;});
 assert(readback===299850&&businessHash.digest('hex')===m.candidateBusinessHash,'HISTORICAL_FULL_TARGET_HASH');
 const afterOriginals=await target.read(originals.map(d=>d._id));
 assert(missingDocuments(originals.map(d=>({...d,rtp:m.binding.rtp})),afterOriginals).length===0,'HISTORICAL_ALL_ORIGINALS_READBACK');
 assert(await target.countHistorical()===299850&&await target.count()===300000,'HISTORICAL_FINAL_COUNTS');
 const after=await native.evidence();assertOwnHistoricalSourceEvidence({...after,manifest:m,now:Date.now()});
 assert(stable(after)===stable(before),'HISTORICAL_SOURCE_METADATA_CHANGED');
 await currentRtp();await guard();
 const done={schema:'sg-historical-starmania-complete-v1',gameId:32737,database:m.database,trialId:m.trialId,
  businessCount:300000,campaignCount:299850,existingCount:150,retagged,inserted,sourceRecordsHash:m.recordsHash,
  businessRecordsHash:m.candidateBusinessHash,originalRecordsHash:m.originalRecordsHash,sourceProofHash:m.receiptValueHash,
  fullReadback:true,independentlyVerified:true,sourceRequests:0,newCaptureCredit:0};
 await createOwnHistoricalImmutable({audit,key:claim+':complete',value:{owner,value:done,immutable:true},guard,code:'HISTORICAL_COMPLETE_READBACK'});
 emit(done);return done;
}
