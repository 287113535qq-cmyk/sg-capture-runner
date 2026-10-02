import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';import {countPeerBoundary} from './count-peer-boundary.mjs';
import {closeParkedCount} from './count-parked-close.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner','SECONDARY_GITHUB_REQUIRED');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),name=process.env.SG_PARKED_CLOSE_PROFILE??'count-close-pyramids-sfgt-20261002.json';
const choices={'count-close-pyramids-sfgt-20261002.json':'formal-repair-pyramids-super-hold-20261002.json',
 'count-close-pyramids-retrigger-coin-20261002.json':'formal-repair-pyramids-retrigger-20261002.json',
 'count-close-pyramids-super-coin-20261002.json':'formal-repair-pyramids-cash-coins-20261002.json'};
assert(Object.hasOwn(choices,name),'PARKED_CLOSE_PROFILE_SCOPE');
const sourceName=choices[name],profile=load('config/'+name),source=load('config/'+sourceName),base=load('config/round-one-plans.json');
assert(profile.sourceProfileHash===hash(source)&&profile.sourceRun===(name==='count-close-pyramids-sfgt-20261002.json'?'36946815410:1':name==='count-close-pyramids-super-coin-20261002.json'?'36961087858:1':'36955443358:1')
 &&profile.sourceAllowance===0&&Object.keys(profile.files).length>700,'PARKED_CLOSE_RUNTIME_SCOPE');
for(const [p,h] of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'PARKED_CLOSE_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'PARKED_CLOSE_RUNTIME_CHANGED');
}
process.env.SG_FORMAL_COUNT_PROFILE=sourceName;
const plan=applyFormalCount(base,source)[32721],transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer({auditWorkers:2});
const read=authenticatedRead(process.env.GH_TOKEN),commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const github=countPeerBoundary({read,transport,peer:profile.primaryPeer,selfGroup:'secondary',run,commit,workflowPath:'.github/workflows/demo-maintenance.yml'});
try{
 const boundary=async()=>{assert(profile.createdAt<=Date.now()&&Date.now()<profile.expiresAt,'PARKED_CLOSE_STALE');
  await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  await checkPrimaryLeases({store,plans:base});};
 const path='repos/287113535qq-cmyk/sg-capture-runner/actions/runs/'+profile.sourceRun.split(':')[0];
 const ended=await read(path),jobs=await read(path+'/jobs?filter=all&per_page=100');
 assert((await parser.call({op:'plan',plan})).validated,'PARKED_CLOSE_PYTHON_PLAN');
 console.log(JSON.stringify(await closeParkedCount({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run})));
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'PARKED_CLOSE_REQUIRES_REVIEW',sourceRequests:0,newBetAllowance:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
