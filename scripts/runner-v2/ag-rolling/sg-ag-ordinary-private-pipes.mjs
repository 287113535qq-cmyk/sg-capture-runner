import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rejectOrdinaryCredentialEnvironment} from './sg-ag-ordinary-memory-ssh.mjs';
export function assertOrdinaryPrivatePipes({env=process.env,io=fs,platform=process.platform,euid=()=>process.geteuid()}={}){
 rejectOrdinaryCredentialEnvironment(env);
 assert(platform==='linux'&&euid()!==0&&env.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Linux'&&env.RUNNER_ENVIRONMENT==='github-hosted'
  &&env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner'&&env.GITHUB_REF==='refs/heads/sg-ag-strict-control-20261006'
  &&env.GITHUB_JOB==='ag-rolling-strict-control'&&env.GITHUB_RUN_ATTEMPT==='1'&&/^\d+$/.test(env.GITHUB_RUN_ID??'')&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''),'SG_AG_ORDINARY_ACTUAL_ENTRY');
 const uid=euid(),ids=[];
 for(const fd of [0,3]){
  const s=io.fstatSync(fd),info=io.readFileSync('/proc/self/fdinfo/'+fd,'utf8'),flags=info.match(/^flags:\s*([0-7]+)$/m),ino=info.match(/^ino:\s*(\d+)$/m);
  assert(s.isFIFO()&&s.uid===uid&&(s.mode&0o777)===0o600&&io.readlinkSync('/proc/self/fd/'+fd)==='pipe:['+s.ino+']'
   &&flags&&(parseInt(flags[1],8)&3)===0&&ino&&ino[1]===String(s.ino),'SG_AG_ORDINARY_ANONYMOUS_READ_PIPE');ids.push(s.dev+':'+s.ino);
 }
 assert(new Set(ids).size===2,'SG_AG_ORDINARY_DISTINCT_PRIVATE_PIPES');
 const dir=io.fstatSync(4);assert(dir.isDirectory()&&dir.uid===uid&&(dir.mode&0o777)===0o700,'SG_AG_ORDINARY_APPROVED_OPEN_DIRECTORY');
 return {uid,directory:{dev:String(dir.dev),ino:String(dir.ino)},actorRun:env.GITHUB_RUN_ID+':1',actorCommit:env.GITHUB_SHA};
}
export function receiveOrdinaryPrivateJson(fd,{io=fs,maxBytes=8*1024*1024,timeoutMs=60000}={}){
 assert([0,3].includes(fd));const stream=io.createReadStream(null,{fd,autoClose:false});let chunks=[],size=0,settled=false;
 return new Promise((resolve,reject)=>{
  const clean=()=>{clearTimeout(timer);stream.removeAllListeners();stream.destroy();for(const b of chunks)b.fill(0);chunks=[];};
  const fail=()=>{if(settled)return;settled=true;clean();reject(Error('SG_AG_ORDINARY_PRIVATE_INPUT_STOP_NO_RETRY'));};
  const timer=setTimeout(fail,timeoutMs);
  stream.on('data',b=>{const part=Buffer.from(b);chunks.push(part);size+=part.length;if(size>=maxBytes)fail();});stream.once('error',fail);
  stream.once('end',()=>{if(settled)return;const bytes=Buffer.concat(chunks);try{assert(bytes.length>0);const value=JSON.parse(bytes.toString('utf8'));settled=true;clean();resolve(value);}catch{fail();}finally{bytes.fill(0);}});
 });
}
export function parseOrdinaryCredentials(value,identity){
 assert(value&&Object.keys(value).sort().join(',')==='actorCommit,actorRun,businessSshPrivateKey,evidenceKey,ghToken,nativeSshPrivateKey,password,schema'
  &&value.schema==='sg-ag-ordinary-private-credentials-v1'&&value.actorRun===identity.actorRun&&value.actorCommit===identity.actorCommit,'SG_AG_ORDINARY_PRIVATE_IDENTITY');
 assert(typeof value.password==='string'&&value.password.length>=1&&value.password.length<=4096&&typeof value.ghToken==='string'&&value.ghToken.length>=1&&value.ghToken.length<=4096,'SG_AG_ORDINARY_PRIVATE_CREDENTIALS');
 for(const k of ['nativeSshPrivateKey','businessSshPrivateKey'])assert(typeof value[k]==='string'&&value[k].length<=32768&&/^-----BEGIN OPENSSH PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END OPENSSH PRIVATE KEY-----\r?\n?$/.test(value[k]),'SG_AG_ORDINARY_PRIVATE_SSH_KEY');
 const key=Buffer.from(value.evidenceKey,'base64');assert(key.length===32&&key.toString('base64')===value.evidenceKey,'SG_AG_ORDINARY_MEMORY_EVIDENCE_KEY');delete value.evidenceKey;
 return {...value,evidenceKey:key};
}
