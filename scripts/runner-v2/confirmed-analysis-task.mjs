import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
import {receiptKey} from './durable-queue.mjs';
import {analyzeConfirmedRound} from './round-analysis-journal.mjs';
import path from 'node:path';
import {publishImmutableInbox} from './work-line-mailbox.mjs';

function validateTask(task){
 assert(task?.schema==='sg-confirmed-round-analysis-task-v1'&&task.sourceAllowance===0
  &&task.gameId===task.plan?.gameId&&task.planHash===hash(task.plan)
  &&task.recordHash===hash(task.record)&&stable(task.readback)===stable(task.record),'CONFIRMED_ANALYSIS_TASK');
}

// This handoff grants no preparation proof or capture permission. The separate
// consumer independently verifies the whole record before annotating it.
export function deliverConfirmedAnalysis(root,task){
 validateTask(task);
 const mailbox=publishImmutableInbox(path.join(root,'.local','protocol-analysis-worker','inbox'),task);
 return {status:'confirmed-analysis-delivered',gameId:task.gameId,mailbox,
  sourceAllowance:0,sourceRequests:0,dispatched:false};
}

// Read-only producer: only completed immutable receipts with full Mongo
// readback can enter semantic analysis. Interrupted fault samples stay separate.
export async function exportConfirmedAnalysisPage({store,transport,parser,plan,after=0,limit=100,revisitSequences=[]}){
 assert(Number.isSafeInteger(after)&&after>=0&&Number.isSafeInteger(limit)&&limit>=1&&limit<=100
  &&after+limit<=600000,'CONFIRMED_ANALYSIS_PAGE');
 const campaign=(await store.get('state','campaign'))?.value;
 assert(campaign?.games?.some(g=>g.game_id===plan.gameId),'CONFIRMED_ANALYSIS_GAME');
 assert(Array.isArray(revisitSequences)&&revisitSequences.length<=100
  &&new Set(revisitSequences).size===revisitSequences.length
  &&revisitSequences.every(n=>Number.isSafeInteger(n)&&n>=1&&n<=after),'CONFIRMED_ANALYSIS_REVISIT');
 const sequences=[...revisitSequences,...Array.from({length:limit},(_,i)=>after+i+1)],rows=[];
 for(let i=0;i<sequences.length;i+=100){
  const wanted=sequences.slice(i,i+100),page=await store.getMany('journal',wanted.map(n=>receiptKey(plan.trialId,n)));
  assert(page.length===wanted.length&&page.every((r,j)=>!r||(r.value?.trialId===plan.trialId&&r.value?.sequence===wanted[j])),
   'CONFIRMED_ANALYSIS_ROWS');rows.push(...page);
 }
 const unresolvedSequences=sequences.filter((_,i)=>!rows[i]);
 assert(unresolvedSequences.length<=100,'CONFIRMED_ANALYSIS_OPEN_BOUND');
 const records=rows.filter(Boolean).map(r=>r.value).filter(r=>r.normalized?.classificationStatus==='pending');
 assert(records.every(r=>r.trialId===plan.trialId&&r.gameId===plan.gameId&&r.fixtureOnly===false)
  &&new Set(records.map(r=>r._id)).size===records.length,'CONFIRMED_ANALYSIS_SCOPE');
 const actual=records.length?await transport.request('rounds_read',{trialId:plan.trialId,ids:records.map(r=>r._id)}):[];
 assert(actual.length===records.length,'CONFIRMED_ANALYSIS_READBACK');
 const tasks=[];
 for(const record of records){
  const readback=actual.filter(r=>r._id===record._id);
  assert(readback.length===1&&stable(readback[0])===stable(record),'CONFIRMED_ANALYSIS_READBACK');
  assert.deepEqual(await parser.call({op:'verify',plan,raw:record.raw,record}),{verified:true});
  tasks.push({schema:'sg-confirmed-round-analysis-task-v1',gameId:plan.gameId,plan,planHash:hash(plan),
   record,recordHash:hash(record),readback:readback[0],sourceAllowance:0});
 }
 // Caller must follow the actual committed receipt range, not treat this
 // sequence cursor or the number of annotated records as a completed count.
 return {tasks,after:after+limit,unresolvedSequences,sourceRequests:0,newBetAllowance:0};
}

export async function analyzeConfirmedTask({task,store,parser,independentReview,commit}){
 validateTask(task);
 const result=await analyzeConfirmedRound({store,sink:{read:async()=>[task.readback]},analyzer:parser,
  independentReview,plan:task.plan,record:task.record,commit});
 return {...result,sourceRequests:0,captureAuthorization:false,originalRecordsChanged:0};
}
