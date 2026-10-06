import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {generateKeyPairSync,createHash} from 'node:crypto';import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
import {stable} from './mongo-writer.mjs';import {digest} from './ag-rolling/sg-business-delivery.mjs';
import {MINIMUM_PRIVILEGES,HISTORICAL_BRANCH,HISTORICAL_USER} from './ag-rolling/sg-historical-labomba-actor.mjs';
import {historicalProviderContext,assertHistoricalProviderChallenge,createHistoricalRecipient,createHistoricalProvider,assertHistoricalProviderConfiguration} from './ag-rolling/sg-historical-provider-channel.mjs';
import {attestHistoricalHostedChallenge} from './ag-rolling/sg-historical-provider-attestation.mjs';
import {historicalProviderHttps} from './ag-rolling/sg-historical-provider-https.mjs';
import {historicalActorEnvironment,executeHistoricalPrivateActor,runHistoricalPrivateProvider} from './ag-rolling/sg-historical-provider-runtime.mjs';
const env={GITHUB_ACTIONS:'true',RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_REPOSITORY:'zyzuoyang/sg-capture-runner',GITHUB_REF:'refs/heads/'+HISTORICAL_BRANCH,
 GITHUB_JOB:'ag-rolling-business-delivery',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'99123',GITHUB_SHA:'a'.repeat(40),SG_BUSINESS_GAME_IDS:'32723',SG_BUSINESS_LINUX_RUN:'99124'};
const manifestSha='b'.repeat(64),context=historicalProviderContext(env,manifestSha);
const key='-----BEGIN OPENSSH PRIVATE KEY-----\n'+Buffer.from('synthetic-memory-key').toString('base64')+'\n-----END OPENSSH PRIVATE KEY-----\n';
const credentials=()=>({schema:'sg-historical-private-pipe-v1',gameId:32723,run:context.run,commit:context.commit,password:'synthetic-private-password',ghToken:'synthetic-private-token',nativeSshPrivateKey:key,historicalSshPrivateKey:key});
const evidence=()=>Buffer.from(JSON.stringify({schema:'sg-historical-labomba-run-v1',owner:context.run+':historical-32723',commit:context.commit,
 linuxProof:{run:Number(context.linuxRun),commit:context.commit,joinedCommands:14},sourceRequests:0,nativeWrites:0,complete:true,result:{syntheticPrivateEvidence:'only-in-private-pipe'}}));
function fixture(){
 const signing=generateKeyPairSync('ed25519'),der=signing.publicKey.export({type:'spki',format:'der'});
 const config={schema:'sg-historical-private-provider-v1',enabled:true,endpoint:'https://52.87.94.113/sg-historical-32723',tlsSpkiSha256:'c'.repeat(64),signingPublicKey:der.toString('base64url'),signingPublicKeySha256:createHash('sha256').update(der).digest('hex')};
 const execution={schema:'sg-historical-labomba-execution-v1',enabled:true,manifestSha256:manifestSha,privateProvider:config,
  permission:{username:HISTORICAL_USER,sshAccount:'sghistorical32723',grantKey:'primary/historical-delivery-permission:32723:'+manifestSha},
  ssh:{host:'52.87.94.113',hostKeyFingerprint:'SHA256:synthetic-host',knownHostsSha256:'d'.repeat(64),nativeIdentityFingerprint:'SHA256:synthetic-native',historicalIdentityFingerprint:'SHA256:synthetic-own'}};
 const canonical=MINIMUM_PRIVILEGES.map(v=>({resource:v.resource,actions:[...v.actions].sort()})).sort((a,b)=>stable(a).localeCompare(stable(b)));
 const grant={_id:execution.permission.grantKey,value:{schema:'sg-historical-labomba-permission-v1',gameId:32723,username:HISTORICAL_USER,minimumPermissionApproved:true,immutable:true,branch:HISTORICAL_BRANCH,manifestSha256:manifestSha,
  privilegesHash:digest(canonical),sshAccount:'sghistorical32723',rtpFileSha256:'9339f7fe9b36236d6f8d5271e67612497c48b3681e4b03050e7d61562cb8bc4b',
  ssh:{...execution.ssh,nativeAccount:'sgcapture',historicalAccount:'sghistorical32723',resourceOnly:true,rtpHashOnly:true},
  linux:{run:Number(context.linuxRun),commit:context.commit,joinedCommands:14,sealedReceipts:Array.from({length:9},(_,i)=>({mailbox:'synthetic:'+i,run:Number(context.linuxRun),commit:context.commit,received:true,receiptHash:String(i).repeat(64)}))},
  privateProvider:{schema:config.schema,endpoint:config.endpoint,tlsSpkiSha256:config.tlsSpkiSha256,signingPublicKeySha256:config.signingPublicKeySha256,privateCredentials:true,privateEvidence:true,gameId:32723,run:context.run,commit:context.commit,attempt:1}}};
 const recipient=createHistoricalRecipient({context,config}),reads=[];
 const run={id:99123,run_attempt:1,repository:{full_name:context.repository},head_sha:context.commit,head_branch:context.branch,path:context.workflow,event:'workflow_dispatch',status:'in_progress'};
 const jobs={total_count:1,jobs:[{id:888,run_id:99123,name:context.job,status:'in_progress',runner_id:777,labels:['ubuntu-latest'],check_run_url:'https://api.github.com/repos/'+context.repository+'/check-runs/999'}]};
 const check={id:999,app:{slug:'github-actions'},head_sha:context.commit,name:context.job,status:'in_progress',output:{annotations_count:1}};
 const annotations=[{title:'SG_HISTORICAL_PRIVATE_CHALLENGE_V1',annotation_level:'notice',message:stable(recipient.challenge)}];
 const args={challenge:recipient.challenge,context,execution,readGithub:async path=>{reads.push(path);return path.includes('/annotations?')?annotations:path.endsWith('/check-runs/999')?check:path.includes('/jobs?')?jobs:run;},
  readProtectedAdmission:async()=>({grant,observedAt:Date.now()}),verifyOriginalCanonical:async()=>true,verifyOwnLinux:async()=>true,verifyNativeEnding:async()=>true};
 return {signing,config,execution,grant,recipient,run,jobs,check,annotations,args,reads};
}
async function pair(){const f=fixture(),attestation=await attestHistoricalHostedChallenge(f.args);
 const provider=createHistoricalProvider({challenge:f.recipient.challenge,context,config:f.config,signingPrivateKey:f.signing.privateKey.export({type:'pkcs8',format:'pem'}),credentials:credentials(),attestation});return {...f,provider};}
test('real ephemeral crypto delivers one private envelope and acknowledges only exact full evidence readback',async()=>{
 const f=await pair(),packet=f.provider.credentialPacket,text=JSON.stringify(packet);
 assert(!text.includes('synthetic-private')&&!text.includes('OPENSSH'));assert.deepEqual(f.recipient.acceptCredentials(packet),credentials());
 const plain=evidence(),encrypted=f.recipient.evidence(plain);assert(!JSON.stringify(encrypted).includes('syntheticPrivateEvidence'));
 let saved,writes=0,reads=0;const ack=await f.provider.acceptEvidence(encrypted,{writePrivate:async b=>{writes++;saved=Buffer.from(b);},readPrivate:async()=>{reads++;return Buffer.from(saved);}});
 assert.equal(f.recipient.acceptReceipt(ack).evidenceSha256,createHash('sha256').update(plain).digest('hex'));assert.equal(writes,1);assert.equal(reads,1);saved.fill(0);plain.fill(0);
});
test('foreign contexts, expired challenges, mutated caller copies and unapproved public provider bindings are rejected',()=>{
 const f=fixture();for(const mutate of [v=>v.context.gameId=32731,v=>v.context.run='99124:1',v=>v.context.commit='c'.repeat(40),v=>v.extra=true,v=>v.expiresAt++,v=>v.recipientPublicKey='malformed']){
  const c=f.recipient.challenge;mutate(c);assert.throws(()=>assertHistoricalProviderChallenge(c,context));
 }
 assert.throws(()=>assertHistoricalProviderChallenge(f.recipient.challenge,context,f.recipient.challenge.expiresAt));
 const copied=f.recipient.challenge;copied.nonce='e'.repeat(64);assert.notEqual(copied.nonce,f.recipient.challenge.nonce);
 for(const change of [{enabled:false},{endpoint:'http://52.87.94.113/sg-historical-32723'},{endpoint:'https://foreign.invalid/sg-historical-32723'},{signingPublicKeySha256:'f'.repeat(64)}])assert.throws(()=>assertHistoricalProviderConfiguration({...f.config,...change}));f.recipient.close();
});
test('wrong signature, altered ciphertext and wrong recipient key fail closed with fixed errors',async()=>{
 for(const change of [v=>v.signature='A'.repeat(86),v=>v.packet.tag='A'.repeat(22),v=>v.packet.challengeHash='d'.repeat(64),v=>v.packet.phase='evidence']){
  const f=await pair(),packet=structuredClone(f.provider.credentialPacket);change(packet);
  assert.throws(()=>f.recipient.acceptCredentials(packet),e=>e.message==='HISTORICAL_PRIVATE_PROVIDER_STOP_NO_RETRY');
  assert.throws(()=>f.recipient.acceptCredentials(f.provider.credentialPacket));f.provider.close();
 }
 const f=await pair(),other=createHistoricalRecipient({context,config:f.config});assert.throws(()=>other.acceptCredentials(f.provider.credentialPacket));f.recipient.close();f.provider.close();
});
test('one consumed credential, evidence or ACK can never be replayed',async()=>{
 const f=await pair();f.recipient.acceptCredentials(f.provider.credentialPacket);assert.throws(()=>f.recipient.acceptCredentials(f.provider.credentialPacket));f.provider.close();
 const g=await pair();g.recipient.acceptCredentials(g.provider.credentialPacket);const packet=g.recipient.evidence(evidence());assert.throws(()=>g.recipient.evidence(evidence()));
 let saved;const ack=await g.provider.acceptEvidence(packet,{writePrivate:async b=>saved=Buffer.from(b),readPrivate:async()=>Buffer.from(saved)});
 await assert.rejects(g.provider.acceptEvidence(packet,{writePrivate:async()=>{throw Error();},readPrivate:async()=>saved}));assert.throws(()=>g.recipient.acceptReceipt(ack));saved.fill(0);
});
test('unknown private evidence ACK or changed full readback stops once and cannot repeat the sink write',async()=>{
 for(const unknown of [true,false]){const f=await pair();f.recipient.acceptCredentials(f.provider.credentialPacket);const packet=f.recipient.evidence(evidence());let writes=0,reads=0;
  const io={writePrivate:async()=>{writes++;if(unknown)throw Error('synthetic-private-unknown');},readPrivate:async()=>{reads++;return Buffer.from('synthetic-changed-private-evidence');}};
  await assert.rejects(f.provider.acceptEvidence(packet,io),e=>e.message==='HISTORICAL_PRIVATE_PROVIDER_STOP_NO_RETRY');await assert.rejects(f.provider.acceptEvidence(packet,io));assert.equal(writes,1);assert.equal(reads,unknown?0:1);f.recipient.close();
 }
});
test('the actual read-only attestation adapters reject foreign or ambiguous GHH jobs, check apps and missing live challenge annotations',async()=>{
 for(const change of [f=>f.run.head_sha='b'.repeat(40),f=>f.run.run_attempt=2,f=>f.jobs.total_count=2,f=>f.jobs.jobs[0].runner_id=0,
  f=>f.jobs.jobs[0].check_run_url='https://foreign.invalid/check/999',f=>f.check.app.slug='foreign-app',f=>f.annotations[0].message='{}',f=>f.annotations.push({...f.annotations[0]})]){
  const f=fixture();change(f);await assert.rejects(attestHistoricalHostedChallenge(f.args),e=>e.message==='HISTORICAL_HOSTED_ATTESTATION_STOP_NO_RETRY');f.recipient.close();
 }
});
test('protected minimum grant, exact ownLinux9 seals, provider binding and original fresh gates are mandatory',async()=>{
 for(const change of [f=>f.grant.value.minimumPermissionApproved=false,f=>f.grant.value.linux.sealedReceipts.pop(),f=>f.grant.value.linux.commit='d'.repeat(40),
  f=>f.grant.value.privateProvider.run='99124:1',f=>f.grant.value.privateProvider.signingPublicKeySha256='f'.repeat(64),f=>f.args.verifyOriginalCanonical=async()=>false,
  f=>f.args.verifyOwnLinux=async()=>false,f=>f.args.verifyNativeEnding=async()=>false,f=>f.args.readProtectedAdmission=async()=>({grant:f.grant,observedAt:Date.now()-30000})]){
  const f=fixture();change(f);await assert.rejects(attestHistoricalHostedChallenge(f.args));f.recipient.close();
 }
});
test('an unknown attestation read never retries or issues later native admission reads',async()=>{
 const f=fixture();let reads=0,native=0;f.args.readGithub=async()=>{reads++;throw Error('synthetic-secret-read-unknown');};f.args.readProtectedAdmission=async()=>{native++;throw Error();};
 await assert.rejects(attestHistoricalHostedChallenge(f.args),e=>e.message==='HISTORICAL_HOSTED_ATTESTATION_STOP_NO_RETRY');assert.equal(reads,1);assert.equal(native,0);f.recipient.close();
});
test('JSON permission flags cannot substitute for the single-use read-only attestation capability',async()=>{
 const f=fixture(),attestation=await attestHistoricalHostedChallenge(f.args);
 const args={challenge:f.recipient.challenge,context,config:f.config,signingPrivateKey:f.signing.privateKey.export({type:'pkcs8',format:'pem'}),credentials:credentials()};
 assert.throws(()=>createHistoricalProvider({...args,attestation:structuredClone(attestation)}));
 const provider=createHistoricalProvider({...args,attestation});assert.throws(()=>createHistoricalProvider({...args,attestation}));provider.close();f.recipient.close();
});
test('foreign evidence identity, truncated evidence and a corrupted encrypted private receipt cannot acknowledge delivery',async()=>{
 for(const change of [v=>v.commit='d'.repeat(40),v=>v.owner='99124:1:historical-32723',v=>v.linuxProof.run=37355624055,v=>v.sourceRequests=1]){
  const f=await pair();f.recipient.acceptCredentials(f.provider.credentialPacket);const value=JSON.parse(evidence());change(value);assert.throws(()=>f.recipient.evidence(Buffer.from(JSON.stringify(value))));f.provider.close();
 }
 const f=await pair();f.recipient.acceptCredentials(f.provider.credentialPacket);assert.throws(()=>f.recipient.evidence(Buffer.from('{synthetic-private')));f.provider.close();
 const g=await pair();g.recipient.acceptCredentials(g.provider.credentialPacket);let saved;const packet=g.recipient.evidence(evidence());const ack=await g.provider.acceptEvidence(packet,{writePrivate:async b=>saved=Buffer.from(b),readPrivate:async()=>Buffer.from(saved)});
 ack.tag='A'.repeat(22);assert.throws(()=>g.recipient.acceptReceipt(ack));assert.throws(()=>g.recipient.acceptReceipt(ack));saved.fill(0);
});
function mockRequest(mode,calls){return (url,options,onResponse)=>{calls.push({url:String(url),options});const req=new EventEmitter();req.destroy=()=>{};
 req.end=(body,done)=>{calls.at(-1).body=Buffer.from(body);done?.();queueMicrotask(()=>{if(mode==='unknown'){req.emit('error',Error('synthetic-secret-network-error'));return;}
  const res=new PassThrough();res.statusCode=mode==='redirect'?302:200;res.headers={'content-type':'application/json'};onResponse(res);res.end(mode==='malformed'?'{synthetic-secret':JSON.stringify({synthetic:'encrypted-response-only'}));});};return req;};}
test('HTTPS exchange sends one fixed pinned request, rejects redirects and unknown reads without reconnect or echo',async()=>{
 for(const mode of ['unknown','redirect','malformed']){const f=fixture(),calls=[],io=historicalProviderHttps(f.config,{request:mockRequest(mode,calls)});
  await assert.rejects(io.exchange('credentials',f.recipient.challenge),e=>e.message==='HISTORICAL_PROVIDER_HTTPS_STOP_NO_RETRY');await assert.rejects(io.exchange('credentials',f.recipient.challenge));
  assert.equal(calls.length,1);assert.equal(calls[0].url,f.config.endpoint+'/credentials');assert.equal(calls[0].options.rejectUnauthorized,true);assert.equal(calls[0].options.agent,false);
  assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(typeof calls[0].options.checkServerIdentity,'function');f.recipient.close();
 }
});
test('an actual child receives only private stdin and returns complete evidence on FD3 without credential environment or files',async()=>{
 const auth=credentials();let started=0;
 const script="import fs from 'node:fs';const v=JSON.parse(fs.readFileSync(0,'utf8'));if(v.password!=='synthetic-private-password'||process.env.GH_TOKEN||process.env.ACTIONS_RUNTIME_TOKEN)process.exit(2);fs.writeFileSync(3,JSON.stringify({complete:true,syntheticPrivateEvidence:'private-fd-only'}));";
 const result=await executeHistoricalPrivateActor(auth,{env:{...env,PATH:process.env.PATH,ACTIONS_RUNTIME_TOKEN:'synthetic-runtime-token',GH_TOKEN:'synthetic-foreign-token'},start:(command,args,options)=>{
  started++;assert(!JSON.stringify([args,options.env]).includes('synthetic-private'));assert.equal(options.env.GH_TOKEN,undefined);assert.equal(options.env.ACTIONS_RUNTIME_TOKEN,undefined);
  return spawn(command,['--input-type=module','-e',script],options);
 }});
 assert.equal(started,1);assert.equal(result.exitCode,0);assert.deepEqual(JSON.parse(result.report),{complete:true,syntheticPrivateEvidence:'private-fd-only'});assert.equal(auth.password,undefined);assert.equal(auth.nativeSshPrivateKey,undefined);result.report.fill(0);
 assert.equal(historicalActorEnvironment({...env,SSH_AUTH_SOCK:'foreign',ACTIONS_RUNTIME_TOKEN:'foreign'}).SSH_AUTH_SOCK,undefined);
});
test('hosted recipient orchestrates one synthetic attested actor and private full evidence ACK without public plaintext',async()=>{
 const f=fixture(),notices=[];let provider,saved,executed=0;const phases=[];
 const code=await runHistoricalPrivateProvider({env,preauth:()=>f.execution,notice:v=>notices.push(v),execute:async auth=>{executed++;assert.equal(auth.password,'synthetic-private-password');return {exitCode:0,report:evidence()};},
  channelFactory:()=>({close(){},async exchange(phase,value){phases.push(phase);if(phase==='credentials'){
   f.args.challenge=value;f.annotations[0].message=stable(value);const attestation=await attestHistoricalHostedChallenge(f.args);
   provider=createHistoricalProvider({challenge:value,context,config:f.config,signingPrivateKey:f.signing.privateKey.export({type:'pkcs8',format:'pem'}),credentials:credentials(),attestation});return provider.credentialPacket;
  }return provider.acceptEvidence(value,{writePrivate:async b=>saved=Buffer.from(b),readPrivate:async()=>Buffer.from(saved)});}})});
 assert.equal(code,0);assert.equal(executed,1);assert.deepEqual(phases,['credentials','evidence']);assert.equal(notices.length,1);assert(!notices[0].includes('synthetic-private'));saved.fill(0);f.recipient.close();
});
test('missing private evidence ACK stops after one actor; production disabled runtime never reads stdin, emits a challenge or opens HTTPS',async()=>{
 const f=fixture();let executed=0,exchanges=0;
 await assert.rejects(runHistoricalPrivateProvider({env,preauth:()=>f.execution,notice:()=>{},execute:async()=>{executed++;return {exitCode:0,report:evidence()};},channelFactory:()=>({close(){},async exchange(phase,value){exchanges++;
  if(phase==='evidence')throw Error('synthetic-private-unknown');f.args.challenge=value;f.annotations[0].message=stable(value);
  return createHistoricalProvider({challenge:value,context,config:f.config,signingPrivateKey:f.signing.privateKey.export({type:'pkcs8',format:'pem'}),credentials:credentials(),attestation:await attestHistoricalHostedChallenge(f.args)}).credentialPacket;
 }})}),e=>e.message==='HISTORICAL_HOSTED_PRIVATE_PROVIDER_STOP_NO_RETRY');assert.equal(executed,1);assert.equal(exchanges,2);f.recipient.close();
 const child=spawn(process.execPath,['scripts/runner-v2/ag-rolling/sg-historical-provider-runtime.mjs'],{env:{...process.env,...env},stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.stdin.end('synthetic-unread-private-credential');
 const code=await new Promise(resolve=>child.on('close',resolve));assert.equal(code,2);assert.equal(output.trim(),'HISTORICAL_HOSTED_PRIVATE_PROVIDER_STOP_NO_RETRY');
 const config=JSON.parse(fs.readFileSync('config/ag-historical-labomba-execution.json'));assert.equal(config.enabled,false);assert.equal(config.privateProvider,undefined);
});
