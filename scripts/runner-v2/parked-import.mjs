import {checkSecondaryNextProfile} from './secondary-next-profile.mjs';
import {SECONDARY_IDLE_SCHEMA,checkSecondaryIdleProfile,checkIdleSecondaryCampaign} from './secondary-idle-profile.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';

// No source transport and no round insert. Verified old complete records and
// interrupted evidence enter a disabled pool; normal retirement does the flush.
export async function importParkedDemo({store,transport,decode,plan,profile,boundary,commit,run,now=Date.now}){
 const idle=profile.schema===SECONDARY_IDLE_SCHEMA,secondary=idle||profile.group==='secondary';
 const fixed=secondary&&!idle?checkSecondaryNextProfile(profile,plan):null;if(idle)checkSecondaryIdleProfile(profile,plan);
 const spec=profile.legacyImport,key=`import-parked-demo:${plan.trialId}:${spec?.archiveHash?.slice(0,16)}`;
 assert((profile.schema==='sg-demo-next-game-v1'||secondary)&&profile.gameId===plan.gameId&&profile.oldPlanHash===hash(plan)
  &&profile.createdAt<=now()&&now()<profile.expiresAt&&profile.expiresAt-profile.createdAt===7200000
  &&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'PARKED_IMPORT_SCOPE');
 assert(spec?.schema==='sg-parked-import-v1'&&spec.planHash===hash(plan)&&spec.trialId===plan.trialId
  &&/^[a-f0-9]{64}$/.test(spec.archiveHash)&&Number.isInteger(spec.bytes)&&spec.bytes>0&&spec.bytes<=40*1024**2
  &&Number.isInteger(spec.complete)&&spec.complete>0&&spec.complete<=(fixed?1262:1000)
  &&spec.complete===profile.completePreserved&&Number.isInteger(spec.mongoCount)&&spec.mongoCount>=0&&spec.mongoCount<=spec.complete
  &&spec.pending===profile.abandonedAttempts,'PARKED_IMPORT_SCOPE');
 await boundary();
 const campaign=(await store.get('state','campaign'))?.value;
 assert(campaign&&hash(campaign)===spec.campaignHash&&campaign.activeGame===profile.fromGameId
  &&campaign.games.find(g=>g.game_id===plan.gameId)?.status==='parked-protocol','PARKED_IMPORT_CAMPAIGN');
 assert(!(await store.get('state','pool:'+plan.trialId))&&!(await store.get('journal',key+':before')),'PARKED_IMPORT_ALREADY_STARTED');
 if(idle)checkIdleSecondaryCampaign(campaign);
 const chunks=[];let offset=0;
 while(offset<spec.bytes){const r=await transport.request('frozen_trial_bytes',{trialId:plan.trialId,offset});
  const chunk=Buffer.from(r.data,'base64');assert(r.offset===offset&&r.size===spec.bytes&&r.sha256===spec.archiveHash&&chunk.length>0&&chunk.length<=256*1024&&offset+chunk.length<=spec.bytes,'PARKED_IMPORT_ARCHIVE');chunks.push(chunk);offset+=chunk.length;
 }
 const archive=Buffer.concat(chunks);assert(createHash('sha256').update(archive).digest('hex')===spec.archiveHash,'PARKED_IMPORT_ARCHIVE');
 const rounds=[];let after=0;
 for(;;){const page=await transport.request('rounds_scan',{trialId:plan.trialId,after});assert(Array.isArray(page)&&page.length<=100,'PARKED_IMPORT_MONGO');
  for(const r of page){assert(r.trialId===plan.trialId&&Number.isSafeInteger(r.sequence)&&r.sequence>after,'PARKED_IMPORT_MONGO');after=r.sequence;rounds.push(r);}
  assert(rounds.length<=spec.mongoCount,'PARKED_IMPORT_MONGO');if(page.length<100)break;
 }
 assert(rounds.length===spec.mongoCount&&hash(rounds)===spec.mongoHash,'PARKED_IMPORT_MONGO');
 const decoded=await decode({archive,plan,rounds,archiveHash:spec.archiveHash,checkedAt:now()/1000,...(fixed?{fixedLegacyHash:hash(fixed)}:{}),...(secondary?{workerOffset:20}:{})});
 assert(decoded.archiveHash===spec.archiveHash&&decoded.records.length===spec.complete&&decoded.pending.length===spec.pending
  &&decoded.mongoMatched===spec.mongoCount&&hash(decoded.states)===spec.statesHash&&hash(decoded.records)===spec.recordsHash,'PARKED_IMPORT_DECODE');
 const pool=decoded.states[0],batches=decoded.states.slice(1);
 if(secondary)assert(batches.every(b=>Number.isInteger(b.value.worker)&&b.value.worker>=20&&b.value.worker<40)
  &&Object.keys(pool.value.workers).every(w=>/^(2[0-9]|3[0-9])$/.test(w)), 'PARKED_IMPORT_WORKER_SCOPE');
 assert(pool.key==='pool:'+plan.trialId&&!pool.value.enabled&&pool.value.planHash===hash(plan)
  &&batches.length===pool.value.nextBatchId-1&&batches.length<=100
  &&batches.every((b,i)=>b.key===`batch:${plan.trialId}:${i+1}`&&b.value.id===i+1),'PARKED_IMPORT_STATE');
 assert((await store.getMany('state',batches.map(b=>b.key))).every(r=>!r),'PARKED_IMPORT_STATE_EXISTS');
 for(let i=0;i<decoded.records.length;i+=100){const keys=decoded.records.slice(i,i+100).map(r=>receiptKey(plan.trialId,r.sequence));assert((await store.getMany('journal',keys)).every(r=>!r),'PARKED_IMPORT_RECEIPT_EXISTS');}
 await boundary();await store.writable();assert(hash((await store.get('state','campaign'))?.value)===spec.campaignHash&&!(await store.get('state',pool.key)),'PARKED_IMPORT_SCENE_CHANGED');
 const save=async(c,k,v)=>{await store.create(c,k,v,{immutable:true});assert(hash((await store.get(c,k))?.value)===hash(v),'PARKED_IMPORT_READBACK');};
 await save('journal',key+':before',{schema:'sg-parked-import-before-v1',spec,profileHash:hash(profile),commit,run,at:now()});
 for(const r of decoded.records)await save('journal',receiptKey(plan.trialId,r.sequence),r);
 for(const b of batches)await save('state',b.key,b.value);
 await boundary();assert(hash((await store.get('state','campaign'))?.value)===spec.campaignHash,'PARKED_IMPORT_SCENE_CHANGED');
 await save('state',pool.key,{...pool.value,legacyImport:{key,specHash:hash(spec)}});
 await boundary();assert(hash((await store.get('state','campaign'))?.value)===spec.campaignHash,'PARKED_IMPORT_SCENE_CHANGED');
 const result={schema:'sg-parked-import-complete-v1',specHash:hash(spec),profileHash:hash(profile),commit,run,
  completePreserved:spec.complete,mongoPreserved:spec.mongoCount,pendingPreserved:spec.pending,newBetAllowance:0,sourceRequests:0};
 await save('journal',key+':complete',result);return result;
}
