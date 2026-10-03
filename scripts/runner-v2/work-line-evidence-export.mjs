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
import {exportNativeRepairReplay} from './native-repair-replay.mjs';
import {preparationRevision} from './preparation-revision.mjs';
import {spawnSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_WORKFLOW==='SG read-only work-line evidence','EVIDENCE_WORKFLOW');
const scope=process.env.SG_WORK_LINE_EVIDENCE_SCOPE??'pyramids-history';
const fixed={
 'mansion-repair':{gameId:32714,repository:'zyzuoyang/sg-capture-runner',
  key:'game-repair:sg_r1_20260928_32714:70c2881b950debda575965667632da40f1166a9c976c7f9323887ab85d459f97'},
 'inca-repair':{gameId:32719,repository:'287113535qq-cmyk/sg-capture-runner',
  key:'game-repair:sg_r1_20260928_32719:418d7246f676b395180f0caeafe70e697c416f7e03f5700f79e6a20107a7682b'}
};
assert(scope==='pyramids-history'||fixed[scope], 'EVIDENCE_FIXED_SCOPE');
if(fixed[scope])assert(process.env.GITHUB_REPOSITORY===fixed[scope].repository,'EVIDENCE_FIXED_OWNER');
const name='formal-repair-pyramids-action-20261002.json',plans=read('config/round-one-plans.json');
const plan=fixed[scope]?plans[fixed[scope].gameId]:actionAnalysisPlan({base:plans[32721],profile:read('config/'+name),name,
 runtimeName:'count-runtime-pyramids-action-canary-20261002.json'});
const transport=connectGateway(),store=new RunnerState({transport,gate:new ResourceGate(),deadline:Date.now()+180000});
// The producer cannot write even if a future helper mistakenly tries to do so.
const readonly={get:store.get.bind(store),getMany:store.getMany.bind(store)};
const parser=analyzer({env:offlineAnalysisEnvironment(process.cwd(),plan)});
try{
 const readTransport={request:async(op,fields)=>{
  assert(op==='rounds_read','EVIDENCE_READ_ONLY');return transport.request(op,fields);
 }};
 let tasks;
 if(fixed[scope]){
  const generated=spawnSync('python3',['scripts/feature_reuse_index.py','--output','.local/work-line-feature-index.json'],
   {encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
  assert(generated.status===0,'EVIDENCE_FEATURE_INDEX');
  const index=read('.local/work-line-feature-index.json');
  tasks=[await exportNativeRepairReplay({store:readonly,transport:readTransport,plan,
   revisionHash:preparationRevision(process.cwd(),plan.gameId,index.games.find(g=>g.gameId===plan.gameId)).revisionHash,
   repairKey:fixed[scope].key})];
 }else{
  const result=await exportConfirmedAnalysisPage({store:readonly,transport:readTransport,parser,plan,after:31373,limit:1});
  assert(result.tasks.length===1&&result.unresolvedSequences.length===0,'EVIDENCE_EXPECTED_RECEIPT');tasks=result.tasks;
 }
 const origin={repository:process.env.GITHUB_REPOSITORY,runId:process.env.GITHUB_RUN_ID,
  attempt:process.env.GITHUB_RUN_ATTEMPT,commit:process.env.GITHUB_SHA,workflow:'.github/workflows/work-line-evidence.yml'};
 const sealed=sealWorkLineEvidence({schema:'sg-work-line-delivery-v1',origin,tasks,sourceAllowance:0},read('config/work-line-evidence-recipient.json'));
 fs.mkdirSync('work-line-sealed',{recursive:true});fs.writeFileSync('work-line-sealed/evidence.json',JSON.stringify(sealed),{flag:'wx'});
 console.log(JSON.stringify({tasks:tasks.length,scope,sourceRequests:0,mongoWrites:0,encrypted:true}));
}finally{parser.close();transport.close();}
