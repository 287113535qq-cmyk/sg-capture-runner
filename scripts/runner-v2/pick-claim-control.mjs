import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {analyzer} from './analyzer.mjs';
import {repositories} from '../trial/runner-group.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {PickClaimRecovery} from './pick-claim-recovery.mjs';
const stage=process.argv[2],repo=process.env.GITHUB_REPOSITORY;
assert(process.env.GITHUB_ACTIONS==='true' && repositories[repo],'GITHUB_REPOSITORY_REQUIRED');
assert(['recover','validate','formal'].includes(stage),'INVALID_PROTOCOL_STAGE');
const group=repositories[repo].name;
assert(group==='secondary','WRONG_PICK_CLAIM_GROUP');
const profile=JSON.parse(fs.readFileSync('config/pick-claim-20260929.json','utf8'));
assert(profile.group===group,'WRONG_PROTOCOL_GROUP');
assert(profile.adapterHashFormat==='utf8-lf-sha256','ADAPTER_HASH_FORMAT');
const actual=Object.fromEntries(Object.keys(profile.adapterFiles).map(path=>{
  assert(/^(service|scripts|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path) && !path.includes('..'),'INVALID_ADAPTER_PATH');
  return [path,createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')];
}));
assert(hash(actual)===profile.adapterHash && hash(actual)===hash(profile.adapterFiles),'ADAPTER_VERSION_CHANGED');
const transport=connectGateway(),gate=new ResourceGate(),parser=analyzer();
const store=new RunnerState({transport,gate,deadline:Date.now()+30*60000});
async function githubIdle(){
  assert(process.env.GH_TOKEN,'GITHUB_AUTH_REQUIRED');
  const read=async path=>{
    const response=await fetch('https://api.github.com/'+path,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
    assert(response.ok,'GITHUB_RUN_READ_FAILED');return response.json();
  };
  for(const repository of Object.keys(repositories))for(const status of ['in_progress','queued','pending','waiting','requested']){
    const data=await read(`repos/${repository}/actions/runs?status=${status}&per_page=100`);
    assert(data.total_count<100,'GITHUB_RUN_LIST_TRUNCATED');
    for(const run of data.workflow_runs){
      if(repository===repo){
        assert(String(run.id)===process.env.GITHUB_RUN_ID && run.path==='.github/workflows/trial-300k.yml','OTHER_RUN_ACTIVE');
      }else{
        assert(false,'OTHER_RUN_ACTIVE');
      }
    }
  }
}
try{
  const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))[profile.gameId];
  const operator=new PickClaimRecovery({store,transport,gate,parser,plan,profile,githubIdle,
    owner:`pick-claim:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`,commit:process.env.GITHUB_SHA});
  console.log(JSON.stringify({stage,...await operator[stage]()}));
}catch(error){
  console.log(JSON.stringify({stage,error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'PICK_CLAIM_RECOVERY_REQUIRES_REVIEW',sourceRequests:0}));
  process.exitCode=2;
}finally{parser.close();transport.close();}
