import fs from 'node:fs';import assert from 'node:assert/strict';import path from 'node:path';
import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {pyramidsActionRepairPlan} from './pyramids-action-repair-profile.mjs';
import {loadCountPermission} from './complete-count.mjs';import {receiptKey} from './durable-queue.mjs';
import {analyzeConfirmedRound} from './round-analysis-journal.mjs';
import {stable} from './mongo-writer.mjs';
import {ACTION_CANARY_RUNTIME,checkActionCanaryBinding} from './action-canary-contract.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner','SECONDARY_GITHUB_REQUIRED');
assert(process.env.SG_FORMAL_COUNT_PROFILE==='formal-repair-pyramids-action-20261002.json','ACTION_ANALYSIS_PROFILE');
const load=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const profile=load('config/'+process.env.SG_FORMAL_COUNT_PROFILE);
const plan=pyramidsActionRepairPlan(load('config/round-one-plans.json')[32721],profile);
const runtimeName=process.env.SG_COUNT_RUNTIME_PROFILE;
assert(!runtimeName||runtimeName===ACTION_CANARY_RUNTIME,'ACTION_ANALYSIS_RUNTIME_SCOPE');
const revision=runtimeName?load('config/'+runtimeName):null;
for(const [file,hash]of Object.entries(revision?.files??profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(file)&&!file.includes('..'),'ANALYSIS_FILE_SCOPE');
 assert.equal(createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex'),hash,'ANALYSIS_RUNTIME_CHANGED');
}
const after=Number(process.env.SG_ANALYSIS_AFTER),limit=Number(process.env.SG_ANALYSIS_LIMIT);
assert(Number.isSafeInteger(after)&&after>=0&&after<600000&&Number.isSafeInteger(limit)&&limit>=1&&limit<=100&&after+limit<=600000,'ANALYSIS_PAGE_SCOPE');
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json'),transpileOnly:true});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+10*60000}),parser=analyzer();
try{
 await store.writable();assert((await parser.call({op:'plan',plan})).validated);
 const pool=(await store.get('state','pool:'+plan.trialId))?.value;assert(pool,'ANALYSIS_POOL_REQUIRED');
 await loadCountPermission({store,plan,pool,commit:process.env.GITHUB_SHA});
 if(revision){
  const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
  const spec=(await store.get('journal',key))?.value,complete=(await store.get('journal',key+':complete'))?.value;
  const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${plan.countAllocation}:${process.env.GITHUB_SHA}`))?.value;
  checkActionCanaryBinding({plan,profile,revision,receipt,spec,complete,commit:process.env.GITHUB_SHA});
 }
 const receipts=await store.getMany('journal',Array.from({length:limit},(_,i)=>receiptKey(plan.trialId,after+i+1)));
 const records=receipts.filter(Boolean).map(r=>r.value).filter(r=>r.normalized?.classificationStatus==='pending');
 const rows=records.length?await transport.request('rounds_read',{trialId:plan.trialId,ids:records.map(r=>r._id)}):[];
 const counts={classified:0,'review-required':0};
 for(const record of records){
  const key=`round-analysis:${plan.trialId}:${record._id}:${process.env.GITHUB_SHA}`;
  const existing=await store.get('journal',key);
  // Reusing a completed annotation still requires confirmed original evidence.
  const actual=rows.filter(r=>r._id===record._id);assert(actual.length===1&&stable(actual[0])===stable(record),'ANALYSIS_FULL_READBACK_REQUIRED');
  if(existing){assert(existing.value.contentHash===record.contentHash&&existing.value.rawHash===record.rawHash&&existing.value.analysisCommit===process.env.GITHUB_SHA&&existing.value.sourceAllowance===0,'ANALYSIS_EXISTING_BINDING');continue;}
  const result=await analyzeConfirmedRound({store,sink:{read:async ids=>rows.filter(r=>ids.includes(r._id))},
   analyzer:parser,plan,record,commit:process.env.GITHUB_SHA,
   independentReview:(raw,_plan,classified)=>prepareNextgenRound(raw,{buy:0,bonus:classified.bonus,typeMappingHash:classified.typeMappingHash})});
  counts[result.status]++;
 }
 console.log(JSON.stringify({schema:'sg-analysis-page-result-v1',after,limit,receipts:receipts.filter(Boolean).length,
  ...counts,sourceRequests:0,newBetAllowance:0,originalRecordsChanged:0}));
}finally{parser.close();transport.close();}
