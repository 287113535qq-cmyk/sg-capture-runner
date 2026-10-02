import assert from 'node:assert/strict';
import {stable} from './mongo-writer.mjs';

// An independent consumer of confirmed receipts. Never called by capture's
// intent/exchange path; it has no pool, source transport or quota authority.
export async function analyzeConfirmedRound({store,sink,analyzer,independentReview,plan,record,commit}){
 assert(/^[a-f0-9]{40}$/.test(commit),'ANALYSIS_COMMIT_REQUIRED');
 assert(record.trialId===plan.trialId&&record.normalized?.classificationStatus==='pending','ANALYSIS_SCOPE');
 const rows=await sink.read([record._id]);
 assert(rows.length===1&&stable(rows[0])===stable(record),'ANALYSIS_FULL_READBACK_REQUIRED');
 const verified=await analyzer.call({op:'verify',plan,raw:record.raw,record});
 assert.deepEqual(verified,{verified:true});
 const result=await analyzer.call({op:'classify',plan,raw:record.raw,record});
 assert(result.schema==='sg-round-analysis-v1'&&result.recordId===record._id
  &&result.contentHash===record.contentHash&&result.rawHash===record.rawHash
  &&result.sourceAllowance===0,'ANALYSIS_BINDING');
 assert(['classified','review-required'].includes(result.status),'ANALYSIS_STATUS');
 // Both interpreters must agree before publishing a classified result.
 if(result.status==='classified')assert.deepEqual(await independentReview(record.raw,plan,result.classification),result.classification);
 const key=`round-analysis:${plan.trialId}:${record._id}:${commit}`;
 const value={...result,analysisCommit:commit};
 await store.create('journal',key,value,{immutable:true});
 const saved=await store.get('journal',key);
 assert(saved&&stable(saved.value)===stable(value),'ANALYSIS_JOURNAL_READBACK_REQUIRED');
 return value;
}
