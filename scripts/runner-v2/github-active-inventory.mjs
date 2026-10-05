import assert from 'node:assert/strict';
import {withGithubListDiagnostic} from './github-read-diagnostic.mjs';
const scope=/^repos\/(zyzuoyang|287113535qq-cmyk)\/sg-capture-runner\/actions\/runs\?status=(in_progress|queued|pending|waiting|requested)&per_page=100$/;
const complete=v=>Number.isInteger(v?.total_count)&&v.total_count>=0&&v.total_count<100
 &&Array.isArray(v.workflow_runs)&&v.workflow_runs.length===v.total_count;
// A known, successful JSON response can have a contradictory aggregate count.
// Resolve that contradiction with two distinct documented pagination reads.
// HTTP errors, unknown outcomes, invalid schemas and capped inventories never
// enter this path. Every accepted view still has a full exact count below 100.
export function completeActiveInventoryRead(read,{onInventoryRecheck}={}){
 return async path=>{
  const first=await read(path),match=scope.exec(path);
  if(!match||complete(first)||!Number.isInteger(first?.total_count)||first.total_count<1||first.total_count>=100
   ||!Array.isArray(first.workflow_runs)||first.workflow_runs.length>=first.total_count)return first;
  const page1=await read(path+'&page=1');
  try{assert(complete(page1),'GITHUB_RUN_LIST_TRUNCATED');}
  catch(error){throw withGithubListDiagnostic(error,path+'&page=1',page1);}
  const page2=await read(path+'&page=2');
  try{assert(Number.isInteger(page2?.total_count)&&page2.total_count===page1.total_count
   &&Array.isArray(page2.workflow_runs)&&page2.workflow_runs.length===0,'GITHUB_RUN_LIST_TRUNCATED');}
  catch(error){throw withGithubListDiagnostic(error,path+'&page=2',page2);}
  const evidence={schema:'github-active-inventory-recheck-v1',repository:match[1]+'/sg-capture-runner',status:match[2],
   initialReportedTotal:first.total_count,initialReturnedRows:first.workflow_runs.length,
   page1ReportedTotal:page1.total_count,page1ReturnedRows:page1.workflow_runs.length,page2ReportedTotal:page2.total_count,
   page2ReturnedRows:0,independentCompleteInventory:true,sourceRequests:0};
  try{onInventoryRecheck?.(Object.freeze(evidence));}catch{/* Diagnostics cannot replace or relax verification. */}
  return page1;
 };
}
