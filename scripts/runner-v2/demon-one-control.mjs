import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {analyzer} from './analyzer.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {DemonOneRecovery} from './demon-one-recovery.mjs';
import {githubBoundary,authenticatedRead} from './github-boundary.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';
import {original} from './expired-run-review.mjs';
const stage=process.argv[2],repo=process.env.GITHUB_REPOSITORY;
assert(process.env.GITHUB_ACTIONS==='true' && repo===original.repository,'PRIMARY_GITHUB_REQUIRED');
assert(['recover','validate','formal'].includes(stage),'INVALID_STAGE');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const profile=load('config/demon-one-20260929.json'),old=load('config/demon-two-20260929.json'),queue=load('config/demon-queue-20260929.json');
assert(hash(old)===original.profileHash && hash(queue)==='933af2a4689c4ea4be7aeabcee62ce0e5842896be12c98118c99c6c6a1b28689','FROZEN_PROFILE_CHANGED');
assert(profile.schema==='sg-demon-one-v1' && profile.id==='demon-one-36551698305'
 && profile.pending===2 && profile.complete===246 && hash(profile.pendingFirst)===hash({resumeWorkers:[7],captureWorkers:20,newBetsBeforeOriginalSettlement:false})
 && hash(profile.featureValidation)===hash({shortPerWorker:10,newComplete:200,requireNewNaturalBonus:2,allowFormalWithoutEvidence:false,allowUnboundedProbe:false}),'INCIDENT_SCOPE_CHANGED');
const actual=Object.fromEntries(Object.keys(profile.adapterFiles).map(p=>{
  assert(/^(service|scripts|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p) && !p.includes('..'),'BAD_ADAPTER_PATH');
  return [p,createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')];
}));
assert(hash(actual)===profile.adapterHash && hash(actual)===hash(profile.adapterFiles),'ADAPTER_VERSION_CHANGED');
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA;
const githubIdle=githubBoundary({read:authenticatedRead(process.env.GH_TOKEN),run,commit});
const transport=connectGateway(),gate=new ResourceGate(),parser=analyzer();
const store=new RunnerState({transport,gate,deadline:Date.now()+30*60000});
try {
  const plans=load('config/round-one-plans.json');
  const operator=new DemonOneRecovery({store,transport,gate,parser,plan:plans[32739],profile,githubIdle,
    checkLeases:()=>checkPrimaryLeases({store,plans}),run,commit,owner:'demon-one:'+run});
  console.log(JSON.stringify({stage,...await operator[stage]()}));
}catch(error){
  console.log(JSON.stringify({stage,error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'DEMON_ONE_REQUIRES_REVIEW',sourceRequests:0}));
  process.exitCode=2;
}finally{parser.close();transport.close();}
