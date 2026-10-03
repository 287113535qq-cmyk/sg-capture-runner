import assert from 'node:assert/strict';
import {TARGET,LANES,taskId,stagingName} from './ag-core.mjs';
const safeId=/^[A-Za-z0-9._-]{1,100}$/;
export function validateSgPayload(payload,manifest){
 // AG's payload fields and task contract are unchanged. SG's native transport
 // resolves the dbName and mongoUri to a registered staging scope; no direct
 // connection to AG databases or production Mongo is introduced.
 assert(payload?.version===1&&safeId.test(payload.queueId??'')&&Array.isArray(payload.games)
  &&payload.games.length>0&&payload.games.length<=manifest.length,'AG_ROLLING_PAYLOAD');
 const ids=new Set(),dbs=new Set(),campaigns=new Set();
 for(const game of payload.games){
  assert(Object.keys(game).sort().join(',')==='baseline,campaignId,dbName,gameId,mongoUri','AG_ROLLING_GAME_FIELDS');
  assert(typeof game.gameId==='string'&&typeof game.dbName==='string'&&safeId.test(game.dbName)
   &&typeof game.campaignId==='string'&&safeId.test(game.campaignId)
   &&Number.isSafeInteger(game.baseline)&&game.baseline>=0&&game.baseline<TARGET
   &&typeof game.mongoUri==='string','AG_ROLLING_GAME');
  const target=manifest.find(g=>g.gameId===game.gameId&&g.dbName===game.dbName);
  assert(target&&target.mongoUri===game.mongoUri&&target.phase==='ready'&&target.baseline===game.baseline
   &&target.campaignId===game.campaignId,'SG_REGISTERED_GAME_SCOPE');
  assert(!ids.has(game.gameId)&&!dbs.has(game.dbName)&&!campaigns.has(game.campaignId),'AG_ROLLING_DUPLICATE');
  ids.add(game.gameId);dbs.add(game.dbName);campaigns.add(game.campaignId);
 }
 assert(LANES===20);return payload;
}
export function taskEnvironment(game,kind,index,quota,owner,inherited={}){
 taskId(kind,index);assert(Number.isSafeInteger(quota)&&quota>=0,'AG_QUOTA');
 const env={};for(const k of ['PATH','Path','HOME','USERPROFILE','SystemRoot','TEMP','TMP','TMPDIR','LANG','CI']){
  if(inherited[k]!==undefined)env[k]=inherited[k];
 }
 // The same AG per-task isolation and concurrency values, with SG's adapter
 // consuming the task identity instead of the AG executable's HTTP protocol.
 return {...env,ONLY_GAME:game.gameId,CAPTURE_CAMPAIGN_ID:game.campaignId+(kind==='canary'?'-canary':''),
  CAPTURE_WORKER_INDEX:String(index),CAPTURE_OWNER_ID:owner,CAPTURE_LEASE_ID:`gh_${game.campaignId}_${kind}_${index}`,
  SG_STAGING_SCOPE:stagingName(game,index,kind),SPIN_LIMIT:String(quota),CONCURRENT_PER_GAME:kind==='canary'?'1':'8',
  SPIN_DELAY_MS:'200',RETRY_ATTEMPTS:'5',RETRY_DELAY_MS:'2000',LOG_INTERVAL:'250'};
}
