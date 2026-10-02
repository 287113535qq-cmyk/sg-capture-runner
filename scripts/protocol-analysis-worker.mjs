import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {observeProtocolTask} from './runner-v2/protocol-analysis-task.mjs';
import {analyzeConfirmedTask} from './runner-v2/confirmed-analysis-task.mjs';
import {analyzer} from './runner-v2/analyzer.mjs';
import {protocolHash as hash} from './runner-v2/protocol-resume.mjs';
import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'.local','protocol-analysis-worker');
fs.mkdirSync(path.join(dir,'inbox'),{recursive:true});fs.mkdirSync(path.join(dir,'results'),{recursive:true});
fs.mkdirSync(path.join(dir,'annotations'),{recursive:true});
const identity=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true});
if(identity.status!==0||! /^[a-f0-9]{40}$/.test(identity.stdout.trim()))throw Error('ANALYSIS_RUNTIME_REQUIRED');
const commit=identity.stdout.trim();let parser,prepare;
const annotation={create:async(c,k,value)=>{
 if(c!=='journal')throw Error('ANALYSIS_JOURNAL_SCOPE');
 const file=path.join(dir,'annotations',hash(k)+'.json');
 if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file,'utf8'));if(old.key!==k||hash(old.value)!==hash(value))throw Error('ANALYSIS_ANNOTATION_CHANGED');return;}
 const temp=file+'.tmp',fd=fs.openSync(temp,'wx');fs.writeFileSync(fd,JSON.stringify({key:k,value}));fs.fsyncSync(fd);fs.closeSync(fd);fs.renameSync(temp,file);
},get:async(c,k)=>{
 if(c!=='journal')throw Error('ANALYSIS_JOURNAL_SCOPE');const file=path.join(dir,'annotations',hash(k)+'.json');
 if(!fs.existsSync(file))return null;const old=JSON.parse(fs.readFileSync(file,'utf8'));if(old.key!==k)throw Error('ANALYSIS_ANNOTATION_CHANGED');return {value:old.value};
}};
const lockPath=path.join(dir,'producer.lock'),lock=fs.openSync(lockPath,'wx');fs.writeFileSync(lock,JSON.stringify({pid:process.pid}));
let stop=false,waiting=false;process.on('SIGINT',()=>{stop=true;});process.on('SIGTERM',()=>{stop=true;});
try{
 do{
  let worked=false;
  for(const name of fs.readdirSync(path.join(dir,'inbox')).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){
   let task;try{task=JSON.parse(fs.readFileSync(path.join(dir,'inbox',name),'utf8'));if(hash(task)+'.json'!==name)throw Error('ANALYSIS_INPUT_HASH');}catch{continue;}
   const confirmed=task.schema==='sg-confirmed-round-analysis-task-v1';
   const dest=path.join(dir,'results',confirmed?hash([name,commit])+'.json':name);if(fs.existsSync(dest))continue;
   const claim=dest+'.claim';
   // A previous interrupted analysis remains an explicit review item.
   if(fs.existsSync(claim))continue;
   const fd=fs.openSync(claim,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid,at:Date.now()}));fs.fsyncSync(fd);fs.closeSync(fd);
   let result;
   try{
    if(confirmed){
     const bundled=process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'Programs','Python','Python314','python.exe'):null;
     parser??=analyzer({python:process.env.PYTHON||(bundled&&fs.existsSync(bundled)?bundled:'python3'),env:{...process.env,PYTHONUTF8:'1'}});
     result=await analyzeConfirmedTask({task,store:annotation,parser,commit,independentReview:async(raw,_plan,classified)=>{
      if(!prepare){const require=createRequire(import.meta.url);require('../collector/node_modules/ts-node').register({project:path.join(root,'collector','tsconfig.json'),transpileOnly:true});prepare=require('../collector/sg.ingest.ts').prepareNextgenRound;}
      return prepare(raw,{buy:0,bonus:classified.bonus,typeMappingHash:classified.typeMappingHash});
     }});
    }else result=observeProtocolTask(task);
   }
   catch{parser?.close();parser=null;result={status:'analysis-input-requires-review',captureAuthorization:false,sourceAllowance:0};}
   const temp=dest+'.tmp',out=fs.openSync(temp,'wx');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');fs.fsyncSync(out);fs.closeSync(out);fs.renameSync(temp,dest);
   console.log(JSON.stringify({at:Date.now(),gameId:result.gameId??null,status:result.status,sourceAllowance:0}));worked=true;
  }
  if(!worked&&!waiting)console.log(JSON.stringify({at:Date.now(),status:'waiting-confirmed-evidence',sourceAllowance:0}));
  waiting=!worked;if(process.argv.includes('--once'))break;
  await new Promise(resolve=>setTimeout(resolve,5000));
 }while(!stop);
}finally{parser?.close();fs.closeSync(lock);fs.unlinkSync(lockPath);}
