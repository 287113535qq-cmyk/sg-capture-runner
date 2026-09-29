// One evidenced FREE_GAME rejection. Other unrequested attempts remain intact.
import assert from 'node:assert/strict';
import {SessionRecovery} from './session-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
import {demonNextRequest} from '../trial/demon-protocol.mjs';
import {createRequire} from 'node:module';
const {XMLParser}=createRequire(import.meta.url)('../../collector/node_modules/fast-xml-parser');
const xml=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});
export const DEMON_SESSION={id:'demon-session-36513748377',runKey:'capture-run:36513748377:1',
  previousProof:'cf36d2dc3eba0a9bf5125dba97eb083cefeb5f1c3dae97e119a7458da7ff7315',
  previousCommit:'00b7869e167bcd289af7e41c53b6d27b46006c91',
  previousPrefix:'demon-rebind:demon-unstarted-terminal-20260929',abandon:[1],
  pending:{1:{worker:3,sequence:9,frames:4},5:{worker:0,sequence:432,frames:9},9:{worker:13,sequence:806,frames:3},10:{worker:2,sequence:902,frames:1}}};

export function reviewDemonSession({profile,plan,snapshot:s,previous,now=Date.now()}) {
  const k=DEMON_SESSION,c=s.campaign.value,p=s.pool.value;
  assert(profile.schema==='sg-demon-session-incident-v1' && profile.id===k.id && profile.group==='primary'
    && profile.gameId===32739 && profile.complete===164 && profile.pending===4 && stable(profile.abandon)==='[1]','WRONG_DEMON_SESSION');
  assert(now>=profile.createdAt && now-profile.createdAt<7200000,'INCIDENT_PROOF_STALE');
  assert(plan.gameId===32739 && plan.phase===1 && plan.buy===0 && hash(plan)===profile.planHash,'PLAN_CHANGED');
  assert(hash(c)===profile.campaignHash && hash(p)===profile.poolHash && hash(previous)===profile.previousSnapshotHash,'INCIDENT_STATE_CHANGED');
  assert(profile.previousCommit===k.previousCommit && c.enabled && !c.reason && !c.audit && c.activeGame===32739
    && c.validationLimit===10 && c.protocolValidation?.phase==='short' && c.protocolValidation.runKey===k.runKey
    && c.protocolValidation.proofHash===k.previousProof && c.protocolValidation.commit===k.previousCommit
    && c.games.find(g=>g.game_id===32739)?.status==='active' && !c.games.some(g=>g.status==='ready'),'SHORT_STATE_CHANGED');
  assert(p.enabled && !p.failure && p.planHash===profile.planHash && p.protocolRecovery===k.previousProof,'POOL_CHANGED');
  const workers=Object.entries(p.workers);
  assert(workers.length===17 && workers.every(([id,w])=>Number(id)>=0 && Number(id)<20 && w.leaseUntil<=now)
    && new Set(workers.map(([,w])=>w.sessionHash)).size===17,'WORKERS_ACTIVE_OR_CHANGED');
  assert(s.batches.length===15 && profile.batches.length===15 && previous.batches.length===15 && p.nextBatchId===16,'BATCHES_CHANGED');
  let count=0,pending=0,end=0;
  for(const [i,{value:b}] of s.batches.entries()) {
    const expected=profile.batches[i],old=previous.batches.find(x=>x.value.id===b.id)?.value,target=k.pending[b.id];
    assert(b.id===i+1 && expected.id===b.id && hash(b)===expected.hash,'BATCH_CHANGED');
    assert(old && ['id','worker','start','end','sessionHash'].every(key=>old[key]===b[key]),'ORIGINAL_BATCH_CHANGED');
    assert(b.start===end+1 && b.end>=b.start && b.end-b.start<100 && b.end<=plan.target,'RANGE_CHANGED');end=b.end;
    assert(p.workers[b.worker]?.sessionHash===b.sessionHash && p.workers[b.worker]?.activeBatch?.id===b.id,'SESSION_CHANGED');
    assert(b.leaseUntil<=now && !b.failure && !b.bootstrapAwaiting && !b.pendingOriginal,'BATCH_REQUIRES_REVIEW');
    assert(b.checkpoint===b.journaled && b.journaled===old.journaled && b.start-1<=b.journaled && b.journaled<b.end,'COUNTS_CHANGED');
    count+=b.journaled-b.start+1;
    if(!target){assert(!old.pending && !b.pending && !b.protocolResume && expected.pendingHash===null,'UNREVIEWED_PENDING');continue;}
    const q=b.pending,prior=old.pending;pending++;
    assert(prior && q && q.awaiting===null && prior.awaiting===null && b.worker===target.worker
      && q.sequence===target.sequence && q.sequence===b.journaled+1 && q.attempt===prior.attempt
      && q.raw.startBalanceRaw===prior.raw.startBalanceRaw && prior.raw.steps.length===target.frames
      && stable(q.raw.steps.slice(0,target.frames))===stable(prior.raw.steps) && hash(q)===expected.pendingHash,'PENDING_CHANGED');
    assert(stable(demonNextRequest(prior.raw))===stable({MSGID:'FREE_GAME'}),'CONTINUATION_CHANGED');
    if(b.id===1) {
      const tail=q.raw.steps.at(-1);
      assert(!b.protocolResume && q.raw.steps.length===5 && tail.msgId==='FREE_GAME' && tail.sourceRejected===true
        && tail.requestPayload===prior.raw.steps.at(-1).requestPayload
        && tail.responsePayload==='&MSGID=ERROR&EID=ERROR_INVALID_SESSION&','NOT_REVIEWED_INVALID_SESSION');
      assert(typeof tail.responseXml==='string' && tail.responseXml.length<=262144 && !/<!DOCTYPE|<!ENTITY/i.test(tail.responseXml),'REJECTION_XML_INVALID');
      const root=xml.parse(tail.responseXml).GDMRESPONSE;
      assert(root && String(root.SUCCESS).toLowerCase()==='true' && root.PAYLOAD===tail.responsePayload,'REJECTION_XML_MISMATCH');
    }else assert(stable(q)===stable(prior) && b.protocolResume?.proofHash===k.previousProof
      && b.protocolResume.pendingHash===hash(q),'UNCONSUMED_PENDING_CHANGED');
  }
  assert(end+1===p.nextSequence && count===164 && pending===4,'COUNTS_CHANGED');
  return {complete:164,pending:4,abandoned:1,preserved:3};
}

export class DemonSessionRecovery extends SessionRecovery {
  constructor(args) {
    super(args);this.session={...this.session,...DEMON_SESSION};this.policy={...this.policy,pending:4};
    this.prefix='demon-session:'+DEMON_SESSION.id;this.originalPrefix=DEMON_SESSION.previousPrefix;
  }
  reviewIncident(snapshot,previous){return reviewDemonSession({profile:this.profile,plan:this.plan,snapshot,previous,now:this.now()});}
  async boundary(){
    await this.githubIdle();await this.store.writable();
    assert(this.gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
    const holds=await this.transport.request('global_holds');
    assert(holds.length===2 && new Set(holds.map(x=>x._id)).size===2,'HOLD_SCOPE_CHANGED');
    const primary=holds.find(x=>x._id==='primary/global-hold'),secondary=holds.find(x=>x._id==='secondary/global-hold');
    assert(primary && secondary && secondary.value.active===false,'GLOBAL_HOLD');
    if(this.recovering)assert(hash(primary.value)===this.profile.primaryHoldHash && hash(secondary.value)===this.profile.secondaryHoldHash
      && primary.value.active===true && primary.value.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'
      && primary.value.details?.code==='SOURCE_REJECTED' && primary.value.details.trialId===this.plan.trialId
      && primary.value.details.batchId===1 && !primary.value.details.cooldownUntil,'UNREVIEWED_HOLD');
    else assert(primary.value.active===false,'GLOBAL_HOLD');
    return holds;
  }
}
