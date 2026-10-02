import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {protocolHash as hash} from './runner-v2/protocol-resume.mjs';
// Deliberately local file I/O only. No GitHub client, subprocess, source client,
// credentials or dispatch authority. Online consumer revalidates every gate.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'.local','capture-handoff-worker');
fs.mkdirSync(path.join(dir,'inbox'),{recursive:true});fs.mkdirSync(path.join(dir,'results'),{recursive:true});
const lockPath=path.join(dir,'producer.lock'),lock=fs.openSync(lockPath,'wx');fs.writeFileSync(lock,JSON.stringify({pid:process.pid}));
let stop=false,waiting=false;process.on('SIGINT',()=>{stop=true;});process.on('SIGTERM',()=>{stop=true;});
try{
 do{
  let worked=false;
  for(const name of fs.readdirSync(path.join(dir,'inbox')).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){
   const dest=path.join(dir,'results',name);if(fs.existsSync(dest))continue;
   let result;
   try{
    const r=JSON.parse(fs.readFileSync(path.join(dir,'inbox',name),'utf8'));
    if(hash(r)+'.json'!==name||r.schema!=='sg-capture-ready-handoff-v1'||r.gameId!==32812||r.group!=='secondary'
     ||r.profile!=='demo-pilot-veryfruity-action-revision3-20261003.json')throw Error('CAPTURE_READY_SCOPE');
    const p=JSON.parse(fs.readFileSync(path.join(root,'config',r.profile),'utf8'));
    if(p.generation!==r.generation||hash(p)!==r.profileHash||p.expiresAt<=Date.now())throw Error('CAPTURE_READY_PROFILE_STALE');
    result={schema:'sg-capture-dispatch-task-v1',status:'online-fresh-admission-required',receipt:r,
      workflow:'.github/workflows/trial-300k.yml',inputs:{role:'fresh-short',allocation:'round-one',round_one_limit:'5',pilot_profile:r.profile},
      sourceAllowance:0,sourceRequests:0,dispatched:false};
   }catch{result={status:'capture-handoff-input-requires-review',sourceAllowance:0,sourceRequests:0,dispatched:false};}
   const temp=dest+'.tmp',fd=fs.openSync(temp,'wx');fs.writeFileSync(fd,JSON.stringify(result,null,2)+'\n');fs.fsyncSync(fd);fs.closeSync(fd);fs.renameSync(temp,dest);
   console.log(JSON.stringify({at:Date.now(),status:result.status,sourceRequests:0,dispatched:false}));worked=true;
  }
  if(!worked&&!waiting)console.log(JSON.stringify({at:Date.now(),status:'waiting-ready-inventory',sourceRequests:0}));waiting=!worked;
  if(process.argv.includes('--once'))break;await new Promise(resolve=>setTimeout(resolve,5000));
 }while(!stop);
}finally{fs.closeSync(lock);fs.unlinkSync(lockPath);}
