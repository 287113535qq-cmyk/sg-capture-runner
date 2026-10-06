import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {historicalChildEnvironment,rejectHistoricalCredentialEnvironment} from './sg-historical-starmania-private-pipe.mjs';
import {assertHistoricalProviderConfiguration} from './sg-historical-starmania-provider-channel.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url));
const entries=Object.freeze({sender:'sg-historical-starmania-provider-sender.mjs','fixed-io':'sg-historical-starmania-provider-fixed-io.mjs'});
const stop=()=>Error('HISTORICAL_PRIVATE_LAUNCHER_STOP_NO_RETRY');
const exact=(v,keys)=>assert(v&&Object.keys(v).sort().join(',')===[...keys].sort().join(','));
export function historicalLauncherConfiguration(execution){
 assert(execution?.schema==='sg-historical-starmania-execution-v1'&&execution.enabled===true&&execution.minimumPermissionApproved===true&&execution.linuxPermissionGranted===true
  &&execution.branch==='sg-business-historical-32737-20261006'&&stable(execution.gameIds)===stable(['32737'])
  &&execution.fixedPrivateIoService?.enabled===true&&execution.privateEvidenceSink?.enabled===true,'HISTORICAL_PRIVATE_LAUNCHER_DISABLED');
 assertHistoricalProviderConfiguration(execution.privateProvider);
 const binding=execution.privateInheritedLauncher;exact(binding,['schema','enabled','context','sender','fixed-io']);
 assert(binding.schema==='sg-historical-private-inherited-launcher-v1'&&binding.enabled===true&&stable(binding.context)===stable(execution.fixedPrivateIoService.context));
 const context=binding.context;exact(context,['gameId','repository','branch','workflow','job','run','commit','linuxRun','manifestSha256']);
 assert(context.gameId===32737&&context.repository==='zyzuoyang/sg-capture-runner'&&context.branch===execution.branch&&context.workflow==='.github/workflows/historical-starmania.yml'
  &&context.job==='ag-rolling-business-delivery'&&/^[1-9]\d*:1$/.test(context.run)&&/^[a-f0-9]{40}$/.test(context.commit)&&/^[1-9]\d*$/.test(context.linuxRun)
  &&context.manifestSha256==='ab41fca9e5cda4025cac3dac7efc995419c4ab0d37a3a27b450b028673d8cedf'&&context.manifestSha256===execution.manifestSha256);
 for(const role of Object.keys(entries)){exact(binding[role],['ownerUid','entrySha256']);assert(Number.isSafeInteger(binding[role].ownerUid)&&binding[role].ownerUid>=0&&/^[a-f0-9]{64}$/.test(binding[role].entrySha256));}
 assert(binding.sender.ownerUid===execution.privateEvidenceSink.ownerUid);return binding;
}
export function assertHistoricalLauncherBinding(execution,context,grant){
 const binding=historicalLauncherConfiguration(execution);
 assert(stable(binding.context)===stable(context)&&stable(grant?.value?.privateInheritedLauncher)===stable({...binding,privateStdinOnly:true,inheritedPipeOnly:true}),'HISTORICAL_PROTECTED_PRIVATE_LAUNCHER_REQUIRED');
 return binding;
}
// Admission examines metadata only. It never reads stdin, a private frame, or a credential.
export function historicalInheritedPipeAdmission({execution,role},dependencies={}){
 try{
  const binding=historicalLauncherConfiguration(execution),io=dependencies.fs??fs,platform=dependencies.platform??process.platform,geteuid=dependencies.geteuid??(()=>process.geteuid());
  assert(Object.hasOwn(entries,role)&&platform==='linux'&&geteuid()===binding[role].ownerUid);
  const identities=new Set();
  for(const [fd,direction] of [[0,0],[3,0],[4,1]]){
   const stat=io.fstatSync(fd);assert(stat.isFIFO()&&stat.uid===binding[role].ownerUid&&(stat.mode&0o777)===0o600&&Number.isSafeInteger(stat.ino)&&stat.ino>0);
   const identity=stat.dev+':'+stat.ino;assert(!identities.has(identity));identities.add(identity);
   assert(io.readlinkSync('/proc/self/fd/'+fd)==='pipe:['+stat.ino+']');
   const info=io.readFileSync('/proc/self/fdinfo/'+fd,'utf8');assert(typeof info==='string'&&info.length<4096);
   const flags=info.match(/^flags:\s+([0-7]+)$/m),inode=info.match(/^ino:\s+(\d+)$/m);
   assert(flags&&inode&&Number(inode[1])===stat.ino&&(parseInt(flags[1],8)&3)===direction);
  }
  const entry=path.join(directory,entries[role]);const handle=io.openSync(entry,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{assert(io.fstatSync(handle).isFile());assert(createHash('sha256').update(io.readFileSync(handle)).digest('hex')===binding[role].entrySha256);}finally{io.closeSync(handle);}
  return entry;
 }catch{throw stop();}
}
// An already approved OS pipe pair must be inherited. This launcher creates no account,
// SSH channel, TLS service configuration, source job, dispatcher, or grant.
export async function launchHistoricalPrivateRuntime({execution,role,environment=process.env},dependencies={}){
 let child,timer,killTimer;let failed=false,terminationStarted=false,closed=false;
 try{
  rejectHistoricalCredentialEnvironment(environment);
  const entry=(dependencies.admit??historicalInheritedPipeAdmission)({execution,role});
  const publicEnvironment=historicalChildEnvironment(environment);
  child=(dependencies.spawn??spawn)(process.execPath,[entry],{cwd:path.resolve(directory,'../../..'),env:publicEnvironment,stdio:[0,'ignore','ignore',3,4],windowsHide:true});
  const terminate=()=>{failed=true;if(!closed&&!terminationStarted&&child.exitCode===null){terminationStarted=true;child.kill('SIGTERM');killTimer=setTimeout(()=>{if(!closed&&child.exitCode===null)child.kill('SIGKILL');},5000);}};
  const onSignal=()=>terminate();process.once('SIGTERM',onSignal);process.once('SIGINT',onSignal);
  try{
   timer=(dependencies.setTimer??setTimeout)(terminate,330*60000);
   const result=await new Promise(resolve=>{child.once('error',()=>{failed=true;if(child.pid!==undefined)terminate();});child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});
   assert(!failed&&result.code===0&&result.signal===null);return true;
  }finally{process.removeListener('SIGTERM',onSignal);process.removeListener('SIGINT',onSignal);}
 }catch{if(!closed&&!terminationStarted&&child?.exitCode===null)child.kill('SIGTERM');throw stop();}
 finally{clearTimeout(timer);clearTimeout(killTimer);}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])){
 let entered=false;
 try{assert(process.argv.length===3&&Object.hasOwn(entries,process.argv[2]));const execution=JSON.parse(fs.readFileSync('config/ag-historical-starmania-execution.json'));
  historicalLauncherConfiguration(execution);entered=true;await launchHistoricalPrivateRuntime({execution,role:process.argv[2]});}
 catch{process.stderr.write(entered?'HISTORICAL_PRIVATE_LAUNCHER_STOP_NO_RETRY\n':'HISTORICAL_PRIVATE_LAUNCHER_DISABLED_NO_INPUT_OR_NETWORK\n');process.exitCode=2;}
}
