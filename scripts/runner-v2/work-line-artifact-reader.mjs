import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {evidenceOrigin,receiveSealedEvidence} from './work-line-evidence-delivery.mjs';
import {publishImmutableInbox} from './work-line-mailbox.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
const exec=promisify(execFile),repos=['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner'];
// GET-only artifact consumer. There is deliberately no workflow dispatch,
// source switch, capture client, quota mutation or database write here.
export async function readWorkLineArtifacts(root,{execute=exec}={}){
 const child=await execute(process.execPath,['scripts/runner-v2/work-line-artifact-executor.mjs'],{
  cwd:root,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024,windowsHide:true});
 const result=JSON.parse(child.stdout);
 assert(result.sourceRequests===0&&result.mongoWrites===0&&/^evidence-[a-z-]+$/.test(result.status),
  'EVIDENCE_EXECUTOR_BOUNDARY');
 return result;
}

// Each bounded tick imports the current reviewed validators in a fresh child.
// A long-lived handoff process cannot retain an obsolete preparation contract.
export async function readWorkLineArtifactsCurrent(root){
 const dir=path.join(root,'.local','work-line-evidence'),keyPath=path.join(dir,'private-key.pem');
 if(!fs.existsSync(keyPath))return {status:'evidence-recipient-unavailable',sourceRequests:0,mongoWrites:0};
 const gh=process.env.SG_GH_EXECUTABLE||'C:/Users/xxx/.codex/tools/github-cli/2.101.0/bin/gh.exe';
 const python=process.env.SG_EVIDENCE_PYTHON||'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe';
 const env={...process.env,HTTPS_PROXY:'http://127.0.0.1:10090',HTTP_PROXY:'http://127.0.0.1:10090',NO_PROXY:'',GODEBUG:'http2client=0',PYTHONUTF8:'1'};
 const api=async endpoint=>(await exec(gh,['api',endpoint],{cwd:root,env,encoding:'buffer',timeout:30000,maxBuffer:32*1024*1024})).stdout;
 const json=async endpoint=>JSON.parse((await api(endpoint)).toString('utf8'));
 const receipts=path.join(dir,'receipts');fs.mkdirSync(receipts,{recursive:true});let delivered=0;const errors=[],runMetadata=new Map();
 for(const repository of repos){
  let page=1,pageBound=1;
  for(;;page++){
   assert(page<=pageBound,'EVIDENCE_PAGINATION_BOUND');
   const listing=await json(`repos/${repository}/actions/artifacts?per_page=100&page=${page}`);
   assert(Number.isSafeInteger(listing.total_count)&&listing.total_count>=0&&listing.total_count<=100000,'EVIDENCE_ARTIFACT_COUNT_BOUND');
   pageBound=Math.max(pageBound,Math.ceil(listing.total_count/100)+1);
   for(const artifact of listing.artifacts){
    if(!/^sg-work-line-[0-9]+-[0-9]+-[a-z0-9-]+$/.test(artifact.name)||artifact.expired)continue;
    const identity=repository.split('/')[0]+'-'+artifact.id,done=path.join(receipts,identity+'.json');
    try{
    if(fs.existsSync(done)){
     const old=JSON.parse(fs.readFileSync(done,'utf8'));
     assert(old.artifactId===artifact.id&&old.repository===repository
       &&fs.existsSync(path.join(receipts,hash(old)+'.json')),'EVIDENCE_RECEIPT_CHANGED');continue;
    }
    assert(Number.isSafeInteger(artifact.id)&&artifact.size_in_bytes<=32*1024*1024,'EVIDENCE_ARTIFACT_SIZE');
    const runKey=repository+':'+artifact.workflow_run.id;
    if(!runMetadata.has(runKey))runMetadata.set(runKey,await json(`repos/${repository}/actions/runs/${artifact.workflow_run.id}`));
    const origin=evidenceOrigin(runMetadata.get(runKey),repository);
    assert(artifact.name.startsWith(`sg-work-line-${origin.runId}-${origin.attempt}-`)
      &&artifact.workflow_run.head_sha===origin.commit,'EVIDENCE_ARTIFACT_RUN');
    // A commit absent from this checkout cannot silently introduce a new
    // producer contract. Wait for reviewed source synchronization instead.
    await exec('git',['merge-base','--is-ancestor',origin.commit,'HEAD'],{cwd:root,timeout:10000});
    const zip=await api(`repos/${repository}/actions/artifacts/${artifact.id}/zip`);
    if(artifact.digest)assert(artifact.digest==='sha256:'+createHash('sha256').update(zip).digest('hex'),'EVIDENCE_ARTIFACT_DIGEST');
    const zipPath=path.join(dir,identity+'.zip');fs.writeFileSync(zipPath,zip,{flag:'w'});
    // Never extract arbitrary paths. Only ciphertext JSON is read into memory.
    const py='import zipfile,json,sys\nz=zipfile.ZipFile(sys.argv[1]);f=z.infolist()\nassert 0<len(f)<=100 and sum(x.file_size for x in f)<=32*1024*1024\nassert all(not x.is_dir() and x.filename.endswith(".json") and not x.filename.startswith("/") and ".." not in x.filename.split("/") for x in f)\nprint(json.dumps([json.loads(z.read(x)) for x in f]))';
    const extracted=JSON.parse((await exec(python,['-B','-c',py,zipPath],{cwd:root,env,timeout:30000,maxBuffer:32*1024*1024})).stdout);
    const privateKey=fs.readFileSync(keyPath,'utf8');
    const results=extracted.map(sealed=>receiveSealedEvidence({root,sealed,privateKey,origin}));
    // Immutable receipt is written only after every task has reached a durable
    // inbox. A crash repeats idempotent delivery, never source requests.
    const result={schema:'sg-work-line-artifact-receipt-v1',artifactId:artifact.id,repository,origin,results,sourceRequests:0,mongoWrites:0};
    publishImmutableInbox(receipts,result);
    const temp=done+'.tmp',fd=fs.openSync(temp,'wx');
    try{fs.writeFileSync(fd,JSON.stringify(result));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temp,done);delivered+=results.reduce((n,r)=>n+r.tasks,0);
    }catch(error){errors.push({artifactId:artifact.id,repository,reason:error.code||'EVIDENCE_REQUIRES_REVIEW'});}
   }
   if(listing.artifacts.length<100)break;
  }
 }
 return {status:errors.length?'evidence-artifacts-partial-review':'evidence-artifacts-read',delivered,errors,sourceRequests:0,mongoWrites:0};
}
