import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {candidateDocument} from './ag-rolling/sg-historical-starmania-document.mjs';
const w=path.dirname(fileURLToPath(import.meta.url));
const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json'))['32737'];
const binding={gameId:32737,runtimeGameId:33137,trialId:plan.trialId,runtimeSlug:plan.runtimeSlug,database:'sg_starmania',rtp:[0,30,100],typeMappingHash:'f'.repeat(64)};
function fixture(){const f={sourceKey:plan.sourceKey,typeMappingHash:binding.typeMappingHash,roundFieldsVersion:'sg-round-fields-v1',bet:0.5,mul:2,buy:0,bonus:0,primaryBonusKind:'none',money:{startBalanceRaw:10000,endBalanceRaw:10050,betRaw:50,totalWinRaw:100}};
 return {_id:'a'.repeat(64),contentHash:'b'.repeat(64),fixtureOnly:false,trialId:plan.trialId,gameId:32737,runtimeGameId:33137,sequence:1968,batchId:21,shardId:18,raw:{fixtureOnly:false,sourceKey:plan.sourceKey,steps:[{msgId:'BET',responseBalance:10050}]},normalized:f,...Object.fromEntries(['bet','mul','buy','bonus','roundFieldsVersion'].map(k=>[k,f[k]]))};}
const python=code=>spawnSync(process.env.PYTHON??'python3',['-B','-c',code],{cwd:process.cwd(),input:JSON.stringify({r:fixture(),b:binding,p:plan}),encoding:'utf8',env:{...process.env,PYTHONPATH:'',PYTHONUTF8:'1'}});
test('both implementations retain the historical campaign, irregular batch, shard and sequence',()=>{
 const r=fixture(),d=candidateDocument(r,binding,plan);
 assert.equal(d.data.captureSourceCampaignId,'sg_round_one_20260928');assert.equal(d.data.captureBatchId,21);assert.equal(d.data.captureNativeShardId,18);assert.equal(d.data.captureSequence,1968);
 assert(!Object.hasOwn(d.data,'captureWorkerIndex'));assert(!Object.hasOwn(d.data,'captureCampaignId'));
 const py=python("import json,sys;sys.path.insert(0,'scripts/runner-v2');from historical_starmania_business_candidate import candidate;q=json.load(sys.stdin);print(json.dumps(candidate(q['r'],q['b'],q['p'])))");assert.equal(py.status,0);assert.deepEqual(JSON.parse(py.stdout),d);
});
test('each implementation rejects foreign game, a rolling binding, unknown type and changed cash',()=>{
 for(const alter of [r=>r.gameId=32731,r=>r.normalized.primaryBonusKind='feature',r=>r.normalized.money.endBalanceRaw++,r=>r.shardId=20]){const r=fixture();alter(r);assert.throws(()=>candidateDocument(r,binding,plan));}
 assert.throws(()=>candidateDocument(fixture(),{...binding,queueId:'rolling'},plan));
 const py=python("import copy,json,sys;sys.path.insert(0,'scripts/runner-v2');from historical_starmania_business_candidate import candidate;q=json.load(sys.stdin);cases=[]\nr=copy.deepcopy(q['r']);r['gameId']=32731;cases.append((r,q['b']))\nr=copy.deepcopy(q['r']);r['normalized']['primaryBonusKind']='feature';cases.append((r,q['b']))\nr=copy.deepcopy(q['r']);r['normalized']['money']['endBalanceRaw']+=1;cases.append((r,q['b']))\nr=copy.deepcopy(q['r']);r['shardId']=20;cases.append((r,q['b']))\ncases.append((q['r'],{**q['b'],'queueId':'rolling'}))\nfor r,b in cases:\n try:candidate(r,b,q['p'])\n except AssertionError:continue\n raise Exception('accepted invalid historical candidate')\nprint('all five rejected')");assert.equal(py.status,0);assert.equal(py.stdout.trim(),'all five rejected');
});
test('each implementation preserves source data and only maps the own free-game type',()=>{
 const r=fixture();r.bonus=r.normalized.bonus=1;r.normalized.primaryBonusKind='freeGame';const before=JSON.stringify(r),d=candidateDocument(r,binding,plan);
 assert.deepEqual(d.data.specialKinds,['freeGame']);d.data.steps[0].msgId='mutated';assert.equal(JSON.stringify(r),before);
 const py=python("import copy,json,sys;sys.path.insert(0,'scripts/runner-v2');from historical_starmania_business_candidate import candidate;q=json.load(sys.stdin);r=q['r'];r['bonus']=r['normalized']['bonus']=1;r['normalized']['primaryBonusKind']='freeGame';before=copy.deepcopy(r);d=candidate(r,q['b'],q['p']);assert d['data']['specialKinds']==['freeGame'];d['data']['steps'][0]['msgId']='mutated';assert r==before;print('own type and original values preserved')");assert.equal(py.status,0);
});
