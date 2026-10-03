import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {protocolHash as hash} from './runner-v2/protocol-resume.mjs';
import {reviewCaptureHandoff} from './runner-v2/capture-handoff.mjs';
import {deliverCaptureFault} from './runner-v2/capture-fault-delivery.mjs';
import {deliverConfirmedAnalysis} from './runner-v2/confirmed-analysis-task.mjs';
import {readWorkLineArtifacts} from './runner-v2/work-line-artifact-reader.mjs';
import {reviewPreparedPublicationHandoff} from './runner-v2/prepared-publication-handoff.mjs';
// Local handoff plus GET-only encrypted evidence delivery. No source client or
// dispatch authority. Online consumer revalidates every preparation gate.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'.local','capture-handoff-worker');
fs.mkdirSync(path.join(dir,'inbox'),{recursive:true});fs.mkdirSync(path.join(dir,'results'),{recursive:true});
const lockPath=path.join(dir,'producer.lock'),lock=fs.openSync(lockPath,'wx');fs.writeFileSync(lock,JSON.stringify({pid:process.pid}));
let stop=false,waiting=false,nextEvidenceRead=0;process.on('SIGINT',()=>{stop=true;});process.on('SIGTERM',()=>{stop=true;});
try{
 do{
  let worked=false;
  if(Date.now()>=nextEvidenceRead){
   nextEvidenceRead=Date.now()+60000;
   try{const r=await readWorkLineArtifacts(root);if(r.delivered||r.errors?.length)console.log(JSON.stringify({at:Date.now(),...r}));}
   catch(error){console.log(JSON.stringify({at:Date.now(),status:'evidence-read-requires-review',reason:error.code||error.message?.split('\n')[0],sourceRequests:0}));}
  }
  for(const name of fs.readdirSync(path.join(dir,'inbox')).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){
   const dest=path.join(dir,'results',name);if(fs.existsSync(dest))continue;
   let result;
   try{
    const r=JSON.parse(fs.readFileSync(path.join(dir,'inbox',name),'utf8'));
    if(hash(r)+'.json'!==name)throw Error('CAPTURE_READY_SCOPE');
    if(r.schema==='sg-capture-prepared-publication-v1'){
      const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
      result=await reviewPreparedPublicationHandoff({task:r,
        currentCycleHash:read('.local/preparation-worker/publication/current.json').cycleHash,
        inventory:read('.local/preparation-worker/admission/inventory.json'),
        plans:read('config/round-one-plans.json'),registry:read('config/preparation-plan-bindings.json'),
        countRegistry:read('config/prepared-count-authorizations.json'),
        runtimeRegistry:read('config/prepared-runtime-authorizations.json'),readProfile:read});
    }else if(r.schema==='sg-confirmed-round-analysis-task-v1'){
      result=deliverConfirmedAnalysis(root,r);
    }else if(r.schema==='sg-capture-fault-export-v1'){
      result=deliverCaptureFault(root,r);
    }else{
    if(!/^[a-z0-9][a-z0-9-]*\.json$/.test(r.profile??''))throw Error('CAPTURE_READY_SCOPE');
    const p=JSON.parse(fs.readFileSync(path.join(root,'config',r.profile),'utf8'));
    const inventory=JSON.parse(fs.readFileSync(path.join(root,'.local','preparation-worker','admission','inventory.json'),'utf8'));
    const task=inventory.tasks.find(t=>t.gameId===r.gameId);
    if(task?.status!=='prepared'||task.proofHash!==r.preparationProofHash)throw Error('CAPTURE_READY_REVOKED');
    result=reviewCaptureHandoff(r,p);
    }
   }catch{result={status:'capture-handoff-input-requires-review',sourceAllowance:0,sourceRequests:0,dispatched:false};}
   const temp=dest+'.tmp',fd=fs.openSync(temp,'wx');fs.writeFileSync(fd,JSON.stringify(result,null,2)+'\n');fs.fsyncSync(fd);fs.closeSync(fd);fs.renameSync(temp,dest);
   console.log(JSON.stringify({at:Date.now(),status:result.status,sourceRequests:0,dispatched:false}));worked=true;
  }
  if(!worked&&!waiting)console.log(JSON.stringify({at:Date.now(),status:'waiting-ready-inventory',sourceRequests:0}));waiting=!worked;
  if(process.argv.includes('--once'))break;await new Promise(resolve=>setTimeout(resolve,5000));
 }while(!stop);
}finally{fs.closeSync(lock);fs.unlinkSync(lockPath);}
