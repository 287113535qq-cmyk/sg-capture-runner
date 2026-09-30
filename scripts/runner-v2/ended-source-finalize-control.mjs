import fs from 'node:fs';import assert from 'node:assert/strict';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {SourceControl} from './control.mjs';
import {GithubCampaign} from './campaign.mjs';import {authenticatedRead} from './github-boundary.mjs';
import {secondaryParallelBoundary,secondaryRepository,observationPrimary} from './secondary-parallel-boundary.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';import {applyFormalCount} from './formal-count-plan.mjs';
import {finalizeEndedSource} from './ended-source-finalize.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===secondaryRepository,'SECONDARY_GITHUB_REQUIRED');
const sourceRun=process.env.SG_ENDED_SOURCE_RUN;assert(/^\d+:1$/.test(sourceRun??''),'ENDED_SOURCE_RUN_REQUIRED');
const read=authenticatedRead(process.env.GH_TOKEN),load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const base=load('config/round-one-plans.json'),profile=load('config/formal-repair-pyramids-coins-20261001.json');
assert(hash(profile)==='93fef71918ebb6ad0d08e546b3ec13a2964b8493b8f860306e99564899808533','ENDED_SOURCE_PROFILE_CHANGED');
const plans=applyFormalCount(base,profile),plan=plans[32721],commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+15*60000});
const control=new SourceControl({store,transport,gate}),campaign=new GithubCampaign({store,transport,control,plans,
 analyzer:{call:async()=>{throw Error('ENDED_FINALIZE_ANALYZER_FORBIDDEN');}},group:'secondary',owner:run,commit});
const github=secondaryParallelBoundary({read,transport,run,commit,primaryRun:observationPrimary});
const boundary=async()=>{await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans:base});};
try{
 const path=`repos/${secondaryRepository}/actions/runs/${sourceRun.split(':')[0]}`,ended=await read(path),jobs=await read(path+'/jobs?filter=all&per_page=100');
 assert(`${ended.id}:${ended.run_attempt}`===sourceRun,'ENDED_SOURCE_IDENTITY');
 console.log(JSON.stringify(await finalizeEndedSource({store,campaign,plan,profile,ended,jobs,boundary})));
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'ENDED_FINALIZE_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{transport.close();}
