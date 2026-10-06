import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {assertOrdinaryPrivatePipes} from './sg-ag-ordinary-private-pipes.mjs';
import {ordinaryChildEnvironment,rejectOrdinaryCredentialEnvironment} from './sg-ag-ordinary-memory-ssh.mjs';

const directory=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(directory,'../../..');
const entry=path.join(directory,'sg-ag-ordinary-private-entry.mjs');
const attemptedActors=new Set();
const stop=()=>Error('SG_AG_ORDINARY_INHERITED_LAUNCHER_STOP_NO_RETRY');
export const ordinaryInheritedLauncherStatus=Object.freeze({
 schema:'sg-ag-ordinary-inherited-launcher-status-v1',enabled:false,
 approvedPrivateParentBound:false,createsPrivatePipes:false,createsEvidenceDirectory:false,
 createsGrant:false,productionWalkthroughCompleted:false,newContinuationAllowed:false,sourceAllowance:0
});
export function ordinaryEntryEnvironment(env){
 rejectOrdinaryCredentialEnvironment(env);
 const publicNames=['GITHUB_ACTIONS','RUNNER_OS','RUNNER_ENVIRONMENT','GITHUB_REPOSITORY','GITHUB_REF',
  'GITHUB_JOB','GITHUB_RUN_ATTEMPT','GITHUB_RUN_ID','GITHUB_SHA'];
 return {...ordinaryChildEnvironment(env),...Object.fromEntries(publicNames.filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]))};
}

// This is an inheriting launcher, not a credential/evidence supplier. FD0 and
// FD3 must already be approved anonymous read pipes; FD4 must already be the
// approved open directory. Neither input pipe is consumed by this parent.
// The child validates the entire protected descriptor, runtime and own Linux
// proof before credentials or production clients are used. Its runtime
// manifest also includes this launcher. No source or resume is dispatched.
export async function launchInheritedOrdinaryEntry({environment=process.env}={},dependencies={}){
 let child,closed=false,failed=false,terminating=false,killTimer;
 const signals=dependencies.signals??process;
 const schedule=dependencies.setTimer??setTimeout;
 const cancel=dependencies.clearTimer??clearTimeout;
 let onSignal,onError;
 try{
  rejectOrdinaryCredentialEnvironment(environment);
  const identity=(dependencies.admit??(({env})=>assertOrdinaryPrivatePipes({env})))({env:environment});
  const actor=identity.actorRun+'|'+identity.actorCommit;
  assert(!attemptedActors.has(actor),'SG_AG_ORDINARY_ACTOR_LAUNCH_ALREADY_CONSUMED');
  attemptedActors.add(actor);
  child=(dependencies.spawn??spawn)(process.execPath,[entry,'--protected'],{
   cwd:root,env:ordinaryEntryEnvironment(environment),stdio:[0,'ignore','ignore',3,4],windowsHide:true
  });
  const terminate=()=>{
   failed=true;
   if(!closed&&!terminating&&child.pid!==undefined&&child.exitCode===null){
    terminating=true;
    try{child.kill('SIGTERM');}catch{}
    killTimer=schedule(()=>{if(!closed&&child.exitCode===null){try{child.kill('SIGKILL');}catch{}}},5000);
   }
  };
  onSignal=terminate;onError=terminate;signals.on('SIGTERM',onSignal);signals.on('SIGINT',onSignal);
  const result=await new Promise(resolve=>{
   child.on('error',onError);
   // An exit event alone does not prove all child handles have closed.
   child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});
  });
  assert(!failed&&result.code===0&&result.signal===null,'SG_AG_ORDINARY_CHILD_NOT_SUCCESSFULLY_CLOSED');
  // The private child's final durable ACK is authoritative. An exit code
  // creates no new public credit and never unfreezes another window.
  return {schema:'sg-ag-ordinary-inherited-child-close-v1',actorRun:identity.actorRun,
   actorCommit:identity.actorCommit,childExitCode:0,actualChildClosed:true,newContinuationAllowed:false};
 }catch{throw stop();}
 finally{
  if(onSignal){signals.removeListener('SIGTERM',onSignal);signals.removeListener('SIGINT',onSignal);}
  if(onError)child.removeListener('error',onError);
  if(killTimer!==undefined)cancel(killTimer);
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length===3&&process.argv[2]==='--preauth')console.log(JSON.stringify(ordinaryInheritedLauncherStatus));
 else if(process.argv.length===3&&process.argv[2]==='--protected'){
  try{await launchInheritedOrdinaryEntry();}catch{process.stderr.write('SG_AG_ORDINARY_INHERITED_LAUNCHER_STOP_NO_RETRY\n');process.exitCode=2;}
 }else{process.stderr.write('SG_AG_ORDINARY_APPROVED_INHERITED_PARENT_REQUIRED\n');process.exitCode=2;}
}
