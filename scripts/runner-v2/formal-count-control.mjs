import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';import {checkDemoSourceEnded} from './demo-source-ended.mjs';
import {formalCountProfilePath,applyFormalCount} from './formal-count-plan.mjs';
import {activateFormalCount} from './formal-count-activation.mjs';import {loadCountPermission,checkLedger} from './complete-count.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const mode=process.argv[2];assert(['activate','admit'].includes(mode),'FORMAL_COUNT_OPERATION');
const readFile=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=readFile(formalCountProfilePath()),basePlans=readFile('config/round-one-plans.json');
const plans=applyFormalCount(basePlans,profile),plan=plans[32795],commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
assert(profile.files&&Object.keys(profile.files).length>=300,'FORMAL_COUNT_RUNTIME_MANIFEST');
for(const [p,h] of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'FORMAL_COUNT_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'FORMAL_COUNT_RUNTIME_CHANGED');
}
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer(),read=authenticatedRead(process.env.GH_TOKEN);
const idle=maintenanceBoundary({read,store,oldProfile:readFile('config/demo-pilot-beaver-20260930.json'),run,commit,
 workflowPath:mode==='activate'?'.github/workflows/demo-maintenance.yml':'.github/workflows/trial-300k.yml'});
try{
 const boundary=async()=>{
  await idle();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  await checkPrimaryLeases({store,plans:basePlans});
  const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r?.value.active===false),'GLOBAL_HOLD');
  const rows=await transport.request('rounds_scan',{trialId:plan.trialId,after:profile.maxSequence});
  assert(rows.length===0,'FORMAL_COUNT_NATIVE_CEILING');
 };
 if(mode==='activate'){
  const ended=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/'+profile.sourceRunKey.split(':')[1]);
  const jobs=await read(`repos/zyzuoyang/sg-capture-runner/actions/runs/${ended.id}/jobs?filter=all&per_page=100`);
  checkDemoSourceEnded({ended,jobs,profile});assert(ended.conclusion==='success','FORMAL_COUNT_SOURCE_NOT_SUCCESSFUL');
  console.log(JSON.stringify(await activateFormalCount({store,transport,parser,plans:basePlans,profile,boundary,commit,run})));
 }else{
  await boundary();
  const pool=(await store.get('state','pool:'+plan.trialId))?.value,c=(await store.get('state','campaign'))?.value;
  const spec=await loadCountPermission({store,plan,pool,commit}),ledger=checkLedger(pool,plan,spec);
  assert(pool.enabled&&!pool.failure&&ledger.reserved===0&&pool.confirmed<plan.target
   &&Object.values(pool.workers).every(w=>!w.activeBatch)&&c.enabled&&c.activeGame===32795&&!c.protocolValidation&&!c.validationLimit
   &&c.formalCount?.activation===profile.activation,'FORMAL_COUNT_NOT_READY');
  const key=`count-run:${plan.trialId}:${run}`;assert(!(await store.get('journal',key)),'FORMAL_COUNT_RUN_ALREADY_ADMITTED');
  const permit={schema:'sg-count-run-v1',activation:profile.activation,profileHash:hash(profile),commit,run,
   poolHash:hash(pool),completeBefore:pool.confirmed,remainingComplete:plan.target-pool.confirmed,createdAt:Date.now(),expiresAt:Date.now()+270*60000};
  await store.create('journal',key,permit,{immutable:true});
  assert(hash((await store.get('journal',key))?.value)===hash(permit),'FORMAL_COUNT_RUN_READBACK');
  console.log(JSON.stringify({admitted:true,completeBefore:pool.confirmed,remainingComplete:permit.remainingComplete,sourceRequests:0}));
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'FORMAL_COUNT_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
