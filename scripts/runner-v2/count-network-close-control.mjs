import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {applyFormalCount} from './formal-count-plan.mjs';import {closeCountNetwork} from './count-network-close.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const readFile=p=>JSON.parse(fs.readFileSync(p,'utf8')),name=process.env.SG_COUNT_NETWORK_PROFILE??'count-network-pearl-20261001.json';
const rhino=name==='count-network-rhino-canary-20261002.json';
assert(rhino||name==='count-network-pearl-20261001.json','COUNT_NETWORK_PROFILE_SCOPE');
const profile=readFile('config/'+name),basePlans=readFile('config/round-one-plans.json');
process.env.SG_FORMAL_COUNT_PROFILE=rhino?'formal-sessions-rhino-two-20261001.json':'formal-repair-pearl-awards-20261001.json';
const source=readFile('config/'+process.env.SG_FORMAL_COUNT_PROFILE),plan=applyFormalCount(basePlans,source)[rhino?32799:32795];
assert(profile.sourceProfileHash===hash(source)&&profile.unknownAttempts===1&&Object.keys(profile.files??{}).length>=400,'COUNT_NETWORK_FIXED_SCOPE');
if(rhino)assert(profile.sourceRun==='36886658723:1'&&profile.sourceCommit==='14c2d194c2ae48525bafdfebd4fd30cea036b948'
 &&profile.trialId==='sg_r1_20261001_32799'&&profile.completePreserved===199775&&profile.abandonedAttempts===14,'COUNT_NETWORK_FIXED_SCOPE');
else assert(profile.sourceRun==='36744028113:1'&&profile.sourceCommit==='5c513a6f55dfaccfc0e5e8f13b30ab7c3ab18c7a'
 &&profile.completePreserved===25392&&profile.abandonedAttempts===14&&/^[a-f0-9]{64}$/.test(profile.recordsHash??'')&&profile.batchId===286,'COUNT_NETWORK_FIXED_SCOPE');
for(const [p,h]of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'COUNT_NETWORK_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'COUNT_NETWORK_RUNTIME_CHANGED');
}
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
const read=authenticatedRead(process.env.GH_TOKEN),commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const idle=maintenanceBoundary({read,store,oldProfile:readFile('config/demo-pilot-beaver-20260930.json'),run,commit});
try{
 const boundary=async()=>{
  assert(profile.createdAt<=Date.now()&&Date.now()<profile.expiresAt,'COUNT_NETWORK_PROFILE_STALE');await idle();await store.writable();
  assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans:basePlans});
  const holds=await transport.request('global_holds');assert(hash(holds.map(r=>({_id:r._id,value:r.value})).sort((a,b)=>a._id.localeCompare(b._id)))===profile.holdsHash,'COUNT_NETWORK_HOLDS_CHANGED');
 };
 const prefix='repos/zyzuoyang/sg-capture-runner/actions/runs/'+profile.sourceRun.split(':')[0],ended=await read(prefix),jobs=await read(prefix+'/jobs?filter=all&per_page=100');
 console.log(JSON.stringify(await closeCountNetwork({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run})));
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'COUNT_NETWORK_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
