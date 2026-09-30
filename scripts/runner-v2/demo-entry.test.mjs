// Offline source/record test doubles; production campaign/controller/capture path.
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './demo-rollover.test.mjs';import {rolloverDemo} from './demo-rollover.mjs';
import {GithubCampaign} from './campaign.mjs';import {BatchController} from './batch-controller.mjs';
import {captureBatch} from '../trial/capture-batch.mjs';import {gameForShard} from '../trial/demo-sessions.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
for(const gameId of [32820,32835,32720])test('actual campaign/controller/new-session/capture preserves old records and enforces five BETs '+gameId,async()=>{
 const f=fixture();if(gameId!==32820){f.args.oldPlan.gameId=gameId;f.docs.get('state/campaign').value.games.find(g=>g.game_id===32820).game_id=gameId;f.args.activationStage={key:`next-demo-game:${f.args.oldPlan.trialId}:${'a'.repeat(64)}`,profileHash:hash('synthetic-profile')};}Object.assign(f.args.oldPlan,{campaignId:'sg_round_one_20260928',runtimeSlug:({32820:'beaverlasvegas',32835:'pyramidsofluxor96',32720:'hyperchargedjinzita96'})[gameId],sourceKey:({32820:'beaverlasvegas',32835:'pyramidsofluxor96',32720:'hyperchargedjinzita96'})[gameId]+'-round-one-base-v1',betRaw:gameId===32720?20:100,maxSteps:100,workers:20});
 f.args.plan={...f.args.oldPlan,demoGeneration:'a'.repeat(64)};const plan=f.args.plan;
 f.docs.get('state/pool:'+plan.trialId).value.planHash=hash(f.args.oldPlan);
 f.args.expected=hash({campaign:f.get('state','campaign').value,pool:f.get('state','pool:'+plan.trialId).value,fromPool:f.get('state','pool:'+f.args.fromPlan.trialId).value});
 await rolloverDemo(f.args);
 if(gameId!==32820){const a=f.args.activationStage;f.docs.set('journal/'+a.key+':complete',{value:{schema:'sg-next-demo-game-complete-v1',profileHash:a.profileHash,generation:plan.demoGeneration,commit:f.args.commit,run:f.args.run,newBetAllowance:100,sourceRequests:0}});}
 const base=f.args.store,store={...base,writable:async()=>{},create:async(c,k,v,o)=>{const old=await base.get(c,k);if(old)return old;await base.create(c,k,v,o);return base.get(c,k);},cas:async(c,k,prev,v)=>{const row={value:structuredClone(v),version:(prev.version||0)+1};f.docs.set(c+'/'+k,row);return structuredClone(row);}};
 f.docs.set('state/write-permits',{value:{limit:1,slots:{}}});
 const transport={request:async(op,p)=>{if(op==='rounds_insert'){for(const r of p.records)f.mongo.set(r._id,structuredClone(r));return {};}return f.args.transport.request(op,p);}};
 const control={allowed:async()=>store.get('state','pool:'+plan.trialId)},gate={status:()=>({allowed:true,maxBatchSize:100}),hold(){}};
 const runKey='capture-run:2:1',campaign=new GithubCampaign({store,transport,control,plans:{[plan.gameId]:plan},group:'primary',owner:'entry',commit:f.args.commit,now:f.args.now});
 assert.equal((await campaign.selectForRun(runKey)).action,'capture');
 const parser={call:async x=>{if(x.op==='intent')return {};if(x.op==='next')return null;assert.equal(x.op,'record');return {fixtureOnly:false,buy:0,_id:hash('new-'+x.sequence),contentHash:hash(x.raw),trialId:plan.trialId,batchId:x.batchId,shardId:x.worker,sourceSessionHash:x.sessionHash,sequence:x.sequence,raw:x.raw,normalized:{money:{endBalanceRaw:99900}}};}};
 const ctl=new BatchController({store,transport,control,gate,analyzer:parser,spool:{append(){},confirmed(){}},plan,group:'primary',pendingFirstStage:'fresh',runKey,now:f.args.now,sleep:async()=>{}});
 const baseGame={id:gameId,runtimeSlug:({32820:'beaverlasvegas',32835:'pyramidsofluxor96',32720:'hyperchargedjinzita96'})[gameId],serverAddress:'ogs-gdm-usnj.nyxop.net/nextgen',mode:'demo',sessionId:'Free:synthetic-only',operatorId:'synthetic-only'};
 // Session derivation uses a valid scoped trial; synthetic storage trial is separate.
 const game=gameForShard(baseGame,0,'sg_r1_20260928_'+gameId,plan),legacy=gameForShard(baseGame,0,'sg_r1_20260928_'+gameId,f.args.oldPlan);assert.notEqual(game.sessionId,legacy.sessionId);
 const identity={owner:'entry',shardId:0,sessionHash:hash(game.sessionId+'@'+game.operatorId),commitSha:f.args.commit,planHash:hash(plan)};
 const rpc=(op,r={})=>ctl.rpc(op,{shardId:0,...r});const registered=await rpc('register',identity),owner={owner:'entry',workerEpoch:registered.workerEpoch};const lease=await rpc('next',owner);
 assert.equal(lease.batchId,2);assert.equal(lease.pendingRound,null);assert.equal(lease.shortRunLimit,5);
 const owned={...owner,batchId:lease.batchId,epoch:lease.epoch},evidence={completedThisRun:0},messages=[];
 await captureBatch({plan,lease,owned,rpc,evidence,state:{balance:100000},payload:msg=>'MSGID='+msg,bootstrap:async()=>{throw Error('UNEXPECTED_BOOTSTRAP');},prepareRound:()=>({money:{endBalanceRaw:99900}}),post:async(payload,msgId)=>{assert.equal(f.get('state',ctl.batchKey).value.pending.awaiting,payload);messages.push(msgId);return {requestPayload:payload,msgId,responsePayload:'&NFG=0&',elapsedMs:1};},shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:5});
 assert.deepEqual(messages,Array(5).fill('BET'));assert.equal(f.mongo.size,7);assert.equal(evidence.completedThisRun,5);
 await assert.rejects(rpc('begin',{...owned,sequence:106,attempt:'00000000-0000-0000-0000-000000000001',startBalanceRaw:99900,requestPayload:'MSGID=BET'}),/QUOTA_EXHAUSTED/);
 assert.equal(f.get('state','batch:'+plan.trialId+':1').value.sessionHash,'old');
});

