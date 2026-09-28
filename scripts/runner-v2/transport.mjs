import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {repositories} from '../trial/runner-group.mjs';

export function connectGateway() {
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.equal(process.env.RUNNER_OS,'Linux');
  assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
  assert(repositories[process.env.GITHUB_REPOSITORY]);
  const {SG_SSH_KEY_FILE:key,SG_SSH_HOSTS_FILE:hosts,SG_SSH_HOST:host}=process.env;
  assert(key && hosts && host);
  const child=spawn('ssh',['-T','-i',key,'-o','IdentityAgent=none','-o','IdentitiesOnly=yes',
    '-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${hosts}`,
    '-o','ConnectTimeout=15','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2',`sgcapture@${host}`],
    {stdio:['pipe','pipe','pipe']});
  let pending=null,closed=false,buffer=Buffer.alloc(0);
  const metrics={requests:0,elapsedMs:0,byOperation:{}};
  const error=code=>Object.assign(new Error(code),{code});
  function reject(code){if(pending){clearTimeout(pending.timer);pending.reject(error(code));pending=null;}}
  child.stderr.on('data',()=>{});
  child.on('error',()=>{closed=true;reject('GATEWAY_DISCONNECTED');});
  child.on('close',()=>{closed=true;reject('GATEWAY_DISCONNECTED');});
  child.stdin.on('error',()=>{closed=true;reject('GATEWAY_DISCONNECTED');});
  child.stdout.on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    if(buffer.length>16*1024*1024){reject('GATEWAY_RESPONSE_TOO_LARGE');child.kill();return;}
    const end=buffer.indexOf(10);if(end<0)return;
    const line=buffer.subarray(0,end);buffer=buffer.subarray(end+1);
    if(!pending)return;
    let response;try{response=JSON.parse(line);}catch{reject('GATEWAY_RESPONSE_INVALID');return;}
    if(!response.ok){reject(/^[A-Z_]{1,80}$/.test(response.error)?response.error:'GATEWAY_REJECTED');return;}
    const p=pending;pending=null;clearTimeout(p.timer);
    const ms=performance.now()-p.started;metrics.elapsedMs+=ms;metrics.byOperation[p.op].elapsedMs+=ms;
    p.resolve(response.result);
  });
  return {async request(op,fields={}){
    assert(!pending,'Concurrent gateway requests forbidden');
    if(closed)throw error('GATEWAY_DISCONNECTED');
    const input=JSON.stringify({schema:'sg-mongo-only-v2',op,...fields})+'\n';
    assert(Buffer.byteLength(input)<=8*1024*1024);
    metrics.requests++;metrics.byOperation[op]??={requests:0,elapsedMs:0};metrics.byOperation[op].requests++;
    return new Promise((resolve,rejectPromise)=>{
      pending={resolve,reject:rejectPromise,op,started:performance.now(),timer:setTimeout(()=>{
        reject('GATEWAY_ACK_UNKNOWN');closed=true;child.kill();
      },60_000)};
      child.stdin.write(input);
    });
  },metrics:()=>structuredClone(metrics),close(){closed=true;reject('GATEWAY_CLOSED');child.stdin.end();child.kill();}};
}
