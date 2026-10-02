import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {observeProtocolTask} from './runner-v2/protocol-analysis-task.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'.local','protocol-analysis-worker');
fs.mkdirSync(path.join(dir,'inbox'),{recursive:true});fs.mkdirSync(path.join(dir,'results'),{recursive:true});
const lockPath=path.join(dir,'producer.lock'),lock=fs.openSync(lockPath,'wx');fs.writeFileSync(lock,JSON.stringify({pid:process.pid}));
let stop=false,waiting=false;process.on('SIGINT',()=>{stop=true;});process.on('SIGTERM',()=>{stop=true;});
try{
 do{
  let worked=false;
  for(const name of fs.readdirSync(path.join(dir,'inbox')).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){
   const dest=path.join(dir,'results',name);if(fs.existsSync(dest))continue;
   const claim=path.join(dir,'results',name+'.claim');
   // A previous interrupted analysis remains an explicit review item.
   if(fs.existsSync(claim))continue;
   const fd=fs.openSync(claim,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid,at:Date.now()}));fs.fsyncSync(fd);fs.closeSync(fd);
   let result;
   try{result=observeProtocolTask(JSON.parse(fs.readFileSync(path.join(dir,'inbox',name),'utf8')));}
   catch{result={status:'analysis-input-requires-review',captureAuthorization:false,sourceAllowance:0};}
   const temp=dest+'.tmp',out=fs.openSync(temp,'wx');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');fs.fsyncSync(out);fs.closeSync(out);fs.renameSync(temp,dest);
   console.log(JSON.stringify({at:Date.now(),gameId:result.gameId??null,status:result.status,sourceAllowance:0}));worked=true;
  }
  if(!worked&&!waiting)console.log(JSON.stringify({at:Date.now(),status:'waiting-confirmed-evidence',sourceAllowance:0}));
  waiting=!worked;if(process.argv.includes('--once'))break;
  await new Promise(resolve=>setTimeout(resolve,5000));
 }while(!stop);
}finally{fs.closeSync(lock);fs.unlinkSync(lockPath);}
