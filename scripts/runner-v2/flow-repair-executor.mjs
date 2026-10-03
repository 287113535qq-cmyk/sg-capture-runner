import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {nextRequest} from '../trial/squid-protocol.mjs';
import {veryFruityActionNext,VERYFRUITY_SOURCE} from '../trial/veryfruity-action-protocol.mjs';
import {huffActionNext,ACTION_VERSION as HUFF_ACTION_VERSION} from '../trial/huff-action-protocol.mjs';
import {analyzer} from './analyzer.mjs';
import {offlineAnalysisEnvironment} from './offline-analysis-environment.mjs';
import {preparationReplayEvidence} from './preparation-replay-evidence.mjs';
import {reviewFlowRepairTask} from './flow-repair-task.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

// Each fixed offline task loads current adapters in its own bounded process.
// A long-lived producer must not pair new file hashes with cached old modules.
const input=JSON.parse(fs.readFileSync(0,'utf8')),root=process.cwd();
const {task,revisionHash,python}=input,replay=task.schema==='sg-preparation-replay-task-v1';
let fields,very,huff;
const independentFields=(raw,plan,normalized)=>{
 if(!fields){const require=createRequire(import.meta.url);
  require(path.join(root,'collector/node_modules/ts-node')).register({project:path.join(root,'collector/tsconfig.json'),transpileOnly:true});
  fields=require(path.join(root,'collector/sg.ingest.ts')).prepareNextgenRound;
  very=require(path.join(root,'collector/sg.veryfruity-action.ts')).veryFruityActionFields;}
 if(raw.requestFlowVersion===HUFF_ACTION_VERSION){
  huff??=createRequire(import.meta.url)(path.join(root,'collector/sg.huff-action.ts')).prepareNextgenActionRound;
  return huff(raw,plan);
 }
 return raw.sourceKey===VERYFRUITY_SOURCE?very(raw,plan):fields(raw,
  {buy:normalized.buy,bonus:normalized.bonus,typeMappingHash:normalized.typeMappingHash});
};
// Each immutable historical plan gets its own independently authorized Python
// environment. A later action fault must not inherit the base plan's profile.
const parsers=new Map(),parser={call:request=>{
 const key=hash(request.plan);
 if(!parsers.has(key))parsers.set(key,analyzer({python,env:offlineAnalysisEnvironment(root,request.plan)}));
 return parsers.get(key).call(request);
},close(){for(const value of parsers.values())value.close();}};
const runnerNext=(raw,plan)=>plan.featureProfile===HUFF_ACTION_VERSION?huffActionNext(plan,raw):raw.sourceKey===VERYFRUITY_SOURCE?veryFruityActionNext(plan,raw):nextRequest(raw);
try{
 const result=replay?await preparationReplayEvidence({task,revisionHash,parser,runnerNext,independentFields})
  :await reviewFlowRepairTask({task,parser,runnerNext});
 process.stdout.write(JSON.stringify({ok:true,result}));
}catch(error){
 process.stdout.write(JSON.stringify({ok:false,reason:/^[A-Z_]{1,80}$/.test(error.message)?error.message:'FLOW_REVIEW_VALIDATION_FAILED'}));
}finally{parser.close();}
