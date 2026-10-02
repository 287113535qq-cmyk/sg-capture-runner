import test from 'node:test';
import assert from 'node:assert/strict';
import {exportConfirmedAnalysisPage,deliverConfirmedAnalysis} from './confirmed-analysis-task.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const plan={trialId:'trial',gameId:1};
const record=sequence=>({_id:'round-'+sequence,trialId:'trial',gameId:1,sequence,
 fixtureOnly:false,normalized:{classificationStatus:'pending'},raw:[]});
const store=rows=>({get:async()=>({value:{games:[{game_id:1}]}}),getMany:async()=>rows});
const parser={call:async()=>({verified:true})};
test('a receipt committed after the first scan is revisited rather than lost',async()=>{
 const first=await exportConfirmedAnalysisPage({store:store([null]),transport:{},parser,plan,limit:1});
 assert.deepEqual(first.unresolvedSequences,[1]);assert.equal(first.tasks.length,0);
 const a=record(1),b=record(2);
 const next=await exportConfirmedAnalysisPage({store:store([{value:a},{value:b}]),
  transport:{request:async()=>[b,a]},parser,plan,after:first.after,limit:1,revisitSequences:first.unresolvedSequences});
 assert.deepEqual(next.tasks.map(t=>t.record.sequence),[1,2]);assert.deepEqual(next.unresolvedSequences,[]);
 assert.equal(next.newBetAllowance,0);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-analysis-handoff-'));
 try{
  const receipt=deliverConfirmedAnalysis(root,next.tasks[0]);
  const again=deliverConfirmedAnalysis(root,next.tasks[0]);assert.deepEqual(again,receipt);
  const inbox=path.join(root,'.local','protocol-analysis-worker','inbox');
  assert.equal(fs.readdirSync(inbox).length,1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(inbox,receipt.mailbox+'.json'),'utf8')),next.tasks[0]);
  assert.equal(receipt.sourceRequests,0);assert.equal(receipt.dispatched,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('truncated, reordered receipts and different full Mongo content cannot produce tasks',async()=>{
 const a=record(1),b=record(2);
 for(const rows of [[],[{value:b}],[{value:{...a,trialId:'other'}}]])
  await assert.rejects(exportConfirmedAnalysisPage({store:store(rows),transport:{},parser,plan,limit:1}),/CONFIRMED_ANALYSIS_ROWS/);
 await assert.rejects(exportConfirmedAnalysisPage({store:store([{value:a}]),
  transport:{request:async()=>[{...a,raw:['changed']}]},parser,plan,limit:1}),/CONFIRMED_ANALYSIS_READBACK/);
});
