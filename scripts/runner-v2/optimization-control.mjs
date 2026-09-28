// Source-free maintenance activation and full short-capture verification, on GitHub.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {stable} from './mongo-writer.mjs';
import {receiptKey} from './durable-queue.mjs';
import {analyzer} from './analyzer.mjs';
import {repositories} from '../trial/runner-group.mjs';

const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
export async function optimize({group,stage,plans,transport,gate,store,parser,commit,now=Date.now}){
  assert(['primary','secondary'].includes(group) && ['short','validate','formal'].includes(stage));
  const campaign=(await store.get('state','campaign')).value;
  const boundary=campaign.operatorBoundary;
  assert(boundary?.reason==='USER_REQUESTED_OPTIMIZATION_AFTER_CURRENT_GAME','BOUNDARY_REQUIRED');
  const oldPlan=plans[boundary.activeGame],oldPool=(await store.get('state','pool:'+oldPlan.trialId)).value;
  const audit=(await store.get('journal','game-audit:'+oldPlan.trialId))?.value;
  assert(campaign.games.find(g=>g.game_id===oldPlan.gameId)?.status==='complete'
    && audit?.fullReadback===oldPlan.target && audit.planHash===hash(oldPlan)
    && oldPool.planHash===hash(oldPlan) && oldPool.confirmed===oldPlan.target,'CURRENT_GAME_NOT_AUDITED');
  assert(Object.values(oldPool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now()),'OLD_WORKERS_ACTIVE');
  const holds=await transport.request('global_holds');
  assert(holds.length===2 && holds.every(x=>x && x.value.active===false),'GLOBAL_FAULT_REQUIRES_REVIEW');
  await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  if(stage==='short'){
    assert(campaign.activeGame===null && !boundary.stage,'SHORT_ALREADY_ACTIVATED');
    const held=campaign.games.filter(g=>g.status==='operator-wait').map(g=>g.game_id);
    assert(stable(held)===stable(boundary.readyGames),'HELD_QUEUE_CHANGED');
    const proof={campaign,oldPoolHash:hash(oldPool),audit,commit};
    await store.create('journal','optimization-before-20260928',proof,{immutable:true});
    await store.update('state','campaign',v=>{
      assert(stable(v)===stable(campaign),'CAMPAIGN_CHANGED');
      for(const g of v.games)if(held.includes(g.game_id)){assert(g.status==='operator-wait');g.status='ready';}
      v.enabled=true;v.reason=null;v.validationLimit=10;
      v.operatorBoundary={...v.operatorBoundary,stage:'short',proofHash:hash(proof)};return v;
    });
    return {group,stage,previousGameFullReadback:audit.fullReadback,validationLimit:10,sourceRequests:0};
  }else{
    assert(boundary.stage==='short' && campaign.validationLimit===10,'VALIDATION_STAGE_REQUIRED');
    const plan=plans[campaign.activeGame];
    assert(plan && boundary.readyGames.includes(plan.gameId),'WRONG_VALIDATION_GAME');
    const pool=(await store.get('state','pool:'+plan.trialId)).value;
    assert(!pool.failure && Object.values(pool.workers).every(w=>w.leaseUntil<=now()),'ACTIVE_OR_HALTED_POOL');
    if(stage==='validate'){
      let total=0,after=0,journaled=0;const workerCounts={},batches=new Map();
      for(let id=1;id<pool.nextBatchId;id++){
        const b=(await store.get('state',`batch:${plan.trialId}:${id}`))?.value;
        assert(b && !b.pending && !b.bootstrapAwaiting && !b.failure && b.journaled===b.checkpoint,'UNSETTLED_BATCH');
        batches.set(id,b);journaled+=b.journaled-b.start+1;
      }
      while(true){
        const rows=await transport.request('rounds_scan',{trialId:plan.trialId,after});if(!rows.length)break;
        const saved=await store.getMany('journal',rows.map(r=>receiptKey(plan.trialId,r.sequence)));
        for(const [i,record] of rows.entries()){
          assert(record.sequence>after && record.sequence<=plan.target,'BAD_SEQUENCE');
          assert(stable(saved[i]?.value)===stable(record),'FULL_JOURNAL_MONGO_MISMATCH');
          assert(pool.workers[String(record.shardId)]?.sessionHash===record.sourceSessionHash,'SESSION_CHANGED');
          const b=batches.get(record.batchId);assert(b && b.worker===record.shardId && record.sequence>=b.start && record.sequence<=b.journaled,'BATCH_CHANGED');
          await parser.call({op:'verify',plan,record,raw:record.raw});
          workerCounts[record.shardId]=(workerCounts[record.shardId]||0)+1;total++;after=record.sequence;
        }
      }
      assert(total===journaled && total===200 && Object.keys(workerCounts).length===20
        && Object.values(workerCounts).every(n=>n===10),'SHORT_COUNTS_INCOMPLETE');
      assert(stable((await store.get('state','pool:'+plan.trialId)).value)===stable(pool),'POOL_CHANGED');
      const result={group,trialId:plan.trialId,proofHash:boundary.proofHash,fullReadback:total,workersVerified:20,
        pending:0,poolHash:hash(pool),at:now(),commit};
      await store.create('journal','optimization-validation-20260928',result,{immutable:true});
      return result;
    }else{
      const proof=(await store.get('journal','optimization-validation-20260928'))?.value;
      assert(proof?.trialId===plan.trialId && proof.proofHash===boundary.proofHash && proof.fullReadback===200
        && proof.workersVerified===20 && proof.pending===0 && proof.poolHash===hash(pool)
        && now()>=proof.at && now()-proof.at<15*60000,'SHORT_PROOF_STALE_OR_CHANGED');
      await store.create('journal','optimization-formal-20260928',{proof,commit},{immutable:true});
      await store.update('state','campaign',v=>{
        assert(stable(v)===stable(campaign),'CAMPAIGN_CHANGED');v.validationLimit=0;v.operatorBoundary.stage='formal';return v;
      });
      return {group,stage,trialId:plan.trialId,validationLimit:0,sourceRequests:0};
    }
  }
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const group=repositories[process.env.GITHUB_REPOSITORY]?.name,stage=process.argv[2];
  const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'));
  const transport=connectGateway(),gate=new ResourceGate(),parser=analyzer();
  const store=new RunnerState({transport,gate,deadline:Date.now()+15*60000});
  try{
    console.log(JSON.stringify(await optimize({group,stage,plans,transport,gate,store,parser,commit:process.env.GITHUB_SHA})));
  }catch(error){
    console.log(JSON.stringify({group,stage,error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'OPTIMIZATION_REVIEW_REQUIRED'}));
    process.exitCode=2;
  }finally{parser.close();transport.close();}
}
