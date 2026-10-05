import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {analyzer} from './analyzer.mjs';import {stable} from './mongo-writer.mjs';
import {businessDocument} from './ag-rolling/sg-business-document.mjs';
import {inspectExistingOrdinary} from './ag-rolling/sg-existing-business.mjs';
import {deliverPage,missingDocuments,assertCompleteBinding,digest,verifyLegacyPage} from './ag-rolling/sg-business-delivery.mjs';
import {verifyBusinessLinuxEvidence,requireBusinessLinux,BUSINESS_LINUX_REPOSITORY,BUSINESS_BRANCH} from './ag-rolling/sg-business-linux.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32442'];
const binding=JSON.parse(fs.readFileSync('config/ag-business-bindings.json')).bindings['32442'];const campaignId='sg_32442-'+binding.queueId;
function linuxFixture(){let n=0;return {run:{id:123,repository:{full_name:BUSINESS_LINUX_REPOSITORY},head_sha:'a'.repeat(40),head_branch:BUSINESS_BRANCH,run_attempt:1,event:'workflow_dispatch',path:'.github/workflows/preflight.yml',status:'completed',conclusion:'success'},jobs:{total_count:1,jobs:[{id:456,run_id:123,name:'preflight',status:'completed',conclusion:'success'}]},result:{schema:'sg-offline-preflight-v1',passed:true,complete:true,sourceRequests:0,mongoWrites:0,runs:[{workers:3,passed:true,groups:Object.entries({'python':8,'collector-protocol':3,'runner-persistence':3}).map(([group,count])=>({group,passed:true,expectedCommands:count,commands:Array.from({length:count},()=>({exitCode:0,argvHash:(++n).toString(16).padStart(64,'0')}))}))}]}};}
test('business writes require exact successful branch Linux with all fourteen joined checks',()=>{
 const f=linuxFixture();assert.equal(verifyBusinessLinuxEvidence(f,123,'a'.repeat(40)).joinedCommands,14);
 for(const edit of [x=>x.run.head_sha='b'.repeat(40),x=>x.run.head_branch='main',x=>x.run.run_attempt=2,x=>x.jobs.total_count=2,x=>x.jobs.jobs[0].conclusion='cancelled',x=>x.result.runs[0].groups.pop(),x=>x.result.runs[0].groups[0].commands.pop(),x=>x.result.runs[0].groups[0].commands[0].exitCode=1,x=>x.result.sourceRequests=1]){const bad=structuredClone(f);edit(bad);assert.throws(()=>verifyBusinessLinuxEvidence(bad,123,'a'.repeat(40)));}
});
test('unknown Linux reads stop after one request before any business database connection',async()=>{
 let reads=0;await assert.rejects(requireBusinessLinux({id:123,commit:'a'.repeat(40),token:'synthetic',fetchImpl:async()=>{reads++;throw Error('READ_UNKNOWN');}}),/READ_UNKNOWN/);assert.equal(reads,1);
 const src=fs.readFileSync('scripts/runner-v2/ag-rolling/sg-business-job.mjs','utf8');assert(src.indexOf('await requireBusinessLinux(')<src.indexOf('new MongoClient('));
});
async function fixture(parser){
 const response='MSGID=BET&B=99980&AB=99980&TW=0&NFG=0&IFG=0&FID=0|';
 const raw={fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:100000,steps:[{ts:'2026-01-01T00:00:00Z',msgId:'BET',methodName:'processGameMessage',requestPayload:Object.entries({...plan.requestParams,PID:'gdmgcmSyntheticBusinessFixture',MSGID:'BET'}).map(([k,v])=>k+'='+v).join('&'),responsePayload:response,responseBalance:99980,responseXml:'<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD>'+response.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',elapsedMs:1,httpStatus:200}]};
 const normalized=await parser.call({op:'fields',plan,raw});return parser.call({op:'record',plan,raw,normalized,sequence:1,attempt:1,sessionHash:'a'.repeat(64),worker:0,batchId:1});
}
test('delivery uses independent record validation and unchanged business replay bytes',async()=>{
 const parser=analyzer();try{const r=await fixture(parser),expected=businessDocument(r,binding,campaignId);let saved=[],begun=0,ended=0;
  const sink={plan,read:async()=>saved,insert:async docs=>{saved=structuredClone(docs);}};
  const audit={begin:async()=>begun++,end:async()=>ended++};
  const result=await deliverPage({records:[r],binding,campaignId,parser,sink,audit,batchId:'1'});
  assert.equal(result.inserted,1);assert.equal(begun,1);assert.equal(ended,1);assert.deepEqual(saved[0],expected);
  assert.deepEqual(saved[0].data.steps,r.raw.steps);assert.equal(saved[0].gameId,33022);
  const again=await deliverPage({records:[r],binding,campaignId,parser,sink,audit,batchId:'2'});assert.equal(again.inserted,0);assert.equal(begun,1);
 }finally{parser.close();}
});
test('unknown insertion outcome never retries or completes its pending intent',async()=>{
 const parser=analyzer();try{const r=await fixture(parser);let calls=0,begin=0,end=0;
  await assert.rejects(deliverPage({records:[r],binding,campaignId,parser,batchId:'x',sink:{plan,read:async()=>[],insert:async()=>{calls++;throw Error('ACK_UNKNOWN');}},audit:{begin:async()=>begin++,end:async()=>end++}}),/ACK_UNKNOWN/);
  assert.equal(calls,1);assert.equal(begin,1);assert.equal(end,0);
 }finally{parser.close();}
});
test('same ObjectId with different replay content refuses any replacement',()=>{
 const d={_id:'a'.repeat(24),data:{captureContentHash:'x'}};assert.throws(()=>missingDocuments([d],[{...d,data:{captureContentHash:'y'}}]),/CONTENT_CONFLICT/);
 assert.throws(()=>missingDocuments([d,d],[]),/ID_COLLISION/);
});
test('legacy validation preserves missing timing and refuses altered money/XML/type',async()=>{
 const parser=analyzer();try{const r=await fixture(parser),d=businessDocument(r,binding,campaignId);delete d.data.steps[0].elapsedMs;delete d.data.captureCampaignId;
  const checked=await verifyLegacyPage({documents:[d],plan,binding,parser});assert.equal(checked.newCaptureCredit,0);assert.equal(inspectExistingOrdinary(d,plan,binding).transportTimingAvailable,false);
  for(const mutate of [x=>x.data.totalWin=1,x=>x.data.steps[0].responsePayload+='&TW=1',x=>x.data.steps[0].responseXml=x.data.steps[0].responseXml.replace('<SUCCESS>true','<SUCCESS>false'),x=>x.bonus=1,x=>x.data.gameId=999,x=>x.data.stepCount=2]){
   const changed=structuredClone(d);mutate(changed);await assert.rejects(verifyLegacyPage({documents:[changed],plan,binding,parser}));
  }
 }finally{parser.close();}
});
test('changed accepted raw or normalized fields are rejected before database insertion',async()=>{
 const parser=analyzer();try{const r=await fixture(parser);let writes=0;
  for(const change of [x=>x.raw.steps[0].elapsedMs=300001,x=>x.raw.steps[0].responseBalance++,x=>x.normalized.money.endBalanceRaw++,x=>x.contentHash='b'.repeat(64),x=>x.gameId=32443]){
   const bad=structuredClone(r);change(bad);await assert.rejects(deliverPage({records:[bad],binding,campaignId,parser,batchId:'x',sink:{plan,read:async()=>[],insert:async()=>writes++},audit:{begin:async()=>writes++,end:async()=>writes++}}));
  }assert.equal(writes,0);
 }finally{parser.close();}
});
test('complete proof requires exact game, immutable result and all selected quotas',()=>{
 const p={schema:'sg-ag-rolling-complete-v1',gameId:'32442',trialId:binding.trialId,queueId:binding.queueId,campaignId,count:300000,baseline:0,fullReadback:true,independentlyVerified:true,selected:Array(20).fill(15000),recordsHash:'a'.repeat(64)};
 assert.equal(assertCompleteBinding({value:{status:'complete',result:p}},{value:p},binding).count,300000);
 for(const edit of [x=>x.count--,x=>x.fullReadback=false,x=>x.selected[0]--,x=>x.gameId='32443']){const bad=structuredClone(p);edit(bad);assert.throws(()=>assertCompleteBinding({value:{status:'complete',result:bad}},{value:bad},binding));}
 assert.throws(()=>assertCompleteBinding({value:{status:'merging',result:p}},{value:p},binding));assert.equal(digest(p).length,64);
});
