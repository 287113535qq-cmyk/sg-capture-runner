import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
import {newInventory,claimPreparation,finishPreparation} from './runner-v2/preparation-inventory.mjs';

// Local offline producer. Fixed handlers only: no source client, shell commands,
// GitHub dispatch, credentials, profiles or quota. Online admission is separate.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lane=process.argv.find(a=>a.startsWith('--lane='))?.split('=')[1];
if(!['admission','repair'].includes(lane))throw new Error('PREPARATION_LANE_REQUIRED');
const dir=path.join(root,'.local','preparation-worker',lane);fs.mkdirSync(dir,{recursive:true});
const stateFile=path.join(dir,'inventory.json'),lockFile=path.join(dir,'producer.lock');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=value=>{
  const temp=stateFile+'.'+process.pid+'.tmp',fd=fs.openSync(temp,'wx');
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(temp,stateFile);
};
const log=value=>console.log(JSON.stringify({at:Date.now(),...value,sourceAllowance:0}));
if(process.argv.includes('--status')){
  const q=load(stateFile),counts={};for(const t of q.tasks)counts[t.status]=(counts[t.status]??0)+1;
  log({revision:q.revision,counts,active:q.tasks.filter(t=>t.claim).map(t=>({gameId:t.gameId,lane:t.lane})),
    prepared:q.tasks.filter(t=>t.status==='prepared').map(t=>t.gameId)});
  process.exit(0);
}
let lock;
try{lock=fs.openSync(lockFile,'wx');}catch{throw new Error('PREPARATION_PRODUCER_ALREADY_OWNED');}
fs.writeFileSync(lock,JSON.stringify({pid:process.pid,startedAt:Date.now()}));fs.fsyncSync(lock);
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
const owner=randomUUID(),python=process.env.PYTHON||'python';
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^SG_|TOKEN|SECRET|PASSWORD/i.test(k)));
Object.assign(env,{PYTHONUTF8:'1',PYTHONPATH:path.join(root,'service')+path.delimiter+path.join(root,'service','tests')});
function run(exe,args,label){
  const r=spawnSync(exe,args,{cwd:root,env,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024,windowsHide:true});
  fs.writeFileSync(path.join(dir,label+'.log'),(r.stdout??'')+(r.stderr??'')+(r.error?.message??''));
  return r.status===0&&!r.error;
}
try{
  if(!fs.existsSync(stateFile)){
    const statuses={},snapshot=path.join(root,'.local','efficiency5','action-budget-independent-queues-private.json');
    if(fs.existsSync(snapshot)){
      const saved=load(snapshot);
      for(const c of saved.campaigns??[]){const value=c.value??c;
        for(const g of value.games??[])statuses[g.game_id]=g.status;}
      for(const r of saved.repairs??[]){const v=r.value??r;
        if(!['repaired-returned','complete','closed'].includes(v.status)&&statuses[v.gameId]!=='complete')statuses[v.gameId]='parked-protocol';}
    }
    save(newInventory(load(path.join(root,'config','games.json')),statuses));
  }
  let index;
  if(run(python,['scripts/feature_reuse_index.py','--output',path.join(dir,'feature-index.json')],'feature-index'))index=load(path.join(dir,'feature-index.json'));
  else throw new Error('PREPARATION_FEATURE_INDEX_FAILED');
  const once=process.argv.includes('--once');let waiting=false;
  do{
    const q=load(stateFile);
    // Finished immutable reviews arrive independently. Retry only when new
    // evidence exists, never on a timer with the same failed input.
    for(const task of q.tasks.filter(t=>t.lane===lane&&t.status==='blocked')){
      const resultFile=path.join(dir,task.gameId+'-result.json');
      if(fs.existsSync(resultFile)&&fs.statSync(resultFile).mtimeMs>task.updatedAt){task.status='queued';q.revision++;}
    }
    const claim=claimPreparation(q,{owner,now:Date.now(),leaseMs:600000,lane});save(q);
    if(!claim){
      if(!waiting)log({action:'waiting-evidence',reason:'NO_RUNNABLE_PREPARATION',completedAdmission:false});
      waiting=true;if(once)break;
      await new Promise(resolve=>setTimeout(resolve,5000));continue;
    }
    waiting=false;log({action:'preparing',gameId:claim.gameId,lane:claim.lane});
    const resultFile=path.join(dir,claim.gameId+'-result.json');
    if(fs.existsSync(resultFile)){
      try{finishPreparation(q,claim,load(resultFile),Date.now());save(q);log({action:q.tasks.find(t=>t.gameId===claim.gameId).status,gameId:claim.gameId});continue;}
      catch{finishPreparation(q,claim,{status:'blocked',reason:'PREPARATION_RECEIPT_INVALID'},Date.now());save(q);continue;}
    }
    const reference=index.games.find(g=>g.gameId===claim.gameId);
    fs.writeFileSync(path.join(dir,claim.gameId+'-reuse.json'),JSON.stringify(reference,null,2)+'\n');
    let reason='ADAPTER_DIFFERENCE_EVIDENCE_REQUIRED';
    if(claim.gameId===32812){
      const node=run(process.execPath,['--test','scripts/trial/veryfruity-worker.test.mjs','scripts/runner-v2/veryfruity-next-profile.test.mjs'],'32812-local-node');
      const py=run(python,['-m','unittest','discover','-s','service/tests','-p','test_veryfruity_action_fields.py'],'32812-local-python');
      reason=node&&py?'LOCAL_VERIFIED_LINUX_NATIVE_ACTIVATION_PENDING':'LOCAL_CHECK_FAILED';
    }else if(claim.gameId===32719){
      reason=run(python,['-m','unittest','discover','-s','service/tests','-p','test_inca_hold_action_review.py'],'32719-local-python')
        ?'REPAIR_LOCAL_VERIFIED_INTEGRATION_REENTRY_PENDING':'REPAIR_LOCAL_CHECK_FAILED';
    }
    finishPreparation(q,claim,{status:'blocked',reason},Date.now());save(q);
    log({action:'blocked',gameId:claim.gameId,lane:claim.lane,reason});
  }while(!stopping);
}finally{
  fs.closeSync(lock);fs.unlinkSync(lockFile);
}
