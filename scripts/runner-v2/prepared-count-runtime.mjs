import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkLedger} from './complete-count.mjs';

export function preparedRuntimePath(name,registry){
 assert(/^count-prepared-runtime-[0-9]{5}-[a-f0-9]{64}\.json$/.test(name??'')
  &&registry?.schema==='sg-prepared-runtime-authorizations-v1'&&registry.sourceAllowance===0
  &&/^[a-f0-9]{64}$/.test(registry.profiles?.[name]??''),'PREPARED_RUNTIME_UNAUTHORIZED');
 return 'config/'+name;
}

// Update implementation before its first source run, preserving the applied
// allocation and baseline. This is not a repair or a new source allowance.
export function preparedRuntimeAuthorization({name,revision,registry,profile}){
 assert(name===`count-prepared-runtime-${profile.gameId}-${revision.revisionId}.json`
  &&/^[a-f0-9]{64}$/.test(revision.revisionId??'')
  &&registry?.schema==='sg-prepared-runtime-authorizations-v1'&&registry.sourceAllowance===0
  &&registry.profiles?.[name]===hash(revision),'PREPARED_RUNTIME_UNAUTHORIZED');
 assert(revision.schema==='sg-prepared-zero-source-runtime-v1'&&revision.profileHash===hash(profile)
  &&revision.activation===profile.activation&&revision.gameId===profile.gameId
  &&revision.newBetAllowance===0&&revision.sourceRequests===0
  &&revision.files&&Object.keys(profile.files).every(f=>Object.hasOwn(revision.files,f)),
 'PREPARED_RUNTIME_SCOPE');
 return revision;
}

export async function amendPreparedZeroRuntime({store,plan,profile,revision,boundary,commit,run,now=Date.now}){
 assert(revision.schema==='sg-prepared-zero-source-runtime-v1'&&revision.activation===profile.activation
  &&revision.profileHash===hash(profile)&&revision.gameId===profile.gameId&&revision.newBetAllowance===0
  &&revision.sourceRequests===0,'PREPARED_RUNTIME_SCOPE');
 assert(/^[a-f0-9]{40}$/.test(commit??'')&&/^[a-f0-9]{40}$/.test(revision.fromCommit??'')
  &&commit!==revision.fromCommit&&/^\d+:1$/.test(run??'')
  &&revision.createdAt<=now()&&now()<revision.expiresAt
  &&revision.expiresAt-revision.createdAt===7200000,'PREPARED_RUNTIME_STALE');
 await boundary();
 const key=`complete-count:${plan.trialId}:${profile.activation}`;
 const spec=(await store.get('journal',key))?.value,complete=(await store.get('journal',key+':complete'))?.value;
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 assert(spec?.commit===revision.fromCommit&&spec.profileHash===hash(profile)&&spec.planHash===hash(plan)
  &&spec.activation===profile.activation&&spec.gameId===profile.gameId
  &&spec.baselineBatchCount===pool.nextBatchId-1&&complete?.specHash===hash(spec)
  &&complete.run===revision.activationRun&&complete.sourceRequests===0&&complete.newBetAllowance===0
  &&pool.enabled&&!pool.failure&&pool.confirmed===profile.completePreserved
  &&Object.keys(pool.workers).length===0&&pool.nextSequence===spec.firstSequence
  &&campaign.activeGame==null&&campaign.formalCount?.activation===profile.activation
  &&campaign.games.find(g=>g.game_id===profile.gameId)?.status==='ready','PREPARED_RUNTIME_SOURCE_CHANGED');
 assert(checkLedger(pool,plan,spec).reserved===0,'PREPARED_RUNTIME_RESERVED');
 const rkey=`count-runtime:${plan.trialId}:${profile.activation}:${commit}`;
 assert(!(await store.get('journal',rkey)),'PREPARED_RUNTIME_ALREADY_APPLIED');
 await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(campaign),'PREPARED_RUNTIME_SCENE_CHANGED');
 const result={schema:'sg-count-runtime-v2',commit,fromCommit:spec.commit,specHash:hash(spec),profileHash:hash(profile),
  revisionHash:hash(revision),activation:profile.activation,planHash:hash(plan),run,
  completePreserved:pool.confirmed,remainingComplete:plan.target-pool.confirmed,sourceRequests:0,newBetAllowance:0};
 await store.create('journal',rkey,result,{immutable:true});
 assert(hash((await store.get('journal',rkey))?.value)===hash(result),'PREPARED_RUNTIME_READBACK');return result;
}
