import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {spawn} from 'node:child_process';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';import {createHash} from 'node:crypto';import path from 'node:path';
import {parseHistoricalPrivateEnvelope,receiveHistoricalPrivatePipe,rejectHistoricalCredentialEnvironment,historicalChildEnvironment,
 PINNED_HOST,openHistoricalMemoryIdentity,withHistoricalMemoryIdentities,historicalResourceTransport,historicalRtpHash} from './ag-rolling/sg-historical-private-pipe.mjs';
const env={GITHUB_RUN_ID:'99123',GITHUB_SHA:'a'.repeat(40),RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted'};
const key='-----BEGIN OPENSSH PRIVATE KEY-----\n'+Buffer.from('synthetic-memory-only-key').toString('base64')+'\n-----END OPENSSH PRIVATE KEY-----\n';
const envelope=()=>({schema:'sg-historical-private-pipe-v1',gameId:32723,run:'99123:1',commit:env.GITHUB_SHA,
 password:'synthetic-private-password',ghToken:'synthetic-private-token',nativeSshPrivateKey:key,historicalSshPrivateKey:key});
test('private envelope rejects foreign run, game, extra values, malformed input and missing SSH identity without echo',()=>{
 assert.equal(parseHistoricalPrivateEnvelope(Buffer.from(JSON.stringify(envelope())),env).gameId,32723);
 for(const change of [v=>v.gameId=32731,v=>v.run='99124:1',v=>v.commit='b'.repeat(40),v=>v.extra=key,
  v=>v.nativeSshPrivateKey='invalid-synthetic-secret',v=>delete v.historicalSshPrivateKey]){
  const value=envelope();change(value);assert.throws(()=>parseHistoricalPrivateEnvelope(Buffer.from(JSON.stringify(value)),env),e=>e.message==='HISTORICAL_PRIVATE_ENVELOPE_REJECTED');
 }
 assert.throws(()=>parseHistoricalPrivateEnvelope(Buffer.from('{synthetic-secret'),env),e=>e.message==='HISTORICAL_PRIVATE_ENVELOPE_REJECTED');
 for(const name of ['GH_TOKEN','GITHUB_TOKEN','SG_BUSINESS_MONGO_PASSWORD','SG_SSH_PRIVATE_KEY','SG_BUSINESS_SSH_PRIVATE_KEY'])
  assert.throws(()=>rejectHistoricalCredentialEnvironment({...env,[name]:'synthetic-secret'}),/HISTORICAL_PRIVATE_PIPE_REQUIRED/);
 assert.deepEqual(historicalChildEnvironment({...env,PATH:'synthetic-path',ACTIONS_RUNTIME_TOKEN:'synthetic-private-token',SSH_AUTH_SOCK:'foreign-agent'}),{PATH:'synthetic-path'});
});
test('private stream requires complete EOF, rejects truncation and stops once on an unknown pipe',async()=>{
 const stream=new PassThrough(),pending=receiveHistoricalPrivatePipe({stream,env});const bytes=Buffer.from(JSON.stringify(envelope()));
 stream.write(bytes.subarray(0,20));stream.end(bytes.subarray(20));assert.equal((await pending).run,'99123:1');
 const truncated=new PassThrough(),bad=receiveHistoricalPrivatePipe({stream:truncated,env});truncated.end('{synthetic-secret');await assert.rejects(bad,/HISTORICAL_PRIVATE_PIPE_STOP_NO_RETRY/);
 const unknown=new PassThrough();await assert.rejects(receiveHistoricalPrivatePipe({stream:unknown,env,timeoutMs:5}),/HISTORICAL_PRIVATE_PIPE_STOP_NO_RETRY/);assert(unknown.destroyed);
});
test('an actual child process receives credentials only on stdin and emits no credential data',async()=>{
 const script="import {receiveHistoricalPrivatePipe} from './scripts/runner-v2/ag-rolling/sg-historical-private-pipe.mjs';try{const value=await receiveHistoricalPrivatePipe();if(value.gameId!==32723)process.exitCode=2;}catch{process.stderr.write('PRIVATE_PIPE_REJECTED');process.exitCode=2;}";
 const child=spawn(process.execPath,['--input-type=module','-e',script],{env:{...process.env,...env,GH_TOKEN:undefined,GITHUB_TOKEN:undefined},stdio:['pipe','pipe','pipe']});
 let output='';child.stdout.on('data',p=>output+=p);child.stderr.on('data',p=>output+=p);
 child.stdin.end(JSON.stringify(envelope()));const exit=await new Promise(resolve=>child.on('close',resolve));assert.equal(exit,0);assert.equal(output,'');
});
function processFixture(){const p=new EventEmitter();p.stdin=new PassThrough();p.stdout=new PassThrough();p.stderr=new PassThrough();p.killed=0;p.kill=()=>{p.killed++;};return p;}
test('memory SSH identity sends its single key on ssh-add stdin, pins host and fingerprint, permits one fixed command and cleans up',async()=>{
 const known=Buffer.from('synthetic-public-known-host'),calls=[],agent=processFixture(),sessions=[];
 const config={host:'52.87.94.113',hostKeyFingerprint:PINNED_HOST,knownHostsFile:process.platform==='win32'?'C:/synthetic/public_hosts':'/synthetic/public_hosts',knownHostsSha256:createHash('sha256').update(known).digest('hex'),
  nativeIdentityFingerprint:'SHA256:'+'A'.repeat(43),historicalIdentityFingerprint:'SHA256:'+'B'.repeat(43)};
 const files={readFileSync:()=>known,mkdtempSync:()=>'/synthetic/own-agent',chmodSync:()=>{},existsSync:()=>true,unlinkSync:p=>calls.push(['unlink',p]),rmdirSync:p=>calls.push(['rmdir',p])};
 const run=(command,args,options)=>{calls.push([command,args,options]);if(command==='ssh-keygen')return '256 '+PINNED_HOST+' fixture (ED25519)';
  if(args[0]==='-')return '';return '256 '+config.historicalIdentityFingerprint+' fixture (ED25519)';};
 const start=(command,args,options)=>{calls.push([command,args,options]);if(command==='ssh-agent')return agent;const p=processFixture();sessions.push(p);return p;};
 const identity=await openHistoricalMemoryIdentity({key,role:'historical',config,env,io:{fs:files,execFileSync:run,spawn:start}});
 assert.throws(()=>identity.open('32731'),/HISTORICAL_SSH_FIXED_COMMAND/);identity.open('32723');
 const add=calls.find(c=>c[0]==='ssh-add'&&c[1][0]==='-');assert.equal(add[2].input,key);
 for(const call of calls.filter(c=>['ssh-agent','ssh','ssh-add'].includes(c[0])))assert(!JSON.stringify([call[1],call[2].env]).includes(key));
 const ssh=calls.find(c=>c[0]==='ssh');assert(ssh[1].includes('IdentityFile=none'));assert(ssh[1].includes('IdentityAgent='+path.join('/synthetic/own-agent','agent.sock')));
 assert(ssh[1].includes('sghistorical32723@52.87.94.113'));assert(!ssh[1].includes('-i'));
 identity.close();identity.close();assert.equal(agent.killed,1);assert(calls.some(c=>c[0]==='unlink'));assert(calls.some(c=>c[0]==='rmdir'));
});
test('an extra agent identity or a wrong fingerprint stops before SSH and destroys the private agent',async()=>{
 const known=Buffer.from('synthetic-public-host'),config={host:'52.87.94.113',hostKeyFingerprint:PINNED_HOST,
  knownHostsFile:process.platform==='win32'?'C:/synthetic/hosts':'/synthetic/hosts',knownHostsSha256:createHash('sha256').update(known).digest('hex'),
  nativeIdentityFingerprint:'SHA256:'+'A'.repeat(43),historicalIdentityFingerprint:'SHA256:'+'B'.repeat(43)};
 for(const listing of ['256 SHA256:'+'C'.repeat(43)+' fixture (ED25519)','256 '+config.historicalIdentityFingerprint+' fixture (ED25519)\n256 '+config.nativeIdentityFingerprint+' extra (ED25519)']){
  const agent=processFixture();let ssh=0;const files={readFileSync:()=>known,mkdtempSync:()=>'/synthetic/agent',chmodSync:()=>{},existsSync:()=>true,unlinkSync:()=>{},rmdirSync:()=>{}};
  const run=(command,args)=>command==='ssh-keygen'?'256 '+PINNED_HOST+' fixture (ED25519)':args[0]==='-'?'':listing;
  await assert.rejects(openHistoricalMemoryIdentity({key,role:'historical',config,env,io:{fs:files,execFileSync:run,spawn:command=>{if(command==='ssh')ssh++;return agent;}}}),/HISTORICAL_MEMORY_IDENTITY_STOP_NO_RETRY/);
  assert.equal(ssh,0);assert.equal(agent.killed,1);
 }
});
test('partial identity setup or actor initialization failure always closes agents and clears key references',async()=>{
 for(const failSecond of [true,false]){
  const auth=envelope(),closed=[];let visited=0;
  await assert.rejects(withHistoricalMemoryIdentities(auth,{},async()=>{visited++;throw Error('synthetic-private-runtime-error');},
   {open:async({role})=>{if(failSecond&&role==='historical')throw Error('synthetic-private-setup-error');return {close:()=>closed.push(role)};}}),
   e=>e.message==='HISTORICAL_PRIVATE_IDENTITY_OR_ACTOR_STOP_NO_RETRY');
  assert.deepEqual(closed,failSecond?['native']:['native','historical']);assert.equal(visited,failSecond?0:1);
  assert(!Object.hasOwn(auth,'nativeSshPrivateKey'));assert(!Object.hasOwn(auth,'historicalSshPrivateKey'));
 }
});
test('resource channel refuses writes and extra fields before sending, then never retries an unknown request',async()=>{
 const child=processFixture();let opens=0;const transport=historicalResourceTransport({open:()=>{opens++;return child;}},{timeoutMs:5});
 let sent='';child.stdin.on('data',b=>sent+=b);
 assert.throws(()=>transport.request('cas',{key:'x'}),/HISTORICAL_RESOURCE_READ_ONLY/);assert.throws(()=>transport.request('resources',{op:'create'}),/HISTORICAL_RESOURCE_READ_ONLY/);assert.equal(sent,'');
 const pending=transport.request('resources');await assert.rejects(pending,/HISTORICAL_RESOURCE_READ_UNKNOWN/);assert.equal(opens,1);assert.equal(sent.split('\n').filter(Boolean).length,1);
 assert.throws(()=>transport.request('resources'),/HISTORICAL_RESOURCE_STOP_NO_RETRY/);transport.close();
});
test('resource response returns full values and rejects unsolicited or malformed data',async()=>{
 const child=processFixture(),transport=historicalResourceTransport({open:()=>child});const sample={sampledAtMs:123,diskFreeBytes:456};
 const pending=transport.request('resources');child.stdout.write(JSON.stringify({ok:true,result:sample})+'\n');assert.deepEqual(await pending,sample);
 const unknown=transport.request('global_holds');child.stdout.write('{synthetic-private-error\n');await assert.rejects(unknown,/HISTORICAL_RESOURCE_RESPONSE_REJECTED/);transport.close();
});
test('RTP hash requires the own command and exact full SHA, with no stderr echo or retry',async()=>{
 for(const response of ['c'.repeat(64)+'\n','changed-synthetic-private-value\n']){
  const child=processFixture();let opens=0;const pending=historicalRtpHash({open:command=>{assert.equal(command,'32723');opens++;return child;}});
  child.stderr.write('synthetic-private-transport-error');child.stdout.write(response);child.emit('close',0);
  if(response.length===65)assert.equal(await pending,'c'.repeat(64));else await assert.rejects(pending,/HISTORICAL_RTP_HASH_REJECTED/);assert.equal(opens,1);
 }
});
test('new workflow preserves global exclusivity, uses no secret inputs and disabled preauth rejects before a private read',async()=>{
 const workflow=fs.readFileSync('.github/workflows/historical-labomba.yml','utf8');assert(workflow.includes('group: sg-business-delivery'));
 assert(workflow.includes('timeout-minutes: 330'));assert(!workflow.includes('secrets.'));assert(!workflow.includes('setup-ssh'));
 assert(!workflow.includes('uses:'));assert(workflow.includes('curl --fail --location --retry 0'));assert(workflow.includes('permissions: {}'));
 const execution=JSON.parse(fs.readFileSync('config/ag-historical-labomba-execution.json'));assert.equal(execution.enabled,false);
 const child=spawn(process.execPath,['scripts/runner-v2/ag-rolling/sg-historical-labomba-preauth.mjs'],{env:{...process.env,...env,GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'zyzuoyang/sg-capture-runner',GITHUB_REF:'refs/heads/sg-business-historical-32723-20261005',GITHUB_JOB:'ag-rolling-business-delivery',GITHUB_RUN_ATTEMPT:'1',SG_BUSINESS_GAME_IDS:'32723'},stdio:['pipe','pipe','pipe']});
 let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.stdin.end('synthetic-unread-credential');
 const exit=await new Promise(resolve=>child.on('close',resolve));assert.equal(exit,2);assert.equal(output.trim(),'HISTORICAL_PREAUTH_REJECTED_NO_CREDENTIAL_READ');
});
