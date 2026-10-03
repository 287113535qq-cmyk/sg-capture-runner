import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';import {randomUUID,createHash} from 'node:crypto';
import {newInventory,claimPreparation,finishPreparation,rejectPreparedRevision} from './runner-v2/preparation-inventory.mjs';
import {applyWorkLineEvent} from './runner-v2/work-line-events.mjs';
import {protocolHash as hash} from './runner-v2/protocol-resume.mjs';
import {publishImmutableInbox} from './runner-v2/work-line-mailbox.mjs';
import {preparationHandlers,preparationInputHash,reviewedPreparation,preparationSourceHash} from './runner-v2/preparation-handlers.mjs';
import {stagePreparedCycle} from './runner-v2/preparation-publication-cycle.mjs';
import {preparationRevision} from './runner-v2/preparation-revision.mjs';
import {reviewFlowRepairInbox} from './runner-v2/flow-repair-inbox.mjs';
import {replaceLocalJson} from './runner-v2/atomic-local-state.mjs';

// Local offline producer. Fixed handlers only: no source client, shell commands,
// GitHub dispatch, credentials, profiles or quota. Online admission is separate.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lane=process.argv.find(a=>a.startsWith('--lane='))?.split('=')[1];
if(!['admission','repair'].includes(lane))throw new Error('PREPARATION_LANE_REQUIRED');
const dir=path.join(root,'.local','preparation-worker',lane);fs.mkdirSync(dir,{recursive:true});
fs.mkdirSync(path.join(dir,'inbox'),{recursive:true});
const stateFile=path.join(dir,'inventory.json'),lockFile=path.join(dir,'producer.lock');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=value=>replaceLocalJson(stateFile,value);
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
const bundledPython=process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'Programs','Python','Python314','python.exe'):null;
const owner=randomUUID(),python=process.env.PYTHON||(bundledPython&&fs.existsSync(bundledPython)?bundledPython:'python');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^SG_|TOKEN|SECRET|PASSWORD/i.test(k)));
Object.assign(env,{PYTHON:python,PYTHONUTF8:'1',PYTHONPATH:path.join(root,'service')+path.delimiter+path.join(root,'service','tests')});
let commandDeadline=null;
function run(exe,args,label){
  const timeout=commandDeadline?Math.max(1,Math.min(180000,commandDeadline-Date.now())):180000;
  if(commandDeadline&&commandDeadline<=Date.now())return false;
  const r=spawnSync(exe,args,{cwd:root,env,encoding:'utf8',timeout,maxBuffer:4*1024*1024,windowsHide:true});
  fs.writeFileSync(path.join(dir,label+'.log'),(r.stdout??'')+(r.stderr??'')+(r.error?.message??''));
  return r.status===0&&!r.error;
}
const bytesHash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceHash=p=>preparationSourceHash(fs.readFileSync(p,'utf8'));
function inputsFor(gameId,index){
 const reference=index.games.find(g=>g.gameId===gameId);
 const {handler,fileHashes,revisionHash}=preparationRevision(root,gameId,reference);
 const evidenceDir=path.join(root,'.local','preparation-worker','evidence',String(gameId));
 const receipts=[];
 if(fs.existsSync(evidenceDir))for(const name of fs.readdirSync(evidenceDir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){
  try{const receipt=load(path.join(evidenceDir,name));if(hash(receipt)+'.json'===name)receipts.push(receipt);}catch{/* Invalid evidence never becomes ready. */}
 }
 const resultFile=path.join(dir,gameId+'-result.json');
 return {reference,handler,fileHashes,revisionHash,receipts,evidenceDir,
  inputHash:preparationInputHash({gameId,reference,fileHashes,evidenceHashes:[hash({python,worker:sourceHash(path.join(root,'scripts','preparation-worker.mjs'))}),...receipts.map(hash),...(fs.existsSync(resultFile)?[bytesHash(resultFile)]:[])]})};
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
   try{
    const q=load(stateFile);
    for(const name of fs.readdirSync(path.join(dir,'inbox')).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){
      const rejected=path.join(dir,name+'.rejected');if(fs.existsSync(rejected))continue;
      try{
        const event=load(path.join(dir,'inbox',name));
        if(hash(event)+'.json'!==name)throw Error('WORK_LINE_EVENT_CHANGED');
        if(q.tasks.find(t=>t.gameId===event.gameId)?.claim)continue;
        if(applyWorkLineEvent(q,event,lane,Date.now())){save(q);log({action:event.kind,gameId:event.gameId});}
      }catch(error){
        fs.writeFileSync(rejected,JSON.stringify({at:Date.now(),status:'event-requires-review',code:/^[A-Z_]+$/.test(error.message)?error.message:'INVALID_EVENT',sourceAllowance:0}),{flag:'wx'});
        log({action:'event-requires-review',event:name});
      }
    }
    if(lane==='repair'){
      try{
        const flow=await reviewFlowRepairInbox(root,index,python);
        if(flow)log({action:'flow-evidence-reviewed',...flow});
      }catch(error){log({action:'flow-review-requires-review',reason:/^[A-Z_]{1,80}$/.test(error.message)?error.message:'FLOW_REVIEW_IO_FAILED'});}
    }
    // Revoke changed implementations and durable failures before publishing
    // repair events or handoffs. Otherwise a stale proof can escape this tick.
    for(const task of q.tasks.filter(t=>t.status==='prepared')){
      const current=inputsFor(task.gameId,index);
      if(task.proof?.revisionHash!==current.revisionHash){
        task.status='queued';task.proof=null;delete task.proofHash;
        task.reason='PREPARATION_IMPLEMENTATION_CHANGED';q.revision++;save(q);continue;
      }
      const failureFile=path.join(dir,task.gameId+'-failure.json');
      if(fs.existsSync(failureFile)){
        const failure=load(failureFile);
        if(rejectPreparedRevision(q,{...failure,gameId:task.gameId,now:Date.now()})){
          save(q);log({action:'prepared-revision-rejected',gameId:task.gameId,reason:failure.reason});
        }
      }
    }
    if(lane==='admission'){
      try{
        const staged=await stagePreparedCycle(root,q);
        if(staged.changed)log({action:'publication-candidate-staged',prepared:staged.prepared,rejected:staged.rejected});
      }catch(error){
        log({action:'publication-requires-review',code:/^[A-Z_]+$/.test(error.message)?error.message:'PUBLICATION_INPUT_INVALID'});
      }
    }
    // Once a independently reviewed publication includes its applied-profile
    // handoff, publish it without waiting for the next conversational turn.
    // No profile is generated and no permission is renewed here.
    if(lane==='admission')for(const task of q.tasks.filter(t=>t.status==='prepared')){
      if(task.proof?.revisionHash!==inputsFor(task.gameId,index).revisionHash)continue;
      const resultFile=path.join(dir,task.gameId+'-result.json');
      if(!fs.existsSync(resultFile))continue;
      const result=load(resultFile),handoff=result.captureHandoff;
      if(handoff&&handoff.gameId===task.gameId&&hash(result.proof)===task.proofHash){
        publishImmutableInbox(path.join(root,'.local','capture-handoff-worker','inbox'),
          {...handoff,preparationProof:task.proof,preparationProofHash:task.proofHash});
      }
    }
    if(lane==='repair')for(const task of q.tasks.filter(t=>t.status==='prepared'&&t.failureEvidenceHash)){
      if(task.proof?.revisionHash!==inputsFor(task.gameId,index).revisionHash)continue;
      const event={schema:'sg-work-line-event-v1',kind:'repair-verified',gameId:task.gameId,
        sourceAllowance:0,failureEvidenceHash:task.failureEvidenceHash,
        ...(task.rejectedProofHash?{rejectedProofHash:task.rejectedProofHash}:{}),
        evidenceHash:hash(task.proof),proof:task.proof};
      try{publishImmutableInbox(path.join(root,'.local','preparation-worker','admission','inbox'),event);}
      catch(error){log({action:'repair-return-requires-review',gameId:task.gameId,
        reason:/^[A-Z_]+$/.test(error.message)?error.message:'WORK_LINE_RETURN_IO_FAILED'});}
    }
    // Compare content, including implementation changes, rather than timestamps.
    // Retry the affected game once per input revision, not every idle tick.
    for(const task of q.tasks.filter(t=>t.lane===lane&&t.status==='blocked')){
      const input=inputsFor(task.gameId,index);
      if(task.inputHash!==input.inputHash){task.status='queued';q.revision++;}
    }
    const beforeClaim=hash(q),claim=claimPreparation(q,{owner,now:Date.now(),leaseMs:600000,lane});
    if(hash(q)!==beforeClaim)save(q);
    if(!claim){
      if(!waiting)log({action:'waiting-evidence',reason:'NO_RUNNABLE_PREPARATION',completedAdmission:false});
      waiting=true;if(once)break;
      await new Promise(resolve=>setTimeout(resolve,5000));continue;
    }
    waiting=false;log({action:'preparing',gameId:claim.gameId,lane:claim.lane});
    commandDeadline=claim.claim.until-5000;
    const input=inputsFor(claim.gameId,index),task=q.tasks.find(t=>t.gameId===claim.gameId);
    task.inputHash=input.inputHash;task.revisionHash=input.revisionHash;
    const resultFile=path.join(dir,claim.gameId+'-result.json');
    let savedResult=null;
    try{if(fs.existsSync(resultFile))savedResult=load(resultFile);}catch{
      finishPreparation(q,claim,{status:'blocked',reason:'PREPARATION_RECEIPT_INVALID'},Date.now());save(q);continue;
    }
    if(savedResult&&(savedResult.proof?.revisionHash===input.revisionHash||savedResult.revisionHash===input.revisionHash)){
      try{
        const result=savedResult;
        if(result.status==='prepared'){
          const reviewed=reviewedPreparation({gameId:claim.gameId,revisionHash:input.revisionHash,receipts:input.receipts,failureEvidenceHash:task.failureEvidenceHash});
          if(reviewed.status!=='prepared'||hash(reviewed.proof)!==hash(result.proof))throw Error('PREPARATION_RECEIPT_EVIDENCE_MISSING');
        }
        // A failed revision may not be re-approved by its old receipt.
        if(task.rejectedProofHash&&result.status==='prepared'&&hash(result.proof)===task.rejectedProofHash)throw Error('PREPARATION_FAILED_REVISION');
        finishPreparation(q,claim,result,Date.now());save(q);
        log({action:task.status,gameId:claim.gameId});continue;
      }
      catch{
        if(q.tasks.find(t=>t.gameId===claim.gameId)?.claim?.token===claim.claim.token){
          finishPreparation(q,claim,{status:'blocked',reason:'PREPARATION_RECEIPT_INVALID'},Date.now());save(q);
        }else log({action:'publication-requires-review',gameId:claim.gameId});
        continue;
      }
    }
    const reference=input.reference;
    fs.writeFileSync(path.join(dir,claim.gameId+'-reuse.json'),JSON.stringify(reference,null,2)+'\n');
    let reason='ADAPTER_DIFFERENCE_EVIDENCE_REQUIRED';
    if(input.handler){
      const existingLocal=input.receipts.filter(r=>r.schema==='sg-preparation-gate-v1'&&r.gameId===claim.gameId
        &&r.revisionHash===input.revisionHash&&r.gate==='local'&&r.verified===true&&r.sourceAllowance===0);
      if(existingLocal.length){
        const reviewed=reviewedPreparation({gameId:claim.gameId,revisionHash:input.revisionHash,receipts:input.receipts,failureEvidenceHash:task.failureEvidenceHash});
        task.missingGates=reviewed.missingGates??[];
        finishPreparation(q,claim,reviewed,Date.now());save(q);
        log({action:reviewed.status,gameId:claim.gameId,lane:claim.lane,missingGates:task.missingGates,localChecksReused:true});continue;
      }
      const label=claim.gameId+'-'+input.revisionHash;
      const node=run(process.execPath,['--test',...input.handler.node],label+'-node');
      let py=true;for(const name of input.handler.python){
        const ok=run(python,['-m','unittest','discover','-s','service/tests','-p',name],label+'-'+name);py=ok&&py;
      }
      if(node&&py){
        const logs=[label+'-node',...input.handler.python.map(n=>label+'-'+n)];
        const receipt={schema:'sg-preparation-gate-v1',gate:'local',gameId:claim.gameId,
          revisionHash:input.revisionHash,verified:true,sourceAllowance:0,
          supportingHashes:logs.map(n=>bytesHash(path.join(dir,n+'.log')))};
        publishImmutableInbox(input.evidenceDir,receipt);
        const reviewed=reviewedPreparation({gameId:claim.gameId,revisionHash:input.revisionHash,failureEvidenceHash:task.failureEvidenceHash,
          receipts:[...input.receipts.filter(r=>r.gate!=='local'||r.revisionHash!==input.revisionHash),receipt]});
        task.missingGates=reviewed.missingGates??[];
        task.inputHash=inputsFor(claim.gameId,index).inputHash;
        finishPreparation(q,claim,reviewed,Date.now());save(q);
        log({action:reviewed.status,gameId:claim.gameId,lane:claim.lane,missingGates:task.missingGates});continue;
      }
      reason='LOCAL_CHECK_FAILED';
    }
    finishPreparation(q,claim,{status:'blocked',reason},Date.now());save(q);
    log({action:'blocked',gameId:claim.gameId,lane:claim.lane,reason});
   }catch(error){
    // Reload durable state next tick. Claims remain fenced; an unconfirmed
    // publication never becomes a completed task or a new source permission.
    log({action:'local-state-requires-review',code:/^[A-Z_]{1,80}$/.test(error.code??'')?error.code:'PREPARATION_LOCAL_STATE_FAILED'});
    if(once)throw error;
    await new Promise(resolve=>setTimeout(resolve,1000));
   }
  }while(!stopping);
}finally{
  fs.closeSync(lock);fs.unlinkSync(lockFile);
}
