import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {repositories} from '../trial/runner-group.mjs';

export function connectGateway({spawnProcess=spawn,pause=ms=>new Promise(r=>setTimeout(r,ms)),ackTimeoutMs=60_000}={}) {
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.equal(process.env.RUNNER_OS,'Linux');
  assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
  assert(repositories[process.env.GITHUB_REPOSITORY]);
  const {SG_SSH_KEY_FILE:key,SG_SSH_HOSTS_FILE:hosts,SG_SSH_HOST:host}=process.env;
  assert(key && hosts && host);
  const args=['-T','-i',key,'-o','IdentityAgent=none','-o','IdentitiesOnly=yes',
    '-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${hosts}`,
    '-o','ConnectTimeout=15','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2',`sgcapture@${host}`];
  let child,pending=null,closed=false,disposed=false,busy=false,entry=true,buffer=Buffer.alloc(0);
  const metrics={requests:0,elapsedMs:0,initialReadReconnects:0,byOperation:{}};
  const error=code=>Object.assign(new Error(code),{code});
  function reject(code){if(pending){clearTimeout(pending.timer);pending.reject(error(code));pending=null;}}
  function open(){
  const session=spawnProcess('ssh',args,{stdio:['pipe','pipe','pipe']});child=session;closed=false;buffer=Buffer.alloc(0);
  const disconnect=()=>{if(child===session){closed=true;reject('GATEWAY_DISCONNECTED');}};
  session.stderr.on('data',()=>{});
  session.on('error',disconnect);session.on('close',disconnect);session.stdin.on('error',disconnect);
  session.stdout.on('data',chunk=>{
    if(child!==session||disposed)return;
    buffer=Buffer.concat([buffer,chunk]);
    if(buffer.length>16*1024*1024){reject('GATEWAY_RESPONSE_TOO_LARGE');child.kill();return;}
    const end=buffer.indexOf(10);if(end<0)return;
    const line=buffer.subarray(0,end);buffer=buffer.subarray(end+1);
    if(!pending)return;
    let response;try{response=JSON.parse(line);}catch{reject('GATEWAY_RESPONSE_INVALID');return;}
    if(!response.ok){reject(/^[A-Z_]{1,80}$/.test(response.error)?response.error:'GATEWAY_REJECTED');return;}
    const p=pending;pending=null;clearTimeout(p.timer);
    metrics.byOperation[p.op].responseBytes=(metrics.byOperation[p.op].responseBytes??0)+Buffer.byteLength(line,'utf8');
    const ms=performance.now()-p.started;metrics.elapsedMs+=ms;metrics.byOperation[p.op].elapsedMs+=ms;
    p.resolve(response.result);
  });
  }
  open();
  async function once(op,input){
    if(closed)throw error('GATEWAY_DISCONNECTED');
    metrics.requests++;metrics.byOperation[op]??={requests:0,elapsedMs:0};metrics.byOperation[op].requests++;
    return new Promise((resolve,rejectPromise)=>{
      pending={resolve,reject:rejectPromise,op,started:performance.now(),timer:setTimeout(()=>{
        reject('GATEWAY_ACK_UNKNOWN');closed=true;child.kill();
      },ackTimeoutMs)};
      child.stdin.write(input);
    });
  }
  return {async request(op,fields={}){
    assert(!busy,'Concurrent gateway requests forbidden');
    if(disposed)throw error('GATEWAY_CLOSED');
    assert(!Object.hasOwn(fields,'op')&&!Object.hasOwn(fields,'schema'),'Gateway operation override forbidden');
    const input=JSON.stringify({schema:'sg-mongo-only-v2',op,...fields})+'\n';
    assert(Buffer.byteLength(input)<=8*1024*1024);
    // Recover only the initial pure read. A successful response or any other
    // operation permanently ends recovery; writes and unknown ACKs never retry.
    const recover=entry&&op==='read';entry=false;busy=true;
    try{
      for(let attempt=0;;attempt++){
        try{return await once(op,input);}catch(e){
          if(!recover||attempt>=2||e.code!=='GATEWAY_DISCONNECTED'||disposed)throw e;
          const previous=child;child=null;previous.kill();
          metrics.initialReadReconnects++;await pause(250);
          if(disposed)throw error('GATEWAY_CLOSED');
          open();
        }
      }
    }finally{busy=false;}
  },metrics:()=>structuredClone(metrics),close(){disposed=true;closed=true;reject('GATEWAY_CLOSED');child?.stdin.end();child?.kill();}};
}
