import assert from 'node:assert/strict';
import {onePaidRound} from './paid-round-evidence.mjs';
import {demoRuntimeCommit} from './demo-runtime.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';

const closeKey=p=>`closed-demo-pilot:${p.trialId}:${p.demoGeneration}`;
const repairKey=p=>`game-repair:${p.trialId}:${p.demoGeneration}`;
const sum=a=>a.reduce((n,v)=>n+v,0);
const budget=a=>Array.isArray(a)&&a.length===20&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=5);
export async function interruptedScene(store,plan){
 const campaign=(await store.get('state','campaign'))?.value,pool=(await store.get('state','pool:'+plan.trialId))?.value;
 assert(pool&&Number.isSafeInteger(pool.nextBatchId)&&pool.nextBatchId>=1&&pool.nextBatchId<=101,'AG_CLOSE_BATCH_BOUND');
 const keys=Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`),rows=keys.length?await store.getMany('state',keys):[];
 assert(rows.length===keys.length&&rows.every((r,i)=>r?.value.id===i+1),'AG_CLOSE_BATCH_MISSING');
 return {campaign,pool,batches:rows.map(r=>r.value)};
}

// Evidence is already durable when batch-controller abandons a failed round.
// Closing must account for that BET without resuming or treating it as complete.
async function abandonedEvidence(store,plan,b){
 const a=(await store.get('journal',b.abandonedDemo))?.value,q=a?.pending,steps=q?.raw?.steps;
 assert(a?.schema==='sg-abandoned-demo-v1'&&a.trialId===plan.trialId&&a.batchId===b.id
  &&a.disposition==='interrupted-abandoned-without-replay'&&a.sourceRequests===0&&!a.pendingOriginal
  &&q&&q.awaiting===null&&q.sequence===b.journaled+1&&q.sequence<=b.end
  &&b.abandonedDemo===`abandoned-demo:${plan.trialId}:${b.id}:${hash(q)}`
  &&onePaidRound(plan,q?.raw,{abandoned:true})
  &&steps.every(s=>typeof s.responseXml==='string'&&s.responseXml.length>0
   &&typeof s.responsePayload==='string'&&s.responsePayload.length>0),'AG_CLOSE_ABANDONMENT_INVALID');
 return {key:b.abandonedDemo,hash:hash(a),batchId:b.id,worker:b.worker,sequence:q.sequence,rawHash:hash(q.raw)};
}

export async function reviewInterruptedPilot({store,transport,parser,basePlan,plan,profile,scene,now=Date.now}){
 const get=async k=>(await store.get('journal',k))?.value,k=`demo-generation:${plan.trialId}:${plan.demoGeneration}`;
 const spec=await get(k),done=await get(k+':complete'),{campaign,pool,batches}=scene;
 assert(spec?.schema==='sg-demo-generation-v1'&&hash(spec)===profile.sourceSpecHash&&pool.demoGeneration?.specHash===hash(spec)
  &&spec.planHash===hash(plan)&&spec.trialId===plan.trialId&&spec.generation===plan.demoGeneration&&(await demoRuntimeCommit({store,plan,spec,campaign}))===profile.sourceCommit
  &&spec.workers===20&&spec.perWorker===5&&spec.newBetAllowance===100
  &&done?.schema==='sg-demo-generation-complete-v1'&&done.specHash===hash(spec)&&done.commit===spec.commit&&done.run===spec.run,'AG_CLOSE_SPEC');
 const top=spec.activationStage&&await get(spec.activationStage.key+':complete');
 assert(spec.activationStage?.key===`next-demo-game:${plan.trialId}:${plan.demoGeneration}`&&spec.activationStage.profileHash===profile.sourceProfileHash
  &&top?.schema==='sg-next-demo-game-complete-v1'&&top.profileHash===profile.sourceProfileHash&&top.generation===plan.demoGeneration
  &&top.commit===spec.commit&&top.run===spec.run&&top.newBetAllowance===100&&top.sourceRequests===0,'AG_CLOSE_ACTIVATION');
 const secondary=campaign?.group==='secondary',offset=secondary?20:0;
 assert(secondary?(spec.group==='secondary'&&spec.workerOffset===20&&[32719,32721].includes(plan.gameId)&&plan.trialId===`sg_r1_20260928_${plan.gameId}`):(!spec.group&&!spec.workerOffset),'AG_CLOSE_GROUP_SCOPE');
 const game=campaign?.games.find(g=>g.game_id===plan.gameId);
 assert(campaign.activeGame===plan.gameId&&game?.status==='parking-protocol'&&campaign.protocolValidation?.runKey===profile.sourceRunKey
  &&campaign.protocolValidation.commit===profile.sourceCommit&&campaign.protocolValidation.demoFresh===hash(spec)&&campaign.protocolValidation.generation===plan.demoGeneration
  &&pool.planHash===hash(plan)&&!pool.enabled&&pool.failure==='PROTOCOL_VALIDATION_FAILED'&&pool.drainingProtocol===true&&!pool.demoPilotClosed,'AG_CLOSE_BINDING');
 assert(Number.isSafeInteger(spec.firstBatchId)&&spec.firstBatchId>=1&&spec.firstBatchId<=pool.nextBatchId
  &&budget(profile.usedByWorker)&&budget(profile.completeByWorker),'AG_CLOSE_BUDGET');
 assert(Object.entries(pool.workers).every(([w,v])=>(secondary?/^(?:2[0-9]|3[0-9])$/:/^(?:[0-9]|1[0-9])$/).test(w)&&Number.isFinite(v.leaseUntil)&&v.leaseUntil<=now()),'AG_CLOSE_LEASE');
 const records=[],complete=Array(20).fill(0),abandoned=Array(20).fill(0),evidence=[];
 for(const b of batches){
  assert(Number.isInteger(b.worker)&&b.worker>=offset&&b.worker<offset+20&&Number.isSafeInteger(b.start)&&Number.isSafeInteger(b.end)
   &&Number.isSafeInteger(b.journaled)&&b.start>=1&&b.start-1<=b.journaled&&b.journaled<=b.end&&b.end-b.start<100
   &&b.checkpoint===b.journaled&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&Number.isFinite(b.leaseUntil)&&b.leaseUntil<=now(),'AG_CLOSE_UNSETTLED');
  const keys=Array.from({length:b.journaled-b.start+1},(_,i)=>receiptKey(plan.trialId,b.start+i)),rows=keys.length?await store.getMany('journal',keys):[];
  assert(rows.length===keys.length&&rows.every(Boolean),'AG_CLOSE_RECEIPT_MISSING');
  for(const [i,{value:r}] of rows.entries()){
   assert(r.trialId===plan.trialId&&r.batchId===b.id&&r.shardId===b.worker&&r.sequence===b.start+i&&r.sourceSessionHash===b.sessionHash
    &&onePaidRound(plan,r.raw),'AG_CLOSE_RECEIPT_CHANGED');
   assert((await parser.call({op:'verify',plan:basePlan,raw:r.raw,record:r})).verified,'AG_CLOSE_RECORD_INVALID');records.push(r);
   if(b.id>=spec.firstBatchId)complete[b.worker-offset]++;
  }
  if(b.id>=spec.firstBatchId&&b.abandonedDemo){evidence.push(await abandonedEvidence(store,plan,b));abandoned[b.worker-offset]++;}
 }
 const used=complete.map((n,w)=>n+abandoned[w]),newBatches=batches.filter(b=>b.id>=spec.firstBatchId);
 assert(records.length===profile.completePreserved&&new Set(records.map(r=>r._id)).size===records.length&&new Set(records.map(r=>r.sequence)).size===records.length
  &&budget(used)&&hash(used)===hash(profile.usedByWorker)&&hash(complete)===hash(profile.completeByWorker)
  &&sum(abandoned)>0&&sum(used)<100,'AG_CLOSE_COUNTS');
 for(let w=0;w<20;w++){
  const own=newBatches.filter(b=>b.worker===w+offset),registered=pool.workers[w+offset];
  assert(own.length<=1&&(!own.length||registered?.sessionHash===own[0].sessionHash)
   &&(!registered?.activeBatch||own.length===1&&registered.activeBatch.id===own[0].id),'AG_CLOSE_WORKER');
 }
 if(game.pendingReview)assert(evidence.some(e=>e.batchId===game.pendingReview.batchId&&e.sequence===game.pendingReview.sequence&&e.rawHash===game.pendingReview.rawHash),'AG_CLOSE_PENDING_REVIEW');
 for(let i=0;i<records.length;i+=100){const wanted=records.slice(i,i+100),actual=await transport.request('rounds_read',{trialId:plan.trialId,ids:wanted.map(r=>r._id)});
  assert(hash(actual.map(hash).sort())===hash(wanted.map(hash).sort()),'AG_CLOSE_MONGO_CHANGED');}
 return {usedByWorker:used,completeByWorker:complete,abandonedByWorker:abandoned,foregoneByWorker:used.map(n=>5-n),used:sum(used),newComplete:sum(complete),abandoned:sum(abandoned),foregone:100-sum(used),recordsHash:hash(records),evidence};
}

export async function closeInterruptedPilot({store,transport,parser,basePlan,plan,profile,boundary,commit,run,now=Date.now}){
 assert(profile.schema==='sg-demo-pilot-close-v2'&&profile.newBetAllowance===0&&profile.planHash===hash(plan)
  &&profile.createdAt<=now()&&now()<profile.expiresAt&&profile.expiresAt-profile.createdAt===7200000
  &&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'AG_CLOSE_SCOPE');
 const key=closeKey(plan),rk=repairKey(plan),save=async(c,k,v)=>{await store.create(c,k,v,{immutable:c==='journal'});assert(hash((await store.get(c,k))?.value)===hash(v),'AG_CLOSE_READBACK');};
 await boundary();assert(!await store.get('journal',key+':before')&&!await store.get('journal',key+':complete')&&!await store.get('state',rk),'AG_CLOSE_ALREADY_STARTED');
 const scene=await interruptedScene(store,plan);assert(hash(scene)===profile.sceneHash,'AG_CLOSE_SCENE_CHANGED');
 const review=await reviewInterruptedPilot({store,transport,parser,basePlan,plan,profile,scene,now});
 const before={schema:'sg-demo-pilot-close-before-v2',scene,review,profileHash:hash(profile),commit,run,at:now()};
 await save('journal',key+':before',before);await boundary();
 assert(hash(await interruptedScene(store,plan))===hash(scene),'AG_CLOSE_SCENE_CHANGED');
 // The repair worker has no source allowance. The immutable closure, written
 // last, is what authorizes an independently scoped next-game transition.
 const repair={schema:'sg-game-repair-v1',gameId:plan.gameId,trialId:plan.trialId,status:'pending-adapter',archiveKey:key+':before',evidence:review.evidence,sourceAllowance:0,requiresNewSession:true};
 await save('state',rk,repair);
 const doc=await store.get('state','pool:'+plan.trialId);assert(hash(doc?.value)===hash(scene.pool),'AG_CLOSE_POOL_CHANGED');
 const after={...scene.pool,enabled:false,demoPilotClosed:{key,profileHash:hash(profile),repairKey:rk}};
 assert(await store.cas('state','pool:'+plan.trialId,doc,after),'AG_CLOSE_CAS_CONFLICT');
 assert(hash(await interruptedScene(store,plan))===hash({...scene,pool:after}),'AG_CLOSE_AFTER_CHANGED');
 const result={schema:'sg-demo-pilot-closed-v2',trialId:plan.trialId,generation:plan.demoGeneration,planHash:hash(plan),specHash:profile.sourceSpecHash,
  sourceRunKey:profile.sourceRunKey,sourceCommit:profile.sourceCommit,sourceProfileHash:profile.sourceProfileHash,profileHash:hash(profile),beforeHash:hash(before),
  afterPoolHash:hash(after),campaignHash:hash(scene.campaign),batchesHash:hash(scene.batches),...review,completePreserved:profile.completePreserved,
  repairKey:rk,repairHash:hash(repair),newBetAllowance:0,sourceRequests:0,commit,run,at:now()};
 await save('journal',key+':complete',result);return result;
}

export async function readInterruptedClosure({store,plan,profile,scene,closed,before}){
 const key=closeKey(plan),repair=(await store.get('state',repairKey(plan)))?.value;
 const repairProof={schema:'sg-game-repair-v1',gameId:plan.gameId,trialId:plan.trialId,status:'pending-adapter',archiveKey:key+':before',evidence:closed.evidence,sourceAllowance:0,requiresNewSession:true};
 assert(closed.schema==='sg-demo-pilot-closed-v2'&&closed.trialId===plan.trialId&&closed.generation===plan.demoGeneration&&closed.planHash===hash(plan)
  &&closed.specHash===profile.sourceSpecHash&&closed.sourceRunKey===profile.sourceRunKey&&closed.sourceCommit===profile.sourceCommit&&closed.sourceProfileHash===profile.sourceProfileHash
  &&hash(closed)===profile.sourceClosureHash&&closed.newBetAllowance===0&&closed.sourceRequests===0
  &&before?.schema==='sg-demo-pilot-close-before-v2'&&hash(before)===closed.beforeHash&&before.profileHash===closed.profileHash&&before.commit===closed.commit&&before.run===closed.run
  &&hash(scene.fromPool)===closed.afterPoolHash&&hash(scene.sourceBatches)===closed.batchesHash&&hash(scene.campaign)===closed.campaignHash
  &&!scene.fromPool.enabled&&scene.fromPool.demoPilotClosed?.key===key&&scene.fromPool.demoPilotClosed.profileHash===closed.profileHash
  &&scene.fromPool.demoPilotClosed.repairKey===closed.repairKey&&closed.repairKey===repairKey(plan)
  &&hash(repairProof)===closed.repairHash&&Object.entries(repairProof).every(([k,v])=>k==='status'||hash(repair?.[k])===hash(v)),'NEXT_GAME_CLOSURE_INVALID');
 assert(budget(closed.usedByWorker)&&budget(closed.completeByWorker)&&budget(closed.abandonedByWorker)
  &&closed.usedByWorker.every((n,w)=>n===closed.completeByWorker[w]+closed.abandonedByWorker[w])
  &&hash(closed.foregoneByWorker)===hash(closed.usedByWorker.map(n=>5-n))&&closed.used===sum(closed.usedByWorker)
  &&closed.newComplete===sum(closed.completeByWorker)&&closed.abandoned===sum(closed.abandonedByWorker)&&closed.abandoned>0
  &&closed.foregone>0&&closed.used+closed.foregone===100,'NEXT_GAME_CLOSURE_BUDGET');
 const evidence=[];for(const b of scene.sourceBatches)if(closed.evidence.some(e=>e.batchId===b.id))evidence.push(await abandonedEvidence(store,plan,b));
 assert(hash(evidence)===hash(closed.evidence)&&hash(evidence)===hash(repair.evidence)&&evidence.length===closed.abandoned,'NEXT_GAME_CLOSURE_EVIDENCE');
 return closed;
}
