import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {preparedCountAuthorization} from './prepared-count-authorization.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {offlineAnalysisEnvironment} from './offline-analysis-environment.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
import {readPoolBatches} from './formal-source-review.mjs';import {nextRequest} from '../trial/squid-protocol.mjs';
import {reviewReceivedTerminalRecords} from './received-terminal-records.mjs';
import {closeCountShared} from './count-shared-close.mjs';
import {reconcilesPreparedEvidence} from './prepared-evidence-disposition.mjs';

// Only registered formal prepared plans, ended sources and exact reviewed holds.
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PREPARED_EVIDENCE_OWNER');
const readFile=p=>JSON.parse(fs.readFileSync(p,'utf8')),name=process.env.SG_EVIDENCE_CLOSE_PROFILE;
assert(/^count-close-prepared-evidence-[0-9]{8}-[a-z0-9-]+\.json$/.test(name??''),'PREPARED_EVIDENCE_FILE');
const profile=readFile('config/'+name),source=readFile('config/'+profile.sourceProfile);
const authorization=preparedCountAuthorization(profile.sourceProfile),plans=readFile('config/round-one-plans.json');
const plan=preparedCountPlan(plans[profile.gameId],source,authorization);
const reconcile=reconcilesPreparedEvidence(profile);
assert(profile.schema==='sg-count-evidence-close-profile-v1'&&profile.group==='primary'
 &&authorization.profileHash===profile.sourceProfileHash&&hash(source)===profile.sourceProfileHash
 &&Object.keys(profile.files??{}).length>=300,'PREPARED_EVIDENCE_SCOPE');
for(const [file,digest]of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(file)&&!file.includes('..'),'PREPARED_EVIDENCE_PATH');
 assert(createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex')===digest,'PREPARED_EVIDENCE_RUNTIME_CHANGED');
}
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json',transpileOnly:true});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000});
const parser=analyzer({auditWorkers:2,env:offlineAnalysisEnvironment(process.cwd(),plan)});
const read=authenticatedRead(process.env.GH_TOKEN),commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const idle=maintenanceBoundary({read,store,oldProfile:readFile('config/demo-pilot-beaver-20260930.json'),commit,run});
try{
 const boundary=async()=>{
  assert(profile.createdAt<=Date.now()&&Date.now()<profile.expiresAt,'PREPARED_EVIDENCE_STALE');
  await idle();await store.writable();await checkPrimaryLeases({store,plans});
  assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  const holds=await transport.request('global_holds');
  assert(holds.length===2&&holds.find(h=>h._id==='secondary/global-hold')?.value.active===false
   &&hash(holds.find(h=>h._id==='primary/global-hold')?.value)===profile.holdHash,'PREPARED_EVIDENCE_HOLD');
 };
 await boundary();
 assert(/^\d+:1$/.test(profile.sourceRun),'PREPARED_EVIDENCE_SOURCE');
 const path=`repos/zyzuoyang/sg-capture-runner/actions/runs/${profile.sourceRun.split(':')[0]}`;
 const ended=await read(path),jobs=await read(path+'/jobs?filter=all&per_page=100');
 assert(ended.event==='workflow_dispatch'&&ended.id===Number(profile.sourceRun.split(':')[0])
  &&ended.run_attempt===1,'PREPARED_EVIDENCE_SOURCE_IDENTITY');
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,batches=await readPoolBatches(store,plan,pool);
 assert(hash(batches)===profile.batchesHash,'PREPARED_EVIDENCE_BATCHES');
 const normalize=raw=>{
  const mappings=profile.terminalMappings;
  assert(Array.isArray(mappings)&&mappings.length===profile.terminalRecords.length,'PREPARED_TERMINAL_MAPPING');
  const matches=mappings.filter(m=>m.rawHash===hash(raw));assert(matches.length===1,'PREPARED_TERMINAL_MAPPING');
  return prepareNextgenRound(raw,matches[0].mapping);
 };
 const terminalRecords=reconcile?await reviewReceivedTerminalRecords({batches,plan,parser,runnerNext:nextRequest,normalize}):[];
 console.log(JSON.stringify(await closeCountShared({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run,terminalRecords})));
}catch(error){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'PREPARED_EVIDENCE_REQUIRES_REVIEW',sourceRequests:0,newBetAllowance:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
