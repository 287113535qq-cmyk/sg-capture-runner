import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';

// The next prepared game inherits its own ledger. Selecting it never creates
// an allocation or borrows the failed game's remaining pilot allowance.
export async function preparedContinuationInputs({store,campaign,gameId,group,plans,registry,runtimeRegistry,readProfile,commit}){
 const base=plans[gameId],game=campaign.games.find(g=>g.game_id===gameId);
 const inputs={allocation:'round-one',round_one_limit:'0',active_shards:'20'};
 if(!game?.countActivation)return {...inputs,role:'capture'};
 assert(base&&registry.schema==='sg-prepared-count-authorizations-v1'&&registry.sourceAllowance===0,
  'CONTINUATION_COUNT_AUTHORIZATION');
 const entries=Object.entries(registry.profiles).filter(([,a])=>a.gameId===gameId&&a.activation===game.countActivation);
 assert(entries.length===1,'CONTINUATION_COUNT_PROFILE_REQUIRED');
 const [name,authorization]=entries[0];
 assert(name===`formal-prepared-count-${gameId}-${game.countActivation}.json`&&authorization.group===group,
  'CONTINUATION_COUNT_PROFILE_SCOPE');
 const profile=await readProfile(name),plan=preparedCountPlan(base,profile,authorization);
 const pool=(await store.get('state','pool:'+plan.trialId))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit}),ledger=checkLedger(pool,plan,spec);
 assert(spec.profileHash===hash(profile)&&pool.enabled&&!pool.failure&&ledger.reserved===0
  &&pool.confirmed<plan.target,'CONTINUATION_COUNT_NOT_READY');
 const result={...inputs,role:'formal-count',formal_profile:name,runtime_profile:'none',relay_parent:''};
 if(spec.commit!==commit){
  const applied=(await store.get('journal',`count-runtime:${plan.trialId}:${profile.activation}:${commit}`))?.value;
  assert(runtimeRegistry?.schema==='sg-prepared-runtime-authorizations-v1'&&runtimeRegistry.sourceAllowance===0,
   'CONTINUATION_RUNTIME_REGISTRY');
  const entries=Object.entries(runtimeRegistry.profiles).filter(([,digest])=>digest===applied?.revisionHash);
  assert(entries.length===1&&/^count-prepared-runtime-[0-9]{5}-[a-f0-9]{64}\.json$/.test(entries[0][0]),
   'CONTINUATION_RUNTIME_REQUIRED');
  result.prepared_runtime=entries[0][0];
 }
 return result;
}
