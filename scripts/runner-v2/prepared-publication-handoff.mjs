import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishedPreparedSelector} from './prepared-campaign-selector.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {preparedRuntimeAuthorization,preparedRuntimePath} from './prepared-count-runtime.mjs';

// Reusable stock handoff is independent of expiring demo profiles. The online
// campaign still intersects its own ready set and acquires fresh permission.
export async function reviewPreparedPublicationHandoff({task, currentCycleHash, inventory, plans, registry,
 countRegistry, runtimeRegistry,readProfile}) {
  const cycle = task?.cycle;
  assert(task?.schema === 'sg-capture-prepared-publication-v1' && task.sourceAllowance === 0
    && cycle?.schema === 'sg-preparation-publication-cycle-v1' && cycle.sourceAllowance === 0
    && hash(cycle) === task.cycleHash && task.cycleHash === currentCycleHash
    && inventory?.sourceAllowance === 0 && registry?.sourceAllowance === 0,
    'PREPARED_HANDOFF_CYCLE_CHANGED');
  const candidate = cycle.publication.inventory.tasks, games = [];
  for (const row of candidate) {
    const current = inventory.tasks.find(t => t.gameId === row.gameId);
    const binding = registry.bindings[String(row.gameId)], published = cycle.publication.bindings[String(row.gameId)];
    assert(current?.status === 'prepared' && !current.claim && current.proofHash === row.proofHash
      && hash(current.proof) === row.proofHash && binding?.group === published?.group
      && binding?.planHash === published?.planHash, 'PREPARED_HANDOFF_REVOKED');
    const select = publishedPreparedSelector({publication: cycle.publication, plans,
      readEvidence: async ref => cycle.evidence[ref]});
    assert(await select({readyGameIds: [row.gameId], group: binding.group}) === row.gameId,
      'PREPARED_HANDOFF_EVIDENCE');
    const dispatch={role:'capture',allocation:'round-one',round_one_limit:'0',active_shards:'20'};
    if(countRegistry){
      assert(countRegistry.schema==='sg-prepared-count-authorizations-v1'&&countRegistry.sourceAllowance===0,
       'PREPARED_HANDOFF_COUNT_REGISTRY');
      const entries=Object.entries(countRegistry.profiles).filter(([,a])=>a.gameId===row.gameId);
      const matching=[];
      for(const [name,a] of entries){
        assert(name===`formal-prepared-count-${row.gameId}-${a.activation}.json`&&typeof readProfile==='function',
         'PREPARED_HANDOFF_COUNT_SCOPE');
        const profile=await readProfile('config/'+name);
        preparedCountPlan(plans[row.gameId],profile,a);
        if(profile.preparationProofHash===row.proofHash&&profile.failureEvidenceHash===row.failureEvidenceHash)
          matching.push({name,profile});
      }
      if(entries.length){
        assert(matching.length===1,'PREPARED_HANDOFF_COUNT_PROOF_CHANGED');
        const {name,profile}=matching[0];assert(profile.group===binding.group,'PREPARED_HANDOFF_COUNT_SCOPE');
        Object.assign(dispatch,{role:'formal-count',formal_profile:name,runtime_profile:'none',relay_parent:''});
        const revisions=[];
        for(const runtimeName of Object.keys(runtimeRegistry?.profiles??{})){
          const revision=await readProfile(preparedRuntimePath(runtimeName,runtimeRegistry));
          if(revision.profileHash!==hash(profile))continue;
          preparedRuntimeAuthorization({name:runtimeName,revision,registry:runtimeRegistry,profile});
          revisions.push({name:runtimeName,createdAt:revision.createdAt});
        }
        revisions.sort((a,b)=>b.createdAt-a.createdAt);
        if(revisions.length)dispatch.prepared_runtime=revisions[0].name;
      }
    }
    games.push({gameId: row.gameId, group: binding.group, planHash: binding.planHash, proofHash: row.proofHash,inputs:dispatch});
  }
  assert(games.length > 0, 'PREPARED_HANDOFF_EMPTY');
  return {schema: 'sg-capture-prepared-dispatch-task-v1', status: 'online-publication-and-fresh-admission-required',
    cycleHash: task.cycleHash, games, workflow: '.github/workflows/trial-300k.yml',
    inputs: games.length===1?games[0].inputs:null,
    sourceAllowance: 0, sourceRequests: 0, dispatched: false};
}
