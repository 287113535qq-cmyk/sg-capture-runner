import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
export const cohortRepos=Object.freeze({primary:'zyzuoyang/sg-capture-runner',secondary:'287113535qq-cmyk/sg-capture-runner'});
export function inspectFederation(profile){
 const f=profile.federation;
 assert(f?.schema==='sg-ag-two-cohort-v1'&&f.lanesPerCohort===20&&f.totalLanes===40
  &&f.namespace==='primary'&&Object.keys(f).sort().join(',')==='assignments,lanesPerCohort,namespace,schema,totalLanes'
  &&Array.isArray(f.assignments)&&f.assignments.length===profile.payload.games.length,'SG_AG_FEDERATION_PROFILE');
 const seen=new Set();
 for(const [i,item] of f.assignments.entries()){
  assert(Object.keys(item).sort().join(',')==='cohort,gameId'&&item.gameId===profile.payload.games[i].gameId
   &&Object.hasOwn(cohortRepos,item.cohort)&&!seen.has(item.gameId),'SG_AG_COHORT_ASSIGNMENT');seen.add(item.gameId);
 }
 assert(['primary','secondary'].every(c=>f.assignments.some(a=>a.cohort===c)),'SG_AG_EMPTY_COHORT');
 return f;
}
export function cohortView(profile,repository){
 if(!profile.federation){assert(repository===cohortRepos.primary,'SG_AG_FEDERATION_REQUIRED');return {cohort:'primary',payload:profile.payload,manifest:profile.manifest};}
 const f=inspectFederation(profile),cohort=Object.keys(cohortRepos).find(c=>cohortRepos[c]===repository);
 assert(cohort,'SG_AG_COHORT_REPOSITORY');const ids=new Set(f.assignments.filter(a=>a.cohort===cohort).map(a=>a.gameId));
 return {cohort,payload:{...profile.payload,games:profile.payload.games.filter(g=>ids.has(g.gameId))},
  manifest:profile.manifest.filter(g=>ids.has(g.gameId))};
}
export const participantKey=profile=>'rolling-participant:'+profile.activation+':secondary';
export function inspectParticipant({profile,receipt,coordinatorRun,commit,run}){
 inspectFederation(profile);
 assert(receipt?.schema==='sg-ag-cohort-joined-v1'&&receipt.cohort==='secondary'&&receipt.repository===cohortRepos.secondary
  &&receipt.activation===profile.activation&&receipt.profileHash===hash(profile)&&receipt.queueId===profile.payload.queueId
  &&receipt.coordinatorRun===coordinatorRun&&receipt.commit===commit&&/^[0-9]+:1$/.test(receipt.run??'')
  &&receipt.run!==coordinatorRun&&(!run||receipt.run===run)&&receipt.assignmentHash===hash(profile.federation)
  &&receipt.sourceRequests===0,'SG_AG_PARTICIPANT_BINDING');return receipt;
}
export async function joinCohort({profile,store,transport,boundary,run,coordinatorRun,commit,checkPermit}){
 inspectFederation(profile);await boundary();await checkPermit();
 const hello=await transport.request('hello');
 assert(hello?.group==='secondary'&&hello.rollingNamespace==='primary'&&hello.database==='sg_capture_staging_v1'
  &&hello.gatewaySha256===profile.nativeGatewayHash&&hello.accessManifestHash===profile.nativeManifestHash,'SG_AG_SHARED_NATIVE_BINDING');
 assert(!await store.get('journal',participantKey(profile)),'SG_AG_COHORT_ALREADY_JOINED');
 const receipt={schema:'sg-ag-cohort-joined-v1',cohort:'secondary',repository:cohortRepos.secondary,run,coordinatorRun,commit,
  activation:profile.activation,profileHash:hash(profile),queueId:profile.payload.queueId,assignmentHash:hash(profile.federation),sourceRequests:0};
 await boundary();await checkPermit();await store.create('journal',participantKey(profile),receipt,{immutable:true});
 inspectParticipant({profile,receipt:(await store.get('journal',participantKey(profile)))?.value,coordinatorRun,commit,run});return receipt;
}
export function endedCohortJobs(jobs,{localLaneEnded=false}={}){
 assert(jobs?.total_count===jobs.jobs?.length&&jobs.total_count<100,'SG_AG_JOBS_TRUNCATED');
 const lanes=jobs.jobs.filter(j=>/^AG rolling lane ([1-9]|1[0-9]|20)$/.test(j.name));
 return lanes.length===20&&new Set(lanes.map(j=>j.name)).size===20
  &&lanes.every(j=>j.status==='completed'||j.name==='AG rolling lane 20'&&localLaneEnded);
}
// A revision keeps each existing game's cohort. Only reviewed games appended
// to the ordered payload receive a new assignment; task namespaces do not move.
export function resumeFederation({previous,payload}){
 if(!previous.federation)return undefined;
 const old=inspectFederation(previous),games=previous.payload.games;
 assert(payload.queueId===previous.payload.queueId&&payload.games.length>=games.length
  &&games.every((g,i)=>hash(g)===hash(payload.games[i])),'SG_AG_FEDERATION_PAYLOAD_CHANGED');
 const next=structuredClone(old),counts={primary:0,secondary:0};
 for(const row of next.assignments)counts[row.cohort]++;
 for(const game of payload.games.slice(games.length)){
  const cohort=counts.primary<=counts.secondary?'primary':'secondary';
  next.assignments.push({gameId:game.gameId,cohort});counts[cohort]++;
 }
 inspectFederation({payload,federation:next});return next;
}
export function inspectFederationRevision({previous,profile}){
 if(!previous.federation)return;
 assert(profile.federation&&hash(profile.federation)===hash(resumeFederation({previous,payload:profile.payload})),
  'SG_AG_PREVIOUS_COHORTS_CHANGED');
}
// Independent GH readback is required in addition to the sealed native end
// receipt. Neither a completed primary nor a copied participant ends a lane.
export async function verifyEndedFederation({previous,prior,receipt,store,readEnded,readEndedJobs}){
 if(!previous.federation)return null;
 inspectFederation(previous);
 assert(typeof readEnded==='function'&&typeof readEndedJobs==='function','SG_AG_FEDERATED_ENDED_READERS_REQUIRED');
 assert(prior?.schema==='sg-ag-rolling-permit-v1'&&prior.activation===previous.activation
  &&prior.profileHash===hash(previous)&&prior.queueId===previous.payload.queueId
  &&receipt?.schema==='sg-ag-rolling-window-ended-v1'&&receipt.activation===previous.activation
  &&receipt.profileHash===hash(previous)&&receipt.queueId===prior.queueId&&receipt.run===prior.run
  &&receipt.commit===prior.commit&&receipt.sourceRequests===0
  &&receipt.federationHash===hash(previous.federation),'SG_AG_FEDERATED_ENDED_RECEIPT');
 const participant=(await store.get('journal',participantKey(previous)))?.value;
 inspectParticipant({profile:previous,receipt:participant,coordinatorRun:prior.run,commit:prior.commit});
 assert(receipt.participant&&hash(participant)===hash(receipt.participant),'SG_AG_ENDED_PARTICIPANT_CHANGED');
 for(const [cohort,run] of [['primary',prior.run],['secondary',participant.run]]){
  const repository=cohortRepos[cohort],id=run.split(':')[0];
  const workflow=await readEnded(id,repository);
  assert(workflow?.id===Number(id)&&workflow.run_attempt===1&&workflow.status==='completed'
   &&workflow.head_branch==='main'&&workflow.head_sha===prior.commit&&workflow.event==='workflow_dispatch'
   &&workflow.path==='.github/workflows/trial-300k.yml','SG_AG_PREVIOUS_COHORT_ACTIVE');
  const jobs=await readEndedJobs(id,repository);
  assert(endedCohortJobs(jobs)&&jobs.jobs.every(j=>j.status==='completed'),'SG_AG_PREVIOUS_COHORT_JOBS_ACTIVE');
  const controls=cohort==='primary'?['ag-rolling-admit','ag-rolling-finalize']:['ag-rolling-join'];
  assert(controls.every(name=>jobs.jobs.filter(j=>j.name===name&&j.conclusion==='success').length===1)
   &&jobs.jobs.filter(j=>j.conclusion!=='skipped').every(j=>controls.includes(j.name)
    ||/^AG rolling lane ([1-9]|1[0-9]|20)$/.test(j.name)),'SG_AG_PREVIOUS_COHORT_CONTROL_FAILED');
 }
 return {primaryRun:prior.run,secondaryRun:participant.run,federationHash:hash(previous.federation),sourceRequests:0};
}
