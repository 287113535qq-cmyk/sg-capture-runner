import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';
import {SourceControl} from './control.mjs';import {GithubCampaign} from './campaign.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {countPeerBoundary} from './count-peer-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {pyramidsDirectActionPlan} from './pyramids-direct-action-profile.mjs';import {checkDirectFinalAudit} from './action-final-audit.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner','DIRECT_AUDIT_GITHUB');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),permission=load('config/count-audit-pyramids-direct-action-20261002.json');
for(const [path,h]of Object.entries(permission.files))assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..')
 &&createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'DIRECT_AUDIT_RUNTIME_CHANGED');
const profile=load('config/formal-repair-pyramids-resume-action-20261002.json'),revision=load('config/count-runtime-pyramids-resume-verified-continuation-20261002.json'),
 plans=load('config/round-one-plans.json'),base=plans[32721],plan=pyramidsDirectActionPlan(base,profile);plans[32721]=plan;
const read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate(),parser=analyzer({auditWorkers:2}),
 store=new RunnerState({transport,gate,deadline:Date.now()+40*60000}),commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const github=countPeerBoundary({read,transport,peer:profile.primaryPeer,selfGroup:'secondary',run,commit,workflowPath:'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{await github();await store.writable();await checkPrimaryLeases({store,plans});
 assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');};
try{
 await boundary();const root='repos/287113535qq-cmyk/sg-capture-runner/actions/runs/'+permission.sourceRun.split(':')[0];
 const source=await read(root),jobs=await read(root+'/jobs?filter=all&per_page=100'),get=async k=>(await store.get('journal',k))?.value;
 const key=`complete-count:${plan.trialId}:${profile.activation}`,spec=await get(key),complete=await get(key+':complete'),
 receipt=await get(`count-runtime:${plan.trialId}:${profile.activation}:${permission.sourceCommit}`);
 await checkDirectFinalAudit({store,base,plan,profile,revision,permission,source,jobs,spec,complete,receipt});
 assert((await parser.call({op:'plan',plan})).validated===true,'DIRECT_AUDIT_PYTHON_PLAN');
 const campaign=new GithubCampaign({store,transport,control:new SourceControl({store,transport,gate,plan}),analyzer:parser,plans,group:'secondary',owner:run,
 commit:permission.sourceCommit,auditProgress:r=>console.log(JSON.stringify(r))});
 const next=await campaign.select({expectedGame:32721});assert(next.action==='audit','DIRECT_AUDIT_CLAIM');
 console.log(JSON.stringify({audit:await campaign.audit(plan),sourceRequests:0,newBetAllowance:0}));
}catch(e){console.log(JSON.stringify({error:/^[A-Z0-9_]{1,100}$/.test(e.message)?e.message:'DIRECT_AUDIT_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
