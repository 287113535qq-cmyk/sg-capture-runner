// Explicit no-source, no-write recovery export. The fixed historical plan is
// read-only analysis scope; it does not renew its expired capture permission.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connectGateway} from './transport.mjs';
import {RunnerState} from './state-store.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {analyzer} from './analyzer.mjs';
import {actionAnalysisPlan} from './action-analysis-binding.mjs';
import {offlineAnalysisEnvironment} from './offline-analysis-environment.mjs';
import {exportConfirmedAnalysisPage} from './confirmed-analysis-task.mjs';
import {sealWorkLineEvidence} from './work-line-sealed-evidence.mjs';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_WORKFLOW==='SG read-only work-line evidence','EVIDENCE_WORKFLOW');
const name='formal-repair-pyramids-action-20261002.json';
const plan=actionAnalysisPlan({base:read('config/round-one-plans.json')[32721],profile:read('config/'+name),name,
 runtimeName:'count-runtime-pyramids-action-canary-20261002.json'});
const transport=connectGateway(),store=new RunnerState({transport,gate:new ResourceGate(),deadline:Date.now()+180000});
// The producer cannot write even if a future helper mistakenly tries to do so.
const readonly={get:store.get.bind(store),getMany:store.getMany.bind(store)};
const parser=analyzer({env:offlineAnalysisEnvironment(process.cwd(),plan)});
try{
 const result=await exportConfirmedAnalysisPage({store:readonly,transport:{request:async(op,fields)=>{
  assert(op==='rounds_read','EVIDENCE_READ_ONLY');return transport.request(op,fields);
 }},parser,plan,after:31373,limit:1});
 assert(result.tasks.length===1&&result.unresolvedSequences.length===0,'EVIDENCE_EXPECTED_RECEIPT');
 const origin={repository:process.env.GITHUB_REPOSITORY,runId:process.env.GITHUB_RUN_ID,
  attempt:process.env.GITHUB_RUN_ATTEMPT,commit:process.env.GITHUB_SHA,workflow:'.github/workflows/work-line-evidence.yml'};
 const sealed=sealWorkLineEvidence({schema:'sg-work-line-delivery-v1',origin,tasks:result.tasks,sourceAllowance:0},read('config/work-line-evidence-recipient.json'));
 fs.mkdirSync('work-line-sealed',{recursive:true});fs.writeFileSync('work-line-sealed/evidence.json',JSON.stringify(sealed),{flag:'wx'});
 console.log(JSON.stringify({tasks:result.tasks.length,sourceRequests:0,mongoWrites:0,encrypted:true}));
}finally{parser.close();transport.close();}
