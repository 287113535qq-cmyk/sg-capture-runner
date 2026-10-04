import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectFormalBaseline} from './sg-formal-baseline.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {taskKey} from './sg-task-store.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
const game={gameId:'32441',dbName:'sg_32441',campaignId:'sg_32441-queue',baseline:0},plan={gameId:32441,trialId:'fixed-trial'};
function fixture(){
 const docs=new Map(),calls=[],profile={payload:{queueId:'queue'},resume:{previousRun:'123:1'}};
 const ended={status:'completed',sourceJobsEnded:true,queueId:'queue',run:'123:1'};
 const key='rolling-merge:'+queueHash(['queue',game.gameId,game.campaignId]);
 const proof={schema:'sg-ag-rolling-complete-v1',queueId:'queue',gameId:game.gameId,campaignId:game.campaignId,
  trialId:plan.trialId,baseline:0,count:300000,fullReadback:true,independentlyVerified:true,recordsHash:'a'.repeat(64)};
 const state={status:'complete',queueId:'queue',gameId:game.gameId,result:proof};
 docs.set('state/'+key,{value:structuredClone(state)});docs.set('journal/'+key+':complete',{value:structuredClone(proof)});
 for(const [kind,total] of [['canary',2],['worker',20]])for(let index=1;index<=total;index++){
  const id=kind+':'+index,owner='old-owner:'+id,count=kind==='canary'?10:15000;
  const p={queueId:'queue',gameId:game.gameId,campaignId:game.campaignId,taskId:id,owner,count,recordsHash:'b'.repeat(64),
   fullReadback:true,independentlyVerified:true,pending:0,unknownRequests:0,activeLeases:0};
  docs.set('state/'+taskKey('queue',game,id),{value:{_id:id,queueId:'queue',campaignId:game.campaignId,
   status:'success',exitCode:0,owner,count,proof:p}});
 }
 const store={async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},async getMany(c,keys){return Promise.all(keys.map(k=>this.get(c,k)));}};
 let count=300000;
 const transport={async request(op,args){calls.push({op,args});assert.equal(op,'rounds_count');return {count};}};
 return {profile,ended,game,plan,store,transport,docs,calls,key,setCount:n=>{count=n;}};
}
test('settled completed game crosses windows without recreating deleted staging or issuing source/storage writes',async()=>{
 const f=fixture(),before=queueHash([...f.docs]);const result=await inspectFormalBaseline(f);
 assert.equal(result.status,'complete');assert.equal(result.count,300000);assert.equal(result.sourceRequests,0);
 assert.equal(queueHash([...f.docs]),before);assert.equal(f.calls.length,2);assert.ok(f.calls.every(c=>c.op==='rounds_count'));
});
test('new queue accepts empty formal storage but never native counts as completion evidence',async()=>{
 const f=fixture();f.profile.resume=undefined;f.setCount(0);f.docs.delete('state/'+f.key);
 assert.equal((await inspectFormalBaseline(f)).status,'empty');f.setCount(300000);
 await assert.rejects(()=>inspectFormalBaseline(f),/FORMAL_BASELINE_CHANGED/);
});
test('completed baseline requires the ended original window and matching immutable full-readback proof',async()=>{
 for(const damage of [f=>{f.ended.status='in_progress';},f=>{f.ended.run='different';},
  f=>{f.docs.get('journal/'+f.key+':complete').value.recordsHash='c'.repeat(64);},
  f=>{f.docs.get('state/'+f.key).value.result.fullReadback=false;},f=>f.setCount(299999),f=>f.setCount(0)]){
  const f=fixture();damage(f);await assert.rejects(()=>inspectFormalBaseline(f),/BASELINE/);
 }
});
test('one changed task or live canary lease blocks completed-game reuse',async()=>{
 const f=fixture(),task=f.docs.get('state/'+taskKey('queue',game,'worker:9'));
 task.value.proof.unknownRequests=1;await assert.rejects(()=>inspectFormalBaseline(f),/TASK_PROOF/);task.value.proof.unknownRequests=0;
 f.docs.set('state/'+stagingLeaseKey('queue',game,'canary',2),{value:{owner:'live',expiresAt:Date.now()+60000}});
 await assert.rejects(()=>inspectFormalBaseline(f),/LIVE_LEASE/);
});
test('partial merge retains all evidence and requires ended-actor settlement before source admission',async()=>{
 for(const count of [0,150000]){
  const f=fixture();f.setCount(count);f.docs.get('state/'+f.key).value.status='merging';
  const before=queueHash([...f.docs]);await assert.rejects(()=>inspectFormalBaseline(f),/FORMAL_MERGE_UNSETTLED/);
  assert.equal(queueHash([...f.docs]),before);
 }
});
