import assert from 'node:assert/strict';
import {protocolHash as hash} from '../protocol-resume.mjs';
export function formalSourceFixture(){
 const plan={gameId:32795,trialId:'synthetic-formal-source',buy:0,phase:1,target:300000,countAllocation:'a'.repeat(64)},commit='b'.repeat(40);
 const batches=Array.from({length:3000},(_,i)=>({id:i+1,worker:i%20,start:i*100+1,end:(i+1)*100,checkpoint:(i+1)*100,journaled:(i+1)*100,sessionHash:hash(i),pending:null,leaseUntil:0}));
 const spec={schema:'sg-complete-count-v1',activation:plan.countAllocation,planHash:hash(plan),gameId:plan.gameId,trialId:plan.trialId,profileHash:'f'.repeat(64),commit,target:300000,maxSequence:600000,firstSequence:501,baselineBatchCount:5,sessionRotation:'closed-batches-v1'};
 const pool={enabled:true,failure:null,planHash:hash(plan),nextBatchId:3001,nextSequence:300001,confirmed:300000,workers:{},countAllocation:{specHash:hash(spec),reserved:0,batches:Object.fromEntries(batches.map(b=>[b.id,{id:b.id,worker:b.worker,start:b.start,end:b.end,sessionHash:b.sessionHash,closed:true,complete:100,evidenceHash:hash(b)}]))}};
 const settlements=new Map();
 for(const b of batches.slice(5)){const key=`count-settlement:${plan.trialId}:${spec.activation}:${b.id}`,value={schema:'sg-count-batch-settlement-v1',activation:spec.activation,trialId:plan.trialId,fullReadback:true,batch:b};settlements.set(key,value);Object.assign(pool.countAllocation.batches[b.id],{settlementKey:key,evidenceHash:hash(value)});}
 spec.baselineHash=hash(Object.values(pool.countAllocation.batches).slice(0,5));pool.countAllocation.specHash=hash(spec);
 const campaign={activeGame:null,audit:null,games:[{game_id:32795,status:'complete',baseline:0,confirmed:300000}]},proof={trialId:plan.trialId,planHash:hash(plan),fullReadback:300000,recordsHash:'e'.repeat(64)};
 const docs=new Map([['state/campaign',campaign],['state/pool:'+plan.trialId,pool],['journal/game-audit:'+plan.trialId,proof],['journal/complete-count:'+plan.trialId+':'+plan.countAllocation,spec],['journal/complete-count:'+plan.trialId+':'+plan.countAllocation+':complete',{schema:'sg-complete-count-activation-v1',specHash:hash(spec),planHash:hash(plan),trialId:plan.trialId,commit}]]);
 for(const [k,v]of settlements)docs.set('journal/'+k,v);
 for(const b of batches)docs.set(`state/batch:${plan.trialId}:${b.id}`,b);
 const sizes=[],store={get:async(c,k)=>docs.has(c+'/'+k)?{value:structuredClone(docs.get(c+'/'+k))}:null,getMany:async(c,ks)=>{sizes.push(ks.length);assert(ks.length<=100);return ks.map(k=>docs.has(c+'/'+k)?{value:structuredClone(docs.get(c+'/'+k))}:null);}};
 const permit={schema:'sg-count-run-v1',run:'77:1',commit,activation:spec.activation,profileHash:spec.profileHash};docs.set('journal/count-run:'+plan.trialId+':77:1',permit);
 const profile={sourceFormal:{schema:'sg-formal-source-boundary-v1',kind:'complete',commit,run:'77:1',runPermitHash:hash(permit),planHash:hash(plan),campaignHash:hash(campaign),poolHash:hash(pool),proofKey:'game-audit:'+plan.trialId,proofHash:hash(proof),specHash:hash(spec)}};
 return {args:{store,plan,profile,scene:{campaign,fromPool:pool,sourceBatches:batches},now:()=>100},docs,sizes};
}
