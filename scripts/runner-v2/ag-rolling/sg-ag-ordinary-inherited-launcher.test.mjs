import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {launchInheritedOrdinaryEntry,ordinaryEntryEnvironment} from './sg-ag-ordinary-inherited-launcher.mjs';
import {requiredOrdinaryRuntimeFiles} from './sg-ag-ordinary-private-entry.mjs';

const env={GITHUB_ACTIONS:'true',RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',
 GITHUB_REPOSITORY:'zyzuoyang/sg-capture-runner',GITHUB_REF:'refs/heads/sg-ag-strict-control-20261006',
 GITHUB_JOB:'ag-rolling-strict-control',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'8000',GITHUB_SHA:'a'.repeat(40),
 PATH:process.env.PATH,UNREVIEWED_SECRET:'synthetic',SSH_AUTH_SOCK:'foreign-socket',ACTIONS_RUNTIME_TOKEN:'synthetic'};
let serial=8000;
function fixture(){
 const child=new EventEmitter(),signals=new EventEmitter(),timers=[];let starts=0,captured;
 child.pid=123;child.exitCode=null;child.kills=[];child.kill=signal=>{child.kills.push(signal);return true;};
 const identity={actorRun:String(++serial)+':1',actorCommit:env.GITHUB_SHA,uid:1001,directory:{dev:'1',ino:String(serial)}};
 const dependencies={admit:()=>identity,signals,spawn:(...args)=>{starts++;captured=args;return child;},
  setTimer:(f,ms)=>{const t={f,ms,cancelled:false};timers.push(t);return t;},clearTimer:t=>{t.cancelled=true;}};
 return {child,signals,timers,identity,dependencies,start:()=>launchInheritedOrdinaryEntry({environment:{...env,GITHUB_RUN_ID:identity.actorRun.split(':')[0]}},dependencies),starts:()=>starts,captured:()=>captured};
}
test('inherited launcher preauth stays disabled without input; Windows protected launch refuses before child startup',()=>{
 const file='scripts/runner-v2/ag-rolling/sg-ag-ordinary-inherited-launcher.mjs';
 const pre=spawnSync(process.execPath,[file,'--preauth'],{encoding:'utf8'});assert.equal(pre.status,0);
 const status=JSON.parse(pre.stdout);assert.equal(status.enabled,false);assert.equal(status.createsPrivatePipes,false);assert.equal(status.newContinuationAllowed,false);
 if(process.platform!=='linux'){
  const r=spawnSync(process.execPath,[file,'--protected'],{input:'synthetic-not-to-be-read',env:{...process.env,...env},encoding:'utf8'});
  assert.equal(r.status,2);assert.equal(r.stdout,'');assert.match(r.stderr,/STOP_NO_RETRY/);
 }
});
test('launcher propagates only public actual actor identity and excludes tokens, secrets and a foreign SSH agent',()=>{
 const actual=ordinaryEntryEnvironment(env);assert.equal(actual.GITHUB_JOB,env.GITHUB_JOB);assert.equal(actual.GITHUB_SHA,env.GITHUB_SHA);
 for(const name of ['UNREVIEWED_SECRET','SSH_AUTH_SOCK','ACTIONS_RUNTIME_TOKEN'])assert.equal(actual[name],undefined);
 for(const name of ['GH_TOKEN','GITHUB_TOKEN','SG_BUSINESS_MONGO_PASSWORD','SG_SSH_PRIVATE_KEY','SG_BUSINESS_SSH_PRIVATE_KEY'])assert.throws(()=>ordinaryEntryEnvironment({...env,[name]:'synthetic'}));
});
test('metadata rejection starts no child and consumes no inherited private input',async()=>{
 const f=fixture();f.dependencies.admit=()=>{throw Error('synthetic-UID-or-pipe-rejected');};
 await assert.rejects(f.start(),/STOP_NO_RETRY/);assert.equal(f.starts(),0);
});
test('one exact child inherits FD0/FD3/FD4 without new pipes and waits for close after exit',async()=>{
 const f=fixture();let settled=false;const p=f.start().then(v=>{settled=true;return v;});
 const [exe,args,options]=f.captured();assert.equal(exe,process.execPath);assert.equal(args.length,2);
 assert.match(args[0],/sg-ag-ordinary-private-entry\.mjs$/);assert.equal(args[1],'--protected');
 assert.deepEqual(options.stdio,[0,'ignore','ignore',3,4]);assert.equal(options.env.GITHUB_RUN_ID,f.identity.actorRun.split(':')[0]);
 f.child.exitCode=0;f.child.emit('exit',0,null);await Promise.resolve();assert.equal(settled,false);
 f.child.emit('close',0,null);const result=await p;assert.equal(result.actualChildClosed,true);assert.equal(result.newContinuationAllowed,false);
 assert.equal(f.starts(),1);assert.equal(f.signals.listenerCount('SIGTERM'),0);
});
test('failed or uncertain child close cannot be launched again under the same actor',async()=>{
 const f=fixture(),p=f.start();f.child.exitCode=2;f.child.emit('close',2,null);await assert.rejects(p,/STOP_NO_RETRY/);
 await assert.rejects(f.start(),/STOP_NO_RETRY/);assert.equal(f.starts(),1);
});
test('even a successful closed child cannot replay in the same acting run',async()=>{
 const f=fixture(),p=f.start();f.child.exitCode=0;f.child.emit('close',0,null);await p;
 await assert.rejects(f.start(),/STOP_NO_RETRY/);assert.equal(f.starts(),1);
});
test('parent signals terminate once and wait for actual child close before stopping',async()=>{
 const f=fixture();let settled=false;const p=f.start().finally(()=>{settled=true;});
 f.signals.emit('SIGTERM');f.signals.emit('SIGTERM');f.signals.emit('SIGINT');assert.deepEqual(f.child.kills,['SIGTERM']);
 assert.equal(f.timers.length,1);assert.equal(f.timers[0].ms,5000);assert.equal(settled,false);
 f.child.exitCode=0;f.child.emit('close',0,null);await assert.rejects(p,/STOP_NO_RETRY/);assert.equal(f.timers[0].cancelled,true);
 f.timers[0].f();assert.deepEqual(f.child.kills,['SIGTERM']);
 assert.equal(f.starts(),1);assert.equal(f.signals.listenerCount('SIGTERM'),0);assert.equal(f.signals.listenerCount('SIGINT'),0);
});
test('child error is retained, escalates only that child, and still waits for close',async()=>{
 const f=fixture();let settled=false;const p=f.start().finally(()=>{settled=true;});
 f.child.emit('error',Error('synthetic-unknown'));f.child.emit('error',Error('synthetic-repeated-error'));
 assert.deepEqual(f.child.kills,['SIGTERM']);assert.equal(settled,false);
 f.timers[0].f();assert.deepEqual(f.child.kills,['SIGTERM','SIGKILL']);assert.equal(settled,false);
 f.child.exitCode=null;f.child.emit('close',null,'SIGKILL');await assert.rejects(p,/STOP_NO_RETRY/);assert.equal(f.starts(),1);
});
test('spawn throws once without restart or manufacturing child success',async()=>{
 const f=fixture();let starts=0;f.dependencies.spawn=()=>{starts++;throw Error('synthetic-spawn-failed');};
 await assert.rejects(f.start(),/STOP_NO_RETRY/);await assert.rejects(f.start(),/STOP_NO_RETRY/);assert.equal(starts,1);
});
test('failed spawn without a PID still waits for its actual close without signalling another process',async()=>{
 const f=fixture();f.child.pid=undefined;let settled=false;const p=f.start().finally(()=>{settled=true;});
 f.child.emit('error',Error('synthetic-no-child'));await Promise.resolve();assert.equal(settled,false);
 assert.deepEqual(f.child.kills,[]);assert.equal(f.timers.length,0);
 f.child.emit('close',-1,null);await assert.rejects(p,/STOP_NO_RETRY/);assert.equal(f.starts(),1);
});
test('child protected runtime manifest must include the exact inherited launcher',()=>{
 assert(requiredOrdinaryRuntimeFiles.includes('scripts/runner-v2/ag-rolling/sg-ag-ordinary-inherited-launcher.mjs'));
});
