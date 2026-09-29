import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from './mongo-writer.mjs';
import {GameRuleEvidence} from './game-rule-evidence.mjs';
import {requireShortRun} from './protocol-recovery-core.mjs';
import {auditSessionOwner} from './demo-session-audit.mjs';
import {loadCountPermission,auditAllocatedRecord,auditCountBatch,idleAtCountTail} from './complete-count.mjs';
const hash=x=>createHash('sha256').update(stable(x)).digest('hex');

// Release the hosted-runner slot while the last ranges belong to other workers.
// In particular, a queued stable session may still own a resumable partial batch.
export function idleAtAssignedTail(pool,worker,target,now=Date.now()){
  const own=pool.workers[String(worker)];
  // A count-aware pool can have unused capacity beyond target sequence. Its
  // permission is checked by register/take; do not apply the legacy tail rule.
  if(pool.countAllocation)return false;
  return pool.nextSequence>target && pool.confirmed<target && own
    && !own.activeBatch && own.leaseUntil<=now;
}

export class GithubCampaign {
  constructor({store,transport,control,analyzer,plans,group,owner,commit=process.env.GITHUB_SHA,now=Date.now}){
    Object.assign(this,{store,transport,control,analyzer,plans,group,owner,commit,now});
  }
  async idleAtTail(plan,pool,worker){
    const spec=await loadCountPermission({store:this.store,plan,pool,commit:this.commit});
    return spec?idleAtCountTail(pool,plan,spec,worker,this.now()):idleAtAssignedTail(pool,worker,plan.target,this.now());
  }
  async status(){
    const c=(await this.store.get('state','campaign'))?.value;
    const holds=await this.transport.request('global_holds');
    const globalPaused=holds.some(x=>!x||x.value.active);
    if(!c)return {status:'paused',reason:'MIGRATION_REQUIRED',globalPaused:true};
    const counts={};for(const g of c.games)counts[g.status]=(counts[g.status]||0)+1;
    return {group:this.group,status:!c.enabled||globalPaused||c.protocolValidation?.runKey?'paused':c.games.every(x=>x.status==='complete')?'complete':'running',
      activeGame:c.activeGame,counts,globalPaused,protocolParkingEnabled:true,
      parkedGames:c.games.filter(x=>x.status==='parked-protocol').map(x=>x.game_id)};
  }
  async selectForRun(runKey){
    assert(/^capture-run:[0-9]+:[0-9]+$/.test(runKey),'RUN_BINDING_REQUIRED');
    const current=(await this.store.get('state','campaign')).value;
    if(current.protocolValidation){
      try{await this.store.update('state','campaign',v=>requireShortRun(v,runKey,this.commit)?v:null);}
      catch(error){if(error.message==='PROTOCOL_SHORT_REVIEW_REQUIRED')return {action:'stop',reason:error.message};throw error;}
    }
    const bound=(await this.store.get('state',runKey))?.value;
    const next=await this.select({expectedGame:bound?.gameId});
    if(next.plan){
      const saved=await this.store.create('state',runKey,{gameId:next.plan.gameId});
      if(saved.value.gameId!==next.plan.gameId)return {action:'stop',reason:'RUN_GAME_FINISHED'};
    }
    return next;
  }
  async finalizeStoppedRun(runKey){
    assert(/^capture-run:[0-9]+:[0-9]+$/.test(runKey),'RUN_BINDING_REQUIRED');
    const c=(await this.store.get('state','campaign')).value;
    const bound=(await this.store.get('state',runKey))?.value;
    // Finalizer never allocates another game or extends a short-run grant.
    if(c.validationLimit || c.protocolValidation || !bound || c.activeGame!==bound.gameId
      || c.games.find(g=>g.game_id===bound.gameId)?.status!=='parking-protocol')return;
    return this.select({expectedGame:bound.gameId});
  }
  async select({expectedGame}={}){
    await this.control.allowed({newRound:true});
    let c=(await this.store.get('state','campaign')).value;
    if(expectedGame!==undefined && c.activeGame!==expectedGame)return {action:'stop',reason:'RUN_GAME_FINISHED'};
    if(c.activeGame){
      const game=c.games.find(x=>x.game_id===c.activeGame),plan=this.plans[c.activeGame];assert(game&&plan);
      const pool=(await this.store.get('state','pool:'+plan.trialId))?.value;
      if(game.status==='parking-protocol'){
        if(!pool||Object.values(pool.workers).some(x=>x.leaseUntil>this.now()))return {action:'wait'};
        const evidence=[],generation=hash(pool),modern=pool.drainingProtocol===true;
        const prefix=modern?`parked-v2:${plan.trialId}:${generation}`:'parked-pool:'+plan.trialId;
        for(const w of Object.values(pool.workers)){
          if(!w.activeBatch)continue;
          const b=(await this.store.get('state',`batch:${plan.trialId}:${w.activeBatch.id}`))?.value;assert(b);
          if(b.pending?.awaiting||b.bootstrapAwaiting){await this.control.halt('UNKNOWN_SOURCE_OUTCOME',{trialId:plan.trialId});return {action:'stop'};}
          if(b.leaseUntil>this.now())return {action:'wait'};
          assert(b.checkpoint===b.journaled,'PARK_UNCONFIRMED_COMPLETE');
          const key=modern?`${prefix}:batch:${b.id}`:`parked:${plan.trialId}:${b.id}`;
          await this.store.create('journal',key,{batch:b,poolPlanHash:pool.planHash},{immutable:true});evidence.push({key,hash:hash(b)});
        }
        await this.store.create('journal',prefix,{pool,evidence},{immutable:true});
        assert(hash((await this.store.get('journal',prefix))?.value)===hash({pool,evidence}),'PARK_BACKUP_READBACK');
        const repairKey=`game-repair:${plan.trialId}:${generation}`;
        await this.store.create('state',repairKey,{schema:'sg-game-repair-v1',gameId:game.game_id,
          trialId:plan.trialId,status:'pending-adapter',archiveKey:prefix,evidence,
          sourceAllowance:0,requiresNewSession:true});
        await this.store.update('state','campaign',v=>{
          if(v.activeGame!==game.game_id || v.games.find(x=>x.game_id===game.game_id)?.status!=='parking-protocol')return null;
          const parked=v.games.find(x=>x.game_id===game.game_id);
          parked.status='parked-protocol';parked.repairKey=repairKey;v.activeGame=null;return v;
        });
        return {action:'wait'};
      }
      if(pool?.confirmed===plan.target){
        if(Object.values(pool.workers).some(x=>x.activeBatch||x.leaseUntil>this.now()))return {action:'wait'};
        let won=false;
        await this.store.update('state','campaign',v=>{
          won=false;
          if(v.activeGame!==plan.gameId)return null;
          if(v.audit?.until>this.now() && v.audit.owner!==this.owner)return null;
          v.audit={owner:this.owner,until:this.now()+30*60000,gameId:plan.gameId};won=true;return v;
        });
        return won?{action:'audit',plan}:{action:'wait'};
      }
      if(pool?.enabled&&!pool.failure)return {action:'capture',plan};
      return {action:'stop',reason:pool?.failure || 'POOL_NOT_READY'};
    }
    let selected;
    await this.store.update('state','campaign',v=>{
      if(v.activeGame){selected=v.activeGame;return null;}
      const next=v.games.find(x=>x.status==='ready');if(!next)return null;
      assert(this.plans[next.game_id],'UNADAPTED_GAME_NOT_ALLOCATABLE');
      assert(next.baseline+this.plans[next.game_id].target===300000,'TARGET_CHANGED');
      next.status='active';v.activeGame=next.game_id;selected=next.game_id;return v;
    });
    if(!selected)return {action:'stop',reason:'OWNED_READY_GAMES_EXHAUSTED'};
    const plan=this.plans[selected];assert(plan.buy===0 && plan.phase===1);
    await this.store.create('state','pool:'+plan.trialId,{schema:'sg-github-pool-v2',enabled:true,failure:null,
      planHash:hash(plan),nextSequence:1,nextBatchId:1,confirmed:0,workers:{}});
    return {action:'capture',plan};
  }
  async audit(plan){
    const pool=(await this.store.get('state','pool:'+plan.trialId)).value;
    assert(pool.confirmed===plan.target && Object.values(pool.workers).every(x=>!x.activeBatch&&x.leaseUntil<=this.now()));
    const countSpec=await loadCountPermission({store:this.store,plan,pool,commit:this.commit});
    if(countSpec)assert(pool.countAllocation.reserved===0,'COUNT_AUDIT_NOT_READY');
    let after=0,count=0;const digest=createHash('sha256'),rules=new GameRuleEvidence({plan}),sessionAuditCache=new Map();
    while(true){
      await this.store.writable();
      const rows=await this.transport.request('rounds_scan',{trialId:plan.trialId,after});if(!rows.length)break;
      for(const record of rows){
        assert(record.sequence>after && record.fixtureOnly===false && record.buy===0);
        if(countSpec)auditAllocatedRecord({pool,plan,spec:countSpec,record});else assert(record.sequence<=plan.target);
        if(countSpec)await auditCountBatch({store:this.store,plan,pool,spec:countSpec,record,cache:sessionAuditCache});
        else await auditSessionOwner({store:this.store,plan,pool,record,cache:sessionAuditCache});
        const verified=await this.analyzer.call({op:'verify',plan,raw:record.raw,record});
        if(countSpec)assert(verified?.verified===true,'COUNT_AUDIT_UNVERIFIED');
        rules.observeVerified(record);
        digest.update(stable([record._id,record.contentHash])+'\n');after=record.sequence;count++;
      }
    }
    assert(count===plan.target,'AUDIT_COUNT_INCOMPLETE');
    const proof={trialId:plan.trialId,planHash:hash(plan),fullReadback:count,recordsHash:digest.digest('hex')};
    const archive=rules.finish(proof);
    await this.store.create('journal',archive.key,archive.value,{immutable:true});
    await this.store.create('journal','game-audit:'+plan.trialId,proof,{immutable:true});
    await this.store.update('state','campaign',v=>{
      assert(v.activeGame===plan.gameId && v.audit?.owner===this.owner && v.audit.until>this.now(),'AUDIT_LEASE_LOST');
      const g=v.games.find(x=>x.game_id===plan.gameId);assert(g.baseline+count===300000);
      g.status='complete';g.confirmed=count;g.completed=this.now()/1000;v.activeGame=null;v.audit=null;return v;
    });
    return proof;
  }
}
