import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import yaml from 'js-yaml';
import {capturePlatform,gameManifestPath,safeDatabaseName,safeGameId,controllerRepository} from '../src/ag.platform';
import {loadGames} from '../ag';import {loadGameTargets,resolveGameTarget} from '../scripts/game-target';
import {childEnvironment} from '../scripts/rolling-worker';
test('AG default configuration and explicit SG identifiers remain separate',()=>{
 assert.equal(capturePlatform({}),'ag');assert.equal(controllerRepository({}),'try-catch/ag-capture');
 assert.equal(safeDatabaseName('sg_crystal_forest','ag'),false);assert.equal(safeGameId('32759','ag'),false);
 assert.equal(safeDatabaseName('sg_crystal_forest','sg'),true);assert.equal(safeGameId('32759','sg'),true);
 for(const db of ['admin','ag_test','sg_../test','sg_A','sg_$x','sg_/x'])assert.equal(safeDatabaseName(db,'sg'),false);
 assert.throws(()=>controllerRepository({AG_CAPTURE_PLATFORM:'sg'}));
 assert.throws(()=>capturePlatform({AG_CAPTURE_PLATFORM:'unknown'}));
});
test('SG child retains original AG quota/ownership with only its own connection configuration',()=>{
 const game={gameId:'32759',dbName:'sg_crystal_forest',campaignId:'own-campaign',baseline:10,mongoUri:'fixture'};
 const env=childEnvironment(game,'canary',2,10,'owner',{AG_CAPTURE_PLATFORM:'sg',SG_AG_ALLOW_SOURCE:'1',SG_EVIDENCE_DIR:'/tmp/own',AG_GAMES_MANIFEST:'sg-games.yml',SECRET_OTHER:'no',AG_ROLLING_PAYLOAD:'no'});
 assert.equal(env.SPIN_LIMIT,'10');assert.equal(env.CONCURRENT_PER_GAME,'1');assert.equal(env.SG_AG_ALLOW_SOURCE,'1');
 assert.equal(env.AG_CAPTURE_PLATFORM,'sg');assert.equal(env.SECRET_OTHER,undefined);assert.equal(env.AG_ROLLING_PAYLOAD,undefined);
 assert.equal(env.CAPTURE_OWNER_ID,'owner');assert.equal(env.AG_GAMES_MANIFEST,gameManifestPath({AG_CAPTURE_PLATFORM:'sg'}));
});
test('whole AG loaders use SG own server bindings and reject a substituted database',()=>{
 const previous=process.env.AG_CAPTURE_PLATFORM;process.env.AG_CAPTURE_PLATFORM='sg';
 try {
  const manifest=loadGameTargets(gameManifestPath());assert.equal(manifest.length,12);
  const actual=loadGames();assert.equal(actual.length,12);assert(actual.every(g=>g.provider==='sg'));
  assert.equal(resolveGameTarget(manifest,'32749','sg_fivetreasures').gameId,'32749');
  assert.throws(()=>resolveGameTarget(manifest,'32749','sg_wrongpool'),/mismatch/);
  for(const game of actual){assert(game.sg.runtimeSlug);assert.equal(game.backendId,game.sg.header.gameCodeRGI);}
 }finally {if(previous===undefined)delete process.env.AG_CAPTURE_PLATFORM;else process.env.AG_CAPTURE_PLATFORM=previous;}
});
