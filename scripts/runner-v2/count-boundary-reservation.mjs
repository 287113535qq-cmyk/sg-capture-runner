import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkCountPeerEvidence,checkCountPeerDescriptor} from './count-peer-boundary.mjs';
export const reservationSource=Object.freeze({run:'36858094410:1',commit:'fcfa71130cc473d4faadd5abcdbf77de61688241',
 repository:'zyzuoyang/sg-capture-runner',trialId:'sg_r1_20261001_32799',ref:'runtime-rhino-ag-dispatchfix-20261001'});
export function checkReservationProfile(profile,now=Date.now()){
 const peer=profile?.sourcePeer;
 checkCountPeerDescriptor(peer,'secondary');
 assert(profile?.schema==='sg-count-boundary-reservation-profile-v1'&&profile.purpose==='session-canary-v1'
  &&peer?.run===reservationSource.run&&peer.commit===reservationSource.commit&&peer.repository===reservationSource.repository
  &&peer.trialId===reservationSource.trialId&&peer.group==='primary'&&peer.gameId===32799&&peer.lanesPerHost===2
  &&profile.sourceRequests===0&&profile.newBetAllowance===0&&/^[a-f0-9]{64}$/.test(profile.sourcePermitHash??'')
  &&Number.isSafeInteger(profile.createdAt)&&profile.createdAt<=now&&Number.isSafeInteger(profile.expiresAt)&&profile.expiresAt>profile.createdAt&&now<profile.expiresAt&&profile.expiresAt-profile.createdAt<=7200000,
 'BOUNDARY_RESERVATION_PROFILE');return peer;
}
export async function reservationIdentity({read,transport,profile,now=Date.now}){
 const peer=checkReservationProfile(profile,now()),path=`repos/${peer.repository}/actions/runs/${peer.run.split(':')[0]}`;
 const [r,j]=await Promise.all([read(path),read(path+'/jobs?filter=all&per_page=100')]);
 assert(`${r.id}:${r.run_attempt}`===peer.run&&r.head_sha===peer.commit&&r.head_branch===reservationSource.ref
  &&r.repository?.full_name===peer.repository&&r.path==='.github/workflows/trial-300k.yml'&&r.event==='workflow_dispatch'
  &&r.status==='in_progress'&&r.conclusion===null,'BOUNDARY_RESERVATION_SOURCE');
 assert(j.total_count===j.jobs?.length&&j.total_count<100,'BOUNDARY_RESERVATION_JOBS');
 const captures=j.jobs.filter(job=>/^capture-(?:[0-9]|1[0-9])$/.test(job.name));
 assert(captures.length===20&&new Set(captures.map(job=>job.name)).size===20
  &&captures.every(job=>job.status==='in_progress'||job.status==='completed'&&job.conclusion==='success')
  &&j.jobs.some(job=>job.name==='formal-admit'&&job.status==='completed'&&job.conclusion==='success')
  &&j.jobs.filter(job=>!captures.includes(job)).every(job=>job.status==='completed'&&['success','skipped'].includes(job.conclusion)),
 'BOUNDARY_RESERVATION_CAPTURE');
 const spec='complete-count:'+peer.trialId+':'+peer.activation;
 // This operation runs on primary. Reuse its own bounded native reads; the
 // parallel peer endpoint is deliberately restricted to the other group.
 const state=await transport.request('read_many',{collection:'state',keys:['campaign','pool:'+peer.trialId,'capture-run:'+peer.run]});
 const journal=await transport.request('read_many',{collection:'journal',keys:['count-run:'+peer.trialId+':'+peer.run,spec,spec+':complete']});
 const permit=checkCountPeerEvidence({state,journal},peer,r.status,now());
 assert(hash(permit)===profile.sourcePermitHash,'BOUNDARY_RESERVATION_PERMISSION');return r;
}
// Only the independent handoff-metadata operation permits this exact live peer.
// No source or generic maintenance caller uses this reader.
export function reservationRead({read,transport,profile,now=Date.now}){
 checkReservationProfile(profile,now());
 return async path=>{
  const result=await read(path);
  if(!path.startsWith('repos/'+reservationSource.repository+'/actions/runs?'))return result;
  assert(result.total_count===result.workflow_runs?.length&&result.total_count<100,'BOUNDARY_RESERVATION_LIST');
  const found=result.workflow_runs.filter(r=>`${r.id}:${r.run_attempt}`===reservationSource.run);
  if(!found.length)return result;
  assert(found.length===1&&path.includes('status=in_progress')&&found[0].head_sha===reservationSource.commit,'BOUNDARY_RESERVATION_LIST_IDENTITY');
  await reservationIdentity({read,transport,profile,now});
  return {...result,total_count:result.total_count-1,workflow_runs:result.workflow_runs.filter(r=>r!==found[0])};
 };
}
export async function reserveCountBoundary({store,profile,run,commit,boundary,now=Date.now}){
 checkReservationProfile(profile,now());assert(/^\d+:1$/.test(run)&&run!==reservationSource.run&&/^[a-f0-9]{40}$/.test(commit),'BOUNDARY_RESERVATION_SELF');
 const key=`count-relay:${reservationSource.trialId}:${reservationSource.run}:intent`;
 await boundary();assert(!(await store.get('journal',key)),'BOUNDARY_RELAY_ALREADY_CLAIMED');
 const value={schema:'sg-formal-relay-boundary-reserved-v1',trialId:reservationSource.trialId,parentRun:reservationSource.run,
  sourceCommit:reservationSource.commit,profileHash:hash(profile),sourcePermitHash:profile.sourcePermitHash,
  purpose:profile.purpose,run,commit,createdAt:now(),sourceRequests:0,newBetAllowance:0};
 await boundary();await store.create('journal',key,value,{immutable:true});
 assert(hash((await store.get('journal',key))?.value)===hash(value),'BOUNDARY_RESERVATION_READBACK');
 return {boundaryReserved:true,key,receiptHash:hash(value),sourceRequests:0,newBetAllowance:0,databaseWrites:1};
}
