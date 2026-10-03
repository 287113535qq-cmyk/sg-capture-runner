import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {protocolHash as hash} from './runner-v2/protocol-resume.mjs';
import {reviewCaptureHandoff} from './runner-v2/capture-handoff.mjs';
import {deliverCaptureFault} from './runner-v2/capture-fault-delivery.mjs';
import {deliverConfirmedAnalysis} from './runner-v2/confirmed-analysis-task.mjs';
import {readWorkLineArtifacts} from './runner-v2/work-line-artifact-reader.mjs';
import {reviewPreparedPublicationHandoff,preparedHandoffReviewKey} from './runner-v2/prepared-publication-handoff.mjs';
import {workLineEvidencePump} from './runner-v2/work-line-evidence-pump.mjs';
import {deliverConfirmedFlowEvidence} from './runner-v2/confirmed-flow-evidence.mjs';
// Local handoff plus GET-only encrypted evidence delivery. No source client or
// dispatch authority. Online consumer revalidates every preparation gate.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'.local','capture-handoff-worker');
const consumerRevision=hash(['scripts/capture-handoff-worker.mjs','scripts/runner-v2/prepared-publication-handoff.mjs',
 'scripts/runner-v2/prepared-count-runtime.mjs','scripts/runner-v2/capture-fault-delivery.mjs',
 'scripts/runner-v2/capture-preparation-binding.mjs','scripts/runner-v2/prepared-count-plan.mjs',
 'scripts/runner-v2/confirmed-flow-evidence.mjs']
 .map(f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n')));
fs.mkdirSync(path.join(dir,'inbox'),{recursive:true});fs.mkdirSync(path.join(dir,'results'),{recursive:true});
const lockPath=path.join(dir,'producer.lock'),lock=fs.openSync(lockPath,'wx');fs.writeFileSync(lock,JSON.stringify({pid:process.pid}));
let stop=false,waiting=false;process.on('SIGINT',()=>{stop=true;});process.on('SIGTERM',()=>{stop=true;});
const evidencePump=workLineEvidencePump({read:()=>readWorkLineArtifacts(root),log:r=>console.log(JSON.stringify(r))});
try{
 do{
  let worked=false;
  const read=evidencePump.tick();if(process.argv.includes('--once'))await read;
  for(const name of fs.readdirSync(path.join(dir,'inbox')).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){
   let dest=path.join(dir,'results',name);
   let result;
   try{
    const r=JSON.parse(fs.readFileSync(path.join(dir,'inbox',name),'utf8'));
    if(hash(r)+'.json'!==name)throw Error('CAPTURE_READY_SCOPE');
    if(r.schema==='sg-capture-prepared-publication-v1'){
      const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
      const context={
        currentCycleHash:read('.local/preparation-worker/publication/current.json').cycleHash,
        inventory:read('.local/preparation-worker/admission/inventory.json'),
        plans:read('config/round-one-plans.json'),registry:read('config/preparation-plan-bindings.json'),
        countRegistry:read('config/prepared-count-authorizations.json'),
        runtimeRegistry:read('config/prepared-runtime-authorizations.json'),readProfile:read};
      dest=path.join(dir,'results',preparedHandoffReviewKey(r,context,consumerRevision)+'.json');
      if(fs.existsSync(dest))continue;
      result=await reviewPreparedPublicationHandoff({task:r,...context});
    }else if(r.schema==='sg-confirmed-flow-evidence-v1'){
      if(fs.existsSync(dest))continue;
      result=deliverConfirmedFlowEvidence(root,r);
    }else if(r.schema==='sg-confirmed-round-analysis-task-v1'){
      if(fs.existsSync(dest))continue;
      result=deliverConfirmedAnalysis(root,r);
    }else if(r.schema==='sg-capture-fault-export-v1'){
      // A previous consumer rejection is not a permanent repair veto.
      // Immutable source input is revalidated once per consumer revision;
      // downstream inbox publication remains idempotent and grants no source.
      dest=path.join(dir,'results',hash({taskHash:hash(r),consumerRevision})+'.json');
      if(fs.existsSync(dest))continue;
      result=deliverCaptureFault(root,r);
    }else{
    if(fs.existsSync(dest))continue;
    if(!/^[a-z0-9][a-z0-9-]*\.json$/.test(r.profile??''))throw Error('CAPTURE_READY_SCOPE');
    const p=JSON.parse(fs.readFileSync(path.join(root,'config',r.profile),'utf8'));
    const inventory=JSON.parse(fs.readFileSync(path.join(root,'.local','preparation-worker','admission','inventory.json'),'utf8'));
    const task=inventory.tasks.find(t=>t.gameId===r.gameId);
    if(task?.status!=='prepared'||task.proofHash!==r.preparationProofHash)throw Error('CAPTURE_READY_REVOKED');
    result=reviewCaptureHandoff(r,p);
    }
   }catch{if(fs.existsSync(dest))continue;result={status:'capture-handoff-input-requires-review',sourceAllowance:0,sourceRequests:0,dispatched:false};}
   const temp=dest+'.tmp',fd=fs.openSync(temp,'wx');fs.writeFileSync(fd,JSON.stringify(result,null,2)+'\n');fs.fsyncSync(fd);fs.closeSync(fd);fs.renameSync(temp,dest);
   console.log(JSON.stringify({at:Date.now(),status:result.status,sourceRequests:0,dispatched:false}));worked=true;
  }
  if(!worked&&!waiting)console.log(JSON.stringify({at:Date.now(),status:'waiting-ready-inventory',sourceRequests:0}));waiting=!worked;
  if(process.argv.includes('--once'))break;await new Promise(resolve=>setTimeout(resolve,5000));
 }while(!stop);
}finally{fs.closeSync(lock);fs.unlinkSync(lockPath);}
