import assert from 'node:assert/strict';
import {linuxPreparationTasks} from '../preparation-linux-evidence.mjs';
import {digest} from './sg-business-delivery.mjs';
export const BUSINESS_BRANCH='sg-ag-strict-control-20261006';
export const BUSINESS_LINUX_REPOSITORY='287113535qq-cmyk/sg-capture-runner';
export function verifyBusinessLinuxEvidence({run,jobs,result},id,commit){
 assert(/^\d+$/.test(String(id))&&/^[a-f0-9]{40}$/.test(commit),'SG_BUSINESS_LINUX_INPUT');
 assert(run.id===Number(id)&&run.repository?.full_name===BUSINESS_LINUX_REPOSITORY&&run.head_sha===commit
  &&run.head_branch===BUSINESS_BRANCH&&run.run_attempt===1&&run.event==='workflow_dispatch'
  &&run.path==='.github/workflows/preflight.yml'&&run.status==='completed'&&run.conclusion==='success','SG_BUSINESS_LINUX_IDENTITY');
 assert(Number.isInteger(jobs.total_count)&&jobs.total_count===jobs.jobs?.length&&jobs.total_count>0&&jobs.total_count<100,'SG_BUSINESS_LINUX_INVENTORY');
 assert(jobs.jobs.filter(j=>j.name==='preflight').length===1&&new Set(jobs.jobs.map(j=>j.id)).size===jobs.total_count
  &&jobs.jobs.every(j=>j.run_id===run.id&&j.status==='completed'&&['success','skipped'].includes(j.conclusion))
  &&jobs.jobs.find(j=>j.name==='preflight').conclusion==='success','SG_BUSINESS_LINUX_JOBS');
 assert(result.schema==='sg-offline-preflight-v1'&&result.passed===true&&result.complete===true
  &&result.sourceRequests===0&&result.mongoWrites===0&&result.runs?.length===1,'SG_BUSINESS_LINUX_FULL_RESULT');
 const checked=result.runs[0],expected={'python':8,'collector-protocol':3,'runner-persistence':3};
 assert(checked.workers===3&&checked.passed===true&&checked.groups?.length===3
  &&new Set(checked.groups.map(g=>g.group)).size===3
  &&checked.groups.every(g=>g.passed===true&&g.expectedCommands===expected[g.group]&&g.commands?.length===expected[g.group]
   &&g.commands.every(c=>c.exitCode===0&&/^[a-f0-9]{64}$/.test(c.argvHash))),'SG_BUSINESS_LINUX_FULL_CHECKS');
 assert(new Set(checked.groups.flatMap(g=>g.commands.map(c=>c.argvHash))).size===14,'SG_BUSINESS_LINUX_COMMAND_INVENTORY');
 return {repository:BUSINESS_LINUX_REPOSITORY,run:Number(id),commit,groups:3,joinedCommands:14,sourceAllowance:0};
}

export function verifyOwnStrictLinux(evidence,commit,root){
 const verified=verifyBusinessLinuxEvidence(evidence,evidence.run.id,commit);
 const origin={repository:BUSINESS_LINUX_REPOSITORY,runId:String(evidence.run.id),attempt:'1',commit,workflow:'.github/workflows/preflight.yml'};
 const expected=linuxPreparationTasks({root,index:evidence.index,result:evidence.result,origin});
 assert(expected.length===9&&evidence.tasks?.length===9&&new Set(evidence.tasks.map(t=>t.gameId)).size===9,'SG_AG_OWN_NINE_SEALED');
 assert(digest([...expected].sort((a,b)=>a.gameId-b.gameId))===digest([...evidence.tasks].sort((a,b)=>a.gameId-b.gameId)),'SG_AG_OWN_NINE_SEALED_FULL_VALUE');
 return {...verified,sealedTasks:9,evidenceHash:digest(evidence)};
}
