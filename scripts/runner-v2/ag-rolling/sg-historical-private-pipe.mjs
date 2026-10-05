import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createHash} from 'node:crypto';import {spawn,execFileSync} from 'node:child_process';
import {parseHistoricalPrivateCredentials} from './sg-historical-labomba-actor.mjs';

export const PINNED_HOST='SHA256:HdDkyDW2SD2z5VuPVhhNHV7jD814nPh1jOUiWGBFZHA';
export function historicalChildEnvironment(env){
 return Object.fromEntries(['PATH','HOME','TMPDIR','TEMP','LANG','LC_ALL'].filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));
}
const privateKeys=['password','ghToken','nativeSshPrivateKey','historicalSshPrivateKey'];
const fingerprint=v=>typeof v==='string'&&/^SHA256:[A-Za-z0-9+/]{43}$/.test(v);
export function rejectHistoricalCredentialEnvironment(env){
 for(const name of ['GH_TOKEN','GITHUB_TOKEN','SG_BUSINESS_MONGO_PASSWORD','SG_HISTORICAL_32723_MONGO_PASSWORD',
  'SG_SSH_PRIVATE_KEY','SG_BUSINESS_SSH_PRIVATE_KEY','SG_HISTORICAL_SSH_PRIVATE_KEY'])
  assert(env[name]===undefined,'HISTORICAL_PRIVATE_PIPE_REQUIRED');
}
export function parseHistoricalPrivateEnvelope(bytes,env){
 const fail=()=>{throw Error('HISTORICAL_PRIVATE_ENVELOPE_REJECTED');};
 if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>=131072)fail();
 let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{fail();}
 if(!value||Object.keys(value).sort().join(',')!==['schema','gameId','run','commit',...privateKeys].sort().join(',')
  ||value.schema!=='sg-historical-private-pipe-v1'||value.gameId!==32723
  ||value.run!==env.GITHUB_RUN_ID+':1'||value.commit!==env.GITHUB_SHA)fail();
 try{parseHistoricalPrivateCredentials(Buffer.from(JSON.stringify({password:value.password,ghToken:value.ghToken})));}catch{fail();}
 for(const name of privateKeys.slice(2))if(typeof value[name]!=='string'||value[name].length>32768
  ||!/^-----BEGIN OPENSSH PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END OPENSSH PRIVATE KEY-----\r?\n?$/.test(value[name]))fail();
 return value;
}
export function receiveHistoricalPrivatePipe({stream=process.stdin,env=process.env,timeoutMs=60000}={}){
 rejectHistoricalCredentialEnvironment(env);let chunks=[],length=0;
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);stream.removeListener('data',data);stream.removeListener('end',end);stream.removeListener('error',fail);
   for(const part of chunks)part.fill(0);chunks=[];};
  const fail=()=>{cleanup();stream.destroy();reject(Error('HISTORICAL_PRIVATE_PIPE_STOP_NO_RETRY'));};
  const data=part=>{const bytes=Buffer.from(part);length+=bytes.length;chunks.push(bytes);if(length>=131072)fail();};
  const end=()=>{const bytes=Buffer.concat(chunks);let value;try{value=parseHistoricalPrivateEnvelope(bytes,env);}catch{bytes.fill(0);fail();return;}
   bytes.fill(0);cleanup();resolve(value);};
  const timer=setTimeout(fail,timeoutMs);stream.on('data',data);stream.once('end',end);stream.once('error',fail);stream.resume();
 });
}
export function assertHistoricalSshConfiguration(config){
 assert(config?.host==='52.87.94.113'&&config.hostKeyFingerprint===PINNED_HOST
  &&typeof config.knownHostsFile==='string'&&path.isAbsolute(config.knownHostsFile)
  &&/^[a-f0-9]{64}$/.test(config.knownHostsSha256??'')
  &&fingerprint(config.nativeIdentityFingerprint)&&fingerprint(config.historicalIdentityFingerprint)
  &&config.nativeIdentityFingerprint!==config.historicalIdentityFingerprint,'HISTORICAL_OWN_SSH_BINDING_REQUIRED');
 return config;
}
// Agent sockets contain no key file. Each foreground agent receives one identity through ssh-add stdin.
export async function openHistoricalMemoryIdentity({key,role,config,env=process.env,io={}}){
 const files=io.fs??fs,run=io.execFileSync??execFileSync,start=io.spawn??spawn,delay=io.delay??(ms=>new Promise(r=>setTimeout(r,ms)));
 assert(env.RUNNER_OS==='Linux'&&env.RUNNER_ENVIRONMENT==='github-hosted'&&['native','historical'].includes(role),'HISTORICAL_MEMORY_IDENTITY_HOST');
 assertHistoricalSshConfiguration(config);rejectHistoricalCredentialEnvironment(env);
 assert(createHash('sha256').update(files.readFileSync(config.knownHostsFile)).digest('hex')===config.knownHostsSha256,'HISTORICAL_PINNED_HOST_FILE');
 const childEnv=historicalChildEnvironment(env);
 const publicLines=run('ssh-keygen',['-lf',config.knownHostsFile],{env:childEnv,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}).trim().split('\n');
 assert(publicLines.length===1&&publicLines[0].split(/\s+/)[1]===PINNED_HOST,'HISTORICAL_PINNED_HOST_KEY');
 const dir=files.mkdtempSync(path.join(os.tmpdir(),'sg-historical-agent-'));files.chmodSync(dir,0o700);const socket=path.join(dir,'agent.sock');
 const agent=start('ssh-agent',['-D','-a',socket],{env:childEnv,stdio:['ignore','ignore','ignore']});let closed=false,disposed=false;
 agent.on('error',()=>{closed=true;});agent.on('close',()=>{closed=true;});
 const close=()=>{if(disposed)return;disposed=true;closed=true;agent.kill();
  // Only the explicitly created Unix socket and its empty directory are removed; no recursive deletion.
  try{files.unlinkSync(socket);}catch{}try{files.rmdirSync(dir);}catch{}};
 try{
  for(let n=0;!files.existsSync(socket);n++){assert(!closed&&n<50,'HISTORICAL_AGENT_START_FAILED');await delay(100);}
  const agentEnv={...childEnv,SSH_AUTH_SOCK:socket};
  try{run('ssh-add',['-'],{input:key,env:agentEnv,stdio:['pipe','ignore','pipe'],timeout:10000});}
  catch{throw Error('HISTORICAL_AGENT_IDENTITY_REJECTED');}finally{key=null;}
  let listing;try{listing=run('ssh-add',['-l'],{env:agentEnv,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}).trim().split('\n');}
  catch{throw Error('HISTORICAL_AGENT_IDENTITY_REJECTED');}
  const expected=role==='native'?config.nativeIdentityFingerprint:config.historicalIdentityFingerprint;
  assert(listing.length===1&&listing[0].split(/\s+/)[1]===expected,'HISTORICAL_AGENT_IDENTITY_FINGERPRINT');
  const account=role==='native'?'sgcapture':'sghistorical32723';
  return {close,open(command=''){
   assert(!closed&&!disposed&&command===(role==='native'?'':'32723'),'HISTORICAL_SSH_FIXED_COMMAND');
   return start('ssh',['-F','/dev/null','-T','-o','IdentityFile=none','-o','IdentityAgent='+socket,
    '-o','IdentitiesOnly=no','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','-o','ControlMaster=no',
    '-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','GlobalKnownHostsFile=/dev/null',
    '-o','UserKnownHostsFile='+config.knownHostsFile,'-o','ConnectTimeout=10','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2',
    account+'@'+config.host,...(command?[command]:[])],{env:agentEnv,stdio:['pipe','pipe','pipe']});}};
 }catch{close();throw Error('HISTORICAL_MEMORY_IDENTITY_STOP_NO_RETRY');}
}

export async function withHistoricalMemoryIdentities(auth,config,visit,{open=openHistoricalMemoryIdentity}={}){
 let nativeIdentity,historicalIdentity;
 try{
  nativeIdentity=await open({key:auth.nativeSshPrivateKey,role:'native',config});delete auth.nativeSshPrivateKey;
  historicalIdentity=await open({key:auth.historicalSshPrivateKey,role:'historical',config});delete auth.historicalSshPrivateKey;
  return await visit({nativeIdentity,historicalIdentity});
 }catch{throw Error('HISTORICAL_PRIVATE_IDENTITY_OR_ACTOR_STOP_NO_RETRY');}
 finally{delete auth.nativeSshPrivateKey;delete auth.historicalSshPrivateKey;nativeIdentity?.close();historicalIdentity?.close();}
}
export function historicalResourceTransport(identity,{timeoutMs=60000}={}){
 const child=identity.open('');let pending=null,buffer=Buffer.alloc(0),closed=false;
 const stop=code=>{closed=true;if(pending){clearTimeout(pending.timer);pending.reject(Error(code));pending=null;}};
 child.on('error',()=>stop('HISTORICAL_RESOURCE_DISCONNECTED'));child.on('close',()=>stop('HISTORICAL_RESOURCE_DISCONNECTED'));
 child.stdin.on('error',()=>stop('HISTORICAL_RESOURCE_DISCONNECTED'));child.stderr.on('data',()=>{});
 child.stdout.on('data',part=>{buffer=Buffer.concat([buffer,part]);if(buffer.length>16*1024*1024){stop('HISTORICAL_RESOURCE_RESPONSE_REJECTED');child.kill();return;}
  const end=buffer.indexOf(10);if(end<0)return;const line=buffer.subarray(0,end);buffer=buffer.subarray(end+1);
  if(!pending||buffer.length){stop('HISTORICAL_RESOURCE_RESPONSE_REJECTED');child.kill();return;}
  let value;try{value=JSON.parse(line);assert(value.ok===true);}catch{stop('HISTORICAL_RESOURCE_RESPONSE_REJECTED');child.kill();return;}
  const p=pending;pending=null;clearTimeout(p.timer);p.resolve(value.result);});
 return {request(op,fields={}){
  assert(['resources','global_holds'].includes(op)&&Object.keys(fields).length===0,'HISTORICAL_RESOURCE_READ_ONLY');
  assert(!closed&&!pending,'HISTORICAL_RESOURCE_STOP_NO_RETRY');
  return new Promise((resolve,reject)=>{pending={resolve,reject,timer:setTimeout(()=>{stop('HISTORICAL_RESOURCE_READ_UNKNOWN');child.kill();},timeoutMs)};
   child.stdin.write(JSON.stringify({schema:'sg-mongo-only-v2',op})+'\n');});},
  close(){stop('HISTORICAL_RESOURCE_CLOSED');child.stdin.end();child.kill();}};
}
export function historicalRtpHash(identity,{timeoutMs=20000}={}){
 const child=identity.open('32723');child.stdin.end();let bytes=Buffer.alloc(0);
 return new Promise((resolve,reject)=>{let settled=false;const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){child.kill();reject(Error('HISTORICAL_RTP_READ_STOP_NO_RETRY'));}
  else{const text=bytes.toString('utf8');/^[a-f0-9]{64}\r?\n?$/.test(text)?resolve(text.trim()):reject(Error('HISTORICAL_RTP_HASH_REJECTED'));}};
  const timer=setTimeout(()=>finish(true),timeoutMs);child.stdout.on('data',part=>{bytes=Buffer.concat([bytes,part]);if(bytes.length>67)finish(true);});
  child.stderr.on('data',()=>{});child.on('error',()=>finish(true));child.stdin.on('error',()=>finish(true));child.on('close',code=>finish(code!==0));});
}
