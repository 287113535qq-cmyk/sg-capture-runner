import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {nextRequest} from '../trial/squid-protocol.mjs';
import {veryFruityActionNext,VERYFRUITY_SOURCE} from '../trial/veryfruity-action-protocol.mjs';
import {analyzer} from './analyzer.mjs';
import {offlineAnalysisEnvironment} from './offline-analysis-environment.mjs';
import {preparationReplayEvidence} from './preparation-replay-evidence.mjs';
import {reviewFlowRepairTask} from './flow-repair-task.mjs';

// Each fixed offline task loads current adapters in its own bounded process.
// A long-lived producer must not pair new file hashes with cached old modules.
const input=JSON.parse(fs.readFileSync(0,'utf8')),root=process.cwd();
const {task,revisionHash,python}=input,replay=task.schema==='sg-preparation-replay-task-v1';
let fields,very;
const independentFields=(raw,plan,normalized)=>{
 if(!fields){const require=createRequire(import.meta.url);
  require(path.join(root,'collector/node_modules/ts-node')).register({project:path.join(root,'collector/tsconfig.json'),transpileOnly:true});
  fields=require(path.join(root,'collector/sg.ingest.ts')).prepareNextgenRound;
  very=require(path.join(root,'collector/sg.veryfruity-action.ts')).veryFruityActionFields;}
 return raw.sourceKey===VERYFRUITY_SOURCE?very(raw,plan):fields(raw,
  {buy:normalized.buy,bonus:normalized.bonus,typeMappingHash:normalized.typeMappingHash});
};
const parser=analyzer({python,env:offlineAnalysisEnvironment(root,replay?task.plan:task.evidence.plan)});
const runnerNext=(raw,plan)=>raw.sourceKey===VERYFRUITY_SOURCE?veryFruityActionNext(plan,raw):nextRequest(raw);
try{
 const result=replay?await preparationReplayEvidence({task,revisionHash,parser,runnerNext,independentFields})
  :await reviewFlowRepairTask({task,parser,runnerNext});
 process.stdout.write(JSON.stringify({ok:true,result}));
}catch(error){
 process.stdout.write(JSON.stringify({ok:false,reason:/^[A-Z_]{1,80}$/.test(error.message)?error.message:'FLOW_REVIEW_VALIDATION_FAILED'}));
}finally{parser.close();}
