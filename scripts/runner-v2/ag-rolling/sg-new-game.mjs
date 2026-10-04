import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {taskKey} from './sg-task-store.mjs';
import {stagingPrefix,stagingLeaseKey} from './sg-staging-store.mjs';
// Native Mongo returns fixed reads only. GitHub decides whether an appended
// game is genuinely empty, including official rows from any historical trial.
export async function inspectNewGame({store,transport,game,queueId,plan,guard}){
 assert(game.baseline===0&&String(plan.gameId)===game.gameId,'SG_NEW_GAME_BASELINE');
 const scopes=[...[1,2].map(i=>['canary',i]),...Array.from({length:20},(_,i)=>['worker',i+1])];
 const merge='rolling-merge:'+queueHash([queueId,game.gameId,game.campaignId]);
 const inspect=async()=>{
  await guard();
  const keys=scopes.flatMap(([kind,i])=>[taskKey(queueId,game,`${kind}:${i}`),stagingLeaseKey(queueId,game,kind,i)]).concat(merge);
  const state=await store.getMany('state',keys);
  assert(state.length===keys.length&&state.every(r=>r===null),'SG_NEW_GAME_EXISTING_STATE');
  assert(!await store.get('journal',merge+':complete'),'SG_NEW_GAME_EXISTING_COMPLETION');
  const campaigns=await transport.request('rolling_campaign_baselines');
  assert(Array.isArray(campaigns)&&campaigns.length===2
   &&['primary/campaign','secondary/campaign'].every(id=>campaigns.filter(c=>c?._id===id).length===1)
   &&campaigns.every(c=>Array.isArray(c.value?.games)),'SG_NEW_GAME_CAMPAIGN_REQUIRED');
  const history=campaigns.flatMap(c=>c.value.games).filter(g=>g.game_id===Number(game.gameId));
  assert(history.length===1&&history[0].baseline===0&&history[0].confirmed===0&&history[0].status!=='complete',
   'SG_NEW_GAME_HISTORICAL_BASELINE');
  const count=await transport.request('rounds_game_count',{trialId:plan.trialId});
  assert(count?.gameId===Number(game.gameId)&&count.count===0,'SG_NEW_GAME_HISTORICAL_RECORDS');
 };
 await inspect();
 for(const [kind,i] of scopes){
  await guard();const prefix=stagingPrefix(queueId,game,kind,i);
  const rows=await transport.request('scan',{collection:'journal',key:prefix,after:'primary/'+prefix});
  assert(Array.isArray(rows)&&rows.length===0,'SG_NEW_GAME_ORPHAN_STAGING');
 }
 // Source admission is fenced and serial. Repeat the native reads after all
 // indexed staging checks instead of trusting a builder's older snapshot.
 await inspect();return {status:'empty',gameId:game.gameId,count:0,sourceRequests:0};
}
