// Synthetic source/parser; production campaign, controller, generation and capture.
import test from 'node:test';import assert from 'node:assert/strict';
import {residualFixture} from './demo-residual.test.mjs';import {rolloverDemoResidual} from './demo-residual.mjs';
import {GithubCampaign} from './campaign.mjs';import {BatchController} from './batch-controller.mjs';
import {captureBatch} from '../trial/capture-batch.mjs';import {gameForShard} from '../trial/demo-sessions.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
for(const [worker,quota] of [[0,4],[1,0],[3,5]])test('residual production entry worker'+worker+' permits only '+quota+' new BETs',async()=>{
 const f=await residualFixture();await rolloverDemoResidual(f.args);const plan=f.args.plan;
 const base=f.args.store,store={...base,writable:async()=>{},create:async(c,k,v,o)=>{const old=await base.get(c,k);if(old)return old;await base.create(c,k,v,o);return base.get(c,k);},cas:async(c,k,prev,v)=>{const row={value:structuredClone(v),version:(prev.version||0)+1};f.docs.set(c+'/'+k,row);return structuredClone(row);}};
 f.docs.set('state/write-permits',{value:{limit:1,slots:{}}});
 const transport={request:async(op,p)=>{if(op==='rounds_insert'){for(const r of p.records)f.mongo.set(r._id,structuredClone(r));return {};}return f.args.transport.request(op,p);}};
 const control={allowed:async()=>store.get('state','pool:'+plan.trialId)},gate={status:()=>({allowed:true,maxBatchSize:100}),hold(){}};
 const runKey='capture-run:24:1',campaign=new GithubCampaign({store,transport,control,plans:{[plan.gameId]:plan},group:'primary',owner:'entry',commit:f.args.commit,now:f.args.now});
 assert.equal((await campaign.selectForRun(runKey)).action,'capture');
 const parser={call:async x=>{if(x.op==='intent')return {};if(x.op==='next')return null;assert.equal(x.op,'record');return {fixtureOnly:false,buy:0,_id:hash('new-'+x.sequence),contentHash:hash(x.raw),trialId:plan.trialId,batchId:x.batchId,shardId:x.worker,sourceSessionHash:x.sessionHash,sequence:x.sequence,raw:x.raw,normalized:{money:{endBalanceRaw:99900}}};}};
 const ctl=new BatchController({store,transport,control,gate,analyzer:parser,spool:{append(){},confirmed(){}},plan,group:'primary',pendingFirstStage:'fresh',runKey,now:f.args.now,sleep:async()=>{}});
 const baseGame={id:32820,runtimeSlug:'beaverlasvegas',serverAddress:'ogs-gdm-usnj.nyxop.net/nextgen',mode:'demo',sessionId:'Free:synthetic-only',operatorId:'synthetic-only'};
 // Session derivation uses a valid scoped trial; synthetic storage trial is separate.
 const game=gameForShard(baseGame,worker,'sg_r1_20260928_32820',plan),legacy=gameForShard(baseGame,worker,'sg_r1_20260928_32820',f.args.oldPlan);assert.notEqual(game.sessionId,legacy.sessionId);
 const identity={owner:'entry',shardId:worker,sessionHash:hash(game.sessionId+'@'+game.operatorId),commitSha:f.args.commit,planHash:hash(plan)};
 const rpc=(op,r={})=>ctl.rpc(op,{shardId:worker,...r});const registered=await rpc('register',identity),owner={owner:'entry',workerEpoch:registered.workerEpoch};const lease=await rpc('next',owner);
 if(quota===0){assert.equal(lease.done,true);assert.equal(f.mongo.size,62);return;}assert.equal(lease.batchId,15);assert.equal(lease.pendingRound,null);assert.equal(lease.shortRunLimit,quota);
 const owned={...owner,batchId:lease.batchId,epoch:lease.epoch},evidence={completedThisRun:0},messages=[];
 await captureBatch({plan,lease,owned,rpc,evidence,state:{balance:100000},payload:msg=>'MSGID='+msg,bootstrap:async()=>{throw Error('UNEXPECTED_BOOTSTRAP');},prepareRound:()=>({money:{endBalanceRaw:99900}}),post:async(payload,msgId)=>{assert.equal(f.get('state',ctl.batchKey).value.pending.awaiting,payload);messages.push(msgId);return {requestPayload:payload,msgId,responsePayload:'&NFG=0&',elapsedMs:1};},shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:quota});
 assert.deepEqual(messages,Array(quota).fill('BET'));assert.equal(f.mongo.size,62+quota);assert.equal(evidence.completedThisRun,quota);
 await assert.rejects(rpc('begin',{...owned,sequence:lease.sequenceBase+quota+1,attempt:'00000000-0000-0000-0000-000000000001',startBalanceRaw:99900,requestPayload:'MSGID=BET'}),/QUOTA_EXHAUSTED/);
 assert.equal(f.get('state','batch:'+plan.trialId+':1').value.sessionHash,'old');
});
