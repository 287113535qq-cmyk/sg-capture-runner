import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import fsp from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import http from 'node:http';import {PassThrough} from 'node:stream';import {spawn} from 'node:child_process';import {generateKeyPairSync,createHash,randomBytes} from 'node:crypto';
import {stable} from './mongo-writer.mjs';import {digest} from './ag-rolling/sg-business-delivery.mjs';
import {MINIMUM_PRIVILEGES,HISTORICAL_BRANCH,HISTORICAL_USER} from './ag-rolling/sg-historical-labomba-actor.mjs';
import {createHistoricalRecipient,historicalChallengeHash} from './ag-rolling/sg-historical-provider-channel.mjs';
import {historicalNativeReadStore,verifyHistoricalNativeEnding,historicalProductionReadAdapters} from './ag-rolling/sg-historical-provider-adapters.mjs';
import {historicalEncryptedDurableSink} from './ag-rolling/sg-historical-provider-sink.mjs';
import {historicalFixedPrivateIoHandler,historicalPrivateFrameExchange,createHistoricalFixedPrivateServer} from './ag-rolling/sg-historical-provider-fixed-io.mjs';
import {prepareHistoricalPrivateSender,runHistoricalPrivateSender,readHistoricalSenderBootstrap,openHistoricalSenderMongo} from './ag-rolling/sg-historical-provider-sender.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),profileName='ag-rolling-queue-5fb60599fd6bd3d2ff78b3fbce044a665edaeb5009fb9a6c30179bf5b323944b.json';
function fixture(){
 const manifestBytes=Buffer.from('synthetic-private-sender-manifest'),manifestSha=hash(manifestBytes),signing=generateKeyPairSync('ed25519'),der=signing.publicKey.export({type:'spki',format:'der'});
 const context={gameId:32723,repository:'zyzuoyang/sg-capture-runner',branch:HISTORICAL_BRANCH,workflow:'.github/workflows/historical-labomba.yml',job:'ag-rolling-business-delivery',run:'99123:1',commit:'a'.repeat(40),linuxRun:'99124',manifestSha256:manifestSha};
 const config={schema:'sg-historical-private-provider-v1',enabled:true,endpoint:'https://52.87.94.113/sg-historical-32723',tlsSpkiSha256:'c'.repeat(64),signingPublicKey:der.toString('base64url'),signingPublicKeySha256:hash(der)};
 const evidenceKey=randomBytes(32),binding={schema:'sg-historical-private-durable-sink-v1',enabled:true,algorithm:'AES-256-GCM',directory:'/var/lib/sg-historical-32723/synthetic-test',keyFingerprint:hash(evidenceKey),ownerUid:1000};
 const execution={schema:'sg-historical-labomba-execution-v1',enabled:true,minimumPermissionApproved:true,linuxPermissionGranted:true,gameIds:['32723'],branch:HISTORICAL_BRANCH,manifestSha256:manifestSha,privateProvider:config,
  fixedPrivateIoService:{schema:'sg-historical-fixed-private-io-service-v1',enabled:true,context},privateEvidenceSink:binding,
  permission:{username:HISTORICAL_USER,sshAccount:'sghistorical32723',grantKey:'primary/historical-delivery-permission:32723:'+manifestSha},
  ssh:{host:'52.87.94.113',hostKeyFingerprint:'SHA256:synthetic-host',knownHostsSha256:'d'.repeat(64),nativeIdentityFingerprint:'SHA256:synthetic-native',historicalIdentityFingerprint:'SHA256:synthetic-own'}};
 const canonical=MINIMUM_PRIVILEGES.map(v=>({resource:v.resource,actions:[...v.actions].sort()})).sort((a,b)=>stable(a).localeCompare(stable(b)));
 const ending={syntheticImmutable:true},endingHash=digest(ending);execution.window={run:'37314031299:1',queueId:'rolling-20261003225355-f0d07c84',endedProofHash:endingHash,profile:profileName,permitKey:'rolling-activation:5fb60599fd6bd3d2ff78b3fbce044a665edaeb5009fb9a6c30179bf5b323944b:complete'};
 const grant={_id:execution.permission.grantKey,value:{schema:'sg-historical-labomba-permission-v1',gameId:32723,username:HISTORICAL_USER,minimumPermissionApproved:true,immutable:true,branch:HISTORICAL_BRANCH,manifestSha256:manifestSha,privilegesHash:digest(canonical),sshAccount:'sghistorical32723',rtpFileSha256:'9339f7fe9b36236d6f8d5271e67612497c48b3681e4b03050e7d61562cb8bc4b',
  ssh:{...execution.ssh,nativeAccount:'sgcapture',historicalAccount:'sghistorical32723',resourceOnly:true,rtpHashOnly:true},
  linux:{run:99124,commit:context.commit,joinedCommands:14,sealedReceipts:Array.from({length:9},(_,i)=>({mailbox:'synthetic:'+i,run:99124,commit:context.commit,received:true,receiptHash:String(i).repeat(64)}))},
  privateProvider:{schema:config.schema,endpoint:config.endpoint,tlsSpkiSha256:config.tlsSpkiSha256,signingPublicKeySha256:config.signingPublicKeySha256,privateCredentials:true,privateEvidence:true,gameId:32723,run:context.run,commit:context.commit,attempt:1},
  privateEvidenceSink:{...binding,gameId:32723,run:context.run,commit:context.commit,encryptedOnly:true},fixedPrivateIoService:{...execution.fixedPrivateIoService,endpoint:config.endpoint,tlsSpkiSha256:config.tlsSpkiSha256,privateInheritedPipes:true}}};
 const key='-----BEGIN OPENSSH PRIVATE KEY-----\n'+Buffer.from('synthetic-memory-key').toString('base64')+'\n-----END OPENSSH PRIVATE KEY-----\n';
 const credentials={schema:'sg-historical-private-pipe-v1',gameId:32723,run:context.run,commit:context.commit,password:'synthetic-private-password',ghToken:'synthetic-private-token',nativeSshPrivateKey:key,historicalSshPrivateKey:key};
 const recipient=createHistoricalRecipient({context,config}),source={_id:'primary/rolling-source',value:{status:'idle',owner:null,queueId:null,lastRun:execution.window.run,lastQueueId:execution.window.queueId,endedProofHash:endingHash}};
 const rows=new Map([[grant._id,grant],['primary/rolling-source',source],['primary/rolling-ended:'+execution.window.queueId+':'+execution.window.run,{_id:'primary/rolling-ended:'+execution.window.queueId+':'+execution.window.run,value:ending}]]),calls=[];
 const privileges={authInfo:{authenticatedUsers:[{user:HISTORICAL_USER,db:'admin'}],authenticatedUserPrivileges:structuredClone(MINIMUM_PRIVILEGES)}};
 const client={async close(){calls.push('close');},db:name=>({command:async v=>{calls.push(['command',name,v]);return privileges;},collection:name=>({findOne:async(query,options)=>{calls.push(['findOne',name,query,options]);return rows.get(query._id)??null;},find:(query,options)=>({toArray:async()=>{calls.push(['find',name,query,options]);return query._id.$in.map(k=>rows.get(k)).filter(Boolean);}})})})};
 const profile={activation:profileName.slice(17,-5),federation:{syntheticOnly:true},payload:{queueId:execution.window.queueId,games:Array.from({length:81},(_,i)=>({gameId:String(32000+i),dbName:'synthetic_'+i,campaignId:'synthetic_campaign_'+i}))}};
 const readConfig=name=>{assert(name===profileName||name==='demo-pilot-beaver-20260930.json');return profile;};
 const ghCalls=[];const readGithub=async p=>{ghCalls.push(p);return p.includes('/annotations?')?[{title:'SG_HISTORICAL_PRIVATE_CHALLENGE_V1',annotation_level:'notice',message:stable(recipient.challenge)}]
  :p.endsWith('/check-runs/999')?{id:999,app:{slug:'github-actions'},head_sha:context.commit,name:context.job,status:'in_progress',output:{annotations_count:1}}
  :p.includes('/jobs?')?{total_count:1,jobs:[{id:888,run_id:99123,name:context.job,status:'in_progress',runner_id:777,labels:['ubuntu-latest'],check_run_url:'https://api.github.com/repos/'+context.repository+'/check-runs/999'}]}
  :{id:99123,run_attempt:1,repository:{full_name:context.repository},head_sha:context.commit,head_branch:context.branch,path:context.workflow,event:'workflow_dispatch',status:'in_progress'};};
 const deps={readGithub,makeBoundary:args=>async()=>{assert.equal(args.workflowPath,context.workflow);calls.push('original-canonical');},requireLinux:async args=>{assert.equal(args.id,context.linuxRun);assert.equal(args.token,credentials.ghToken);calls.push('own-Linux14');return {run:99124,commit:context.commit,joinedCommands:14};},verifyFederation:async args=>{assert.equal(args.previous.activation,profile.activation);calls.push('full-ended-federation');return {primaryRun:'37314031299:1',secondaryRun:'37321135064:1',federationHash:digest(profile.federation),sourceRequests:0,closure:{syntheticOnly:true}};}};
 return {context,config,execution,grant,evidenceKey,manifestBytes,signing,credentials,recipient,source,rows,calls,client,privileges,profile,readConfig,readGithub,ghCalls,deps};
}
const report=f=>Buffer.from(JSON.stringify({schema:'sg-historical-labomba-run-v1',owner:f.context.run+':historical-32723',commit:f.context.commit,linuxProof:{run:99124,commit:f.context.commit,joinedCommands:14},sourceRequests:0,nativeWrites:0,complete:true,result:{privateSynthetic:'never-on-disk-in-plaintext'}}));
const args=f=>({challenge:f.recipient.challenge,execution:f.execution,manifestBytes:f.manifestBytes,credentials:f.credentials,signingPrivateKey:f.signing.privateKey.export({format:'pem',type:'pkcs8'}),evidenceKey:f.evidenceKey,client:f.client,readConfig:f.readConfig});
const receipt=f=>{const b=report(f);return {schema:'sg-historical-private-evidence-receipt-v1',context:f.context,challengeHash:historicalChallengeHash(f.recipient.challenge),evidenceSha256:hash(b),evidenceBytes:b.length,fullReadback:true};};
async function disk(f,override={}){
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'sg-synthetic-encrypted-evidence-'));
 const actual=name=>path.join(dir,path.posix.basename(name));
 const fakeStat=(s,directory)=>({isDirectory:()=>directory,isSymbolicLink:()=>false,isFile:()=>!directory,uid:1000,mode:directory?0o700:0o600,size:s?.size});
 const io={lstat:async()=>fakeStat(null,true),realpath:async()=>f.execution.privateEvidenceSink.directory,open:async(name,flags,mode)=>{
  if(name===f.execution.privateEvidenceSink.directory)return {sync:async()=>{},close:async()=>{}};
  const h=await fsp.open(actual(name),flags,mode);return {writeFile:b=>h.writeFile(b),sync:()=>h.sync(),close:()=>h.close(),readFile:()=>h.readFile(),stat:async()=>fakeStat(await h.stat(),false)};
 },...override};
 return {dir,io,actual,dispose:async()=>{for(const n of await fsp.readdir(dir))await fsp.unlink(path.join(dir,n));await fsp.rmdir(dir);}};
}
test('production read adapters call canonical/Linux/complete native gates and expose only bounded native reads',async()=>{
 const f=fixture(),adapters=historicalProductionReadAdapters({context:f.context,execution:f.execution,manifestSha256:f.context.manifestSha256,client:f.client,token:f.credentials.ghToken,readConfig:f.readConfig},f.deps);
 const before=await adapters.readProtectedAdmission();assert.equal(await adapters.verifyOriginalCanonical({}),true);assert.equal(await adapters.verifyOwnLinux({}),true);assert.equal(await adapters.verifyNativeEnding({protectedRead:before}),true);
 assert.equal(f.calls.filter(x=>x==='original-canonical').length,1);assert.equal(f.calls.filter(x=>x==='own-Linux14').length,1);assert.equal(f.calls.filter(x=>x==='full-ended-federation').length,1);
 const scans=f.calls.filter(x=>Array.isArray(x)&&x[0]==='find');assert.equal(scans.reduce((n,x)=>n+x[2]._id.$in.length,0),1782);assert.equal(scans.length,18);
 const store=historicalNativeReadStore(f.client);assert.deepEqual(Object.keys(store).sort(),['get','getMany']);assert.throws(()=>store.get('business','x'));assert.throws(()=>store.get('state','primary/foreign'));
 await assert.rejects(adapters.verifyOwnLinux({}));f.recipient.close();
});
test('missing or expanded minimum permissions and wrong protected Linux/provider approval stop before credential release',async()=>{
 for(const change of [f=>f.privileges.authInfo.authenticatedUsers[0].user='admin',f=>f.privileges.authInfo.authenticatedUserPrivileges.push({resource:{db:'foreign',collection:''},actions:['insert']}),f=>f.grant.value.linux.sealedReceipts.pop(),f=>f.grant.value.privateProvider.run='99124:1']){
  const f=fixture();change(f);const adapters=historicalProductionReadAdapters({context:f.context,execution:f.execution,manifestSha256:f.context.manifestSha256,client:f.client,token:f.credentials.ghToken,readConfig:f.readConfig},f.deps);
  await assert.rejects(adapters.readProtectedAdmission());assert(!f.calls.includes('original-canonical'));f.recipient.close();
 }
});
test('current native idle/full ending/1782 lease gates reject active source, changing markers and live indexed leases',async()=>{
 for(const change of [f=>f.source.value.status='running',f=>f.source.value.endedProofHash='e'.repeat(64),f=>f.profile.payload.games.pop(),f=>f.deps.verifyFederation=async()=>{f.source.value.changed=true;},f=>{const original=f.client.db;f.client.db=name=>{const d=original(name),c=d.collection;d.collection=n=>{const col=c(n),find=col.find;col.find=(q,o)=>({toArray:async()=>n==='capture_state_v2'?[{_id:q._id.$in[0],value:{expiresAt:Date.now()+60000}}]:await find(q,o).toArray()});return col;};return d;};}]){
  const f=fixture();change(f);await assert.rejects(verifyHistoricalNativeEnding({execution:f.execution,store:historicalNativeReadStore(f.client),readConfig:f.readConfig,readGithub:f.readGithub,verifyFederation:f.deps.verifyFederation}));f.recipient.close();
 }
 const f=fixture();await assert.rejects(verifyHistoricalNativeEnding({execution:f.execution,store:historicalNativeReadStore(f.client),readConfig:f.readConfig,readGithub:f.readGithub}));f.recipient.close();
});
test('unknown actual adapter read or changed protected readback is consumed once without later gates or reconnect',async()=>{
 const f=fixture();let count=0;f.deps.readGithub=async()=>{count++;throw Error('synthetic-private-unknown');};const a=historicalProductionReadAdapters({context:f.context,execution:f.execution,manifestSha256:f.context.manifestSha256,client:f.client,token:f.credentials.ghToken,readConfig:f.readConfig},f.deps);
 await assert.rejects(a.readGithub('repos/x'));await assert.rejects(a.readGithub('repos/x'));await assert.rejects(a.readProtectedAdmission());assert.equal(count,1);assert.equal(f.calls.length,0);f.recipient.close();
 const g=fixture();g.deps.verifyFederation=async()=>{g.grant.value.changed=true;};const b=historicalProductionReadAdapters({context:g.context,execution:g.execution,manifestSha256:g.context.manifestSha256,client:g.client,token:g.credentials.ghToken,readConfig:g.readConfig},g.deps);
 const snapshot=await b.readProtectedAdmission();snapshot.grant=structuredClone(snapshot.grant);await assert.rejects(b.verifyNativeEnding({protectedRead:snapshot}));g.recipient.close();
});
test('actual Node encrypted file write/fsync and independently opened full readback return the complete private bytes',async()=>{
 const f=fixture(),d=await disk(f);try{const sink=historicalEncryptedDurableSink({binding:f.execution.privateEvidenceSink,context:f.context,grant:f.grant,key:f.evidenceKey},{fs:d.io,platform:'linux'}),b=report(f),r=receipt(f);
  await sink.writePrivate(b,r);const names=await fsp.readdir(d.dir);assert.equal(names.length,1);const packed=await fsp.readFile(path.join(d.dir,names[0]));assert(!packed.includes(Buffer.from('never-on-disk-in-plaintext')));assert(!packed.includes(Buffer.from('sg-historical-labomba-run-v1')));
  const full=await sink.readPrivate(r);assert(full.equals(b));full.fill(0);await assert.rejects(sink.readPrivate(r));await assert.rejects(sink.writePrivate(b,r));b.fill(0);
 }finally{await d.dispose();f.recipient.close();}
});
test('existing ciphertext, failed fsync and changed full ciphertext retain evidence and prohibit a second sink write',async()=>{
 for(const mode of ['existing','fsync','changed']){const f=fixture(),d=await disk(f);try{
  const original=d.io.open;let writes=0;d.io.open=async(...argv)=>{const h=await original(...argv);if(argv[0]!==f.execution.privateEvidenceSink.directory){const write=h.writeFile;h.writeFile=async b=>{writes++;return write(b);};if(mode==='fsync')h.sync=async()=>{throw Error('synthetic-secret-unknown');};}return h;};
  const sink=historicalEncryptedDurableSink({binding:f.execution.privateEvidenceSink,context:f.context,grant:f.grant,key:f.evidenceKey},{fs:d.io,platform:'linux'}),b=report(f),r=receipt(f),file=path.join(d.dir,r.challengeHash+'.encrypted-evidence.json');
  if(mode==='existing')await fsp.writeFile(file,'already-present');
  if(mode==='changed'){await sink.writePrivate(b,r);const v=JSON.parse(await fsp.readFile(file));v.tag='A'.repeat(22);await fsp.writeFile(file,JSON.stringify(v));await assert.rejects(sink.readPrivate(r));}
  else await assert.rejects(sink.writePrivate(b,r));await assert.rejects(sink.writePrivate(b,r));assert.equal(writes,mode==='existing'?0:1);assert.equal((await fsp.readdir(d.dir)).length,1);b.fill(0);
 }finally{await d.dispose();f.recipient.close();}}
});
test('private durable sink rejects self-configured approval, key mismatch and unsafe directory before creating any file',async()=>{
 const f=fixture();assert.throws(()=>historicalEncryptedDurableSink({binding:f.execution.privateEvidenceSink,context:f.context,grant:{value:{}},key:f.evidenceKey}));assert.throws(()=>historicalEncryptedDurableSink({binding:f.execution.privateEvidenceSink,context:f.context,grant:f.grant,key:randomBytes(32)},{platform:'linux'}));
 const d=await disk(f,{lstat:async()=>({isDirectory:()=>true,isSymbolicLink:()=>true,uid:1000,mode:0o777})});try{const sink=historicalEncryptedDurableSink({binding:f.execution.privateEvidenceSink,context:f.context,grant:f.grant,key:f.evidenceKey},{fs:d.io,platform:'linux'});await assert.rejects(sink.writePrivate(report(f),receipt(f)));assert.equal((await fsp.readdir(d.dir)).length,0);}finally{await d.dispose();f.recipient.close();}
});
test('production sender orchestrates real crypto through original-adapter fixtures and an actual encrypted full file readback',async()=>{
 const f=fixture(),d=await disk(f);try{
  const sender=await prepareHistoricalPrivateSender(args(f),{adapters:a=>historicalProductionReadAdapters(a,f.deps),sink:a=>historicalEncryptedDurableSink(a,{fs:d.io,platform:'linux'})});
  assert.equal(f.credentials.password,undefined);assert(f.evidenceKey.every(b=>b===0));const auth=f.recipient.acceptCredentials(sender.credentialPacket);assert.equal(auth.password,'synthetic-private-password');
  const b=report(f),packet=f.recipient.evidence(b),ack=await sender.acceptEvidence(packet);assert.equal(f.recipient.acceptReceipt(ack).evidenceSha256,hash(b));await assert.rejects(sender.acceptEvidence(packet));sender.close();b.fill(0);
 }finally{await d.dispose();f.recipient.close();}
});
async function post(port,route,value){const bytes=Buffer.from(JSON.stringify(value));return new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port,path:route,method:'POST',agent:false,headers:{'content-type':'application/json','content-length':bytes.length}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,value:JSON.parse(Buffer.concat(chunks))}));});r.on('error',reject);r.end(bytes);});}
test('actual Node fixed HTTP handler relays only one encrypted credential/evidence pair, and rejects replay',async()=>{
 const f=fixture(),d=await disk(f);let sender;const handler=historicalFixedPrivateIoHandler({context:f.context,config:f.config,exchangePrivate:async frame=>{
  if(frame.phase==='credentials'){sender=await prepareHistoricalPrivateSender(args(f),{adapters:a=>historicalProductionReadAdapters(a,f.deps),sink:a=>historicalEncryptedDurableSink(a,{fs:d.io,platform:'linux'})});return sender.credentialPacket;}return sender.acceptEvidence(frame.packet);
 }});const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  const port=server.address().port,first=await post(port,'/sg-historical-32723/credentials',f.recipient.challenge);assert.equal(first.status,200);assert(!JSON.stringify(first).includes('synthetic-private-password'));f.recipient.acceptCredentials(first.value);
  const second=await post(port,'/sg-historical-32723/evidence',f.recipient.evidence(report(f)));assert.equal(second.status,200);assert.equal(f.recipient.acceptReceipt(second.value).fullReadback,true);
  assert.equal((await post(port,'/sg-historical-32723/credentials',f.recipient.challenge)).status,409);
 }finally{await new Promise(r=>server.close(r));sender?.close();await d.dispose();f.recipient.close();}
});
test('fixed relay refuses private plaintext/foreign routes and consumed private frame exchanges never retry',async()=>{
 const f=fixture();let calls=0;const server=http.createServer(historicalFixedPrivateIoHandler({context:f.context,config:f.config,exchangePrivate:async()=>{calls++;return {password:'synthetic-private-password'};}}));await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const r=await post(server.address().port,'/sg-historical-32723/credentials',f.recipient.challenge);assert.equal(r.status,409);assert(!JSON.stringify(r).includes('synthetic-private-password'));assert.equal((await post(server.address().port,'/foreign',{})).status,409);assert.equal(calls,1);}finally{await new Promise(r=>server.close(r));f.recipient.close();}
 const input=new PassThrough(),output=new PassThrough(),io=historicalPrivateFrameExchange({input,output});let emitted=0;output.on('data',()=>emitted++);
 const frame={schema:'sg-historical-fixed-private-exchange-v1',phase:'credentials',context:{synthetic:true},challengeHash:'a'.repeat(64),packet:{synthetic:'public'}};
 const request=io.exchange(frame);input.end('{"foreign":"synthetic-private-error"}\n');await assert.rejects(request);await assert.rejects(io.exchange(frame));assert.equal(emitted,1);io.close();
});
test('sender bootstrap is strict private EOF input; disabled actual sender and TLS server entries read no input or network',async()=>{
 const f=fixture();for(const change of [v=>v.extra=true,v=>v.credentials.gameId=32731,v=>v.evidenceKey='malformed']){const v={schema:'sg-historical-private-sender-bootstrap-v1',credentials:structuredClone(f.credentials),signingPrivateKey:'synthetic-key',evidenceKey:f.evidenceKey.toString('base64url')};change(v);const stream=new PassThrough();const p=readHistoricalSenderBootstrap({input:stream,context:f.context});stream.end(JSON.stringify(v));await assert.rejects(p);}
 assert.throws(()=>createHistoricalFixedPrivateServer({context:f.context,execution:f.execution,grant:{value:{}},tlsPrivateKey:'synthetic-invalid',tlsCertificate:'synthetic-invalid',exchangePrivate:async()=>{}}));
 for(const name of ['sender','fixed-io']){const child=spawn(process.execPath,['scripts/runner-v2/ag-rolling/sg-historical-provider-'+name+'.mjs'],{stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.stdin.end('synthetic-unread-secret');const code=await new Promise(r=>child.on('close',r));assert.equal(code,2);assert(output.includes('DISABLED_NO_INPUT_OR_NETWORK'));assert(!output.includes('synthetic'));}f.recipient.close();
});
test('actual Mongo connector uses only the own minimum user and closes once on expanded privilege or unknown connect',async()=>{
 const f=fixture();for(const unknown of [false,true]){let created=0,connected=0,closed=0;class Mongo{constructor(url,options){created++;assert.equal(url,'mongodb://52.87.94.113:27017');assert.equal(options.auth.username,HISTORICAL_USER);assert.equal(options.retryReads,false);assert.equal(options.retryWrites,false);}async connect(){connected++;if(unknown)throw Error('synthetic-secret-unknown');}db(){return {command:async()=>({authInfo:{authenticatedUsers:[{user:'admin',db:'admin'}],authenticatedUserPrivileges:[]}})};}async close(){closed++;}}
  await assert.rejects(openHistoricalSenderMongo({password:'synthetic-private-password',execution:f.execution},{MongoClient:Mongo}),e=>e.message==='HISTORICAL_PRIVATE_SENDER_MONGO_STOP_NO_RETRY');assert.equal(created,1);assert.equal(connected,1);assert.equal(closed,1);}f.recipient.close();
});
test('the full sender runtime exchanges exactly two private frames and returns one durable encrypted ACK',async()=>{
 const f=fixture(),d=await disk(f),input=new PassThrough(),toSender=new PassThrough(),toRelay=new PassThrough(),frames=historicalPrivateFrameExchange({input:toRelay,output:toSender});
 const bootstrap={schema:'sg-historical-private-sender-bootstrap-v1',credentials:structuredClone(f.credentials),signingPrivateKey:f.signing.privateKey.export({format:'pem',type:'pkcs8'}),evidenceKey:f.evidenceKey.toString('base64url')};let publicFrames='';toRelay.on('data',b=>publicFrames+=b);toSender.on('data',b=>publicFrames+=b);
 const run=runHistoricalPrivateSender({execution:f.execution,input,privateInput:toSender,privateOutput:toRelay,manifestBytes:f.manifestBytes},{openMongo:async()=>f.client,
  adapters:a=>historicalProductionReadAdapters({...a,readConfig:f.readConfig},f.deps),sink:a=>historicalEncryptedDurableSink(a,{fs:d.io,platform:'linux'})});run.catch(()=>{});input.end(JSON.stringify(bootstrap));
 try{
  // Wait only for bootstrap setup in this local test; the external private pipes buffer the first frame.
  await new Promise(r=>setImmediate(r));const first={schema:'sg-historical-fixed-private-exchange-v1',phase:'credentials',context:f.context,challengeHash:historicalChallengeHash(f.recipient.challenge),packet:f.recipient.challenge};
  const signed=await frames.exchange(first);f.recipient.acceptCredentials(signed);const b=report(f),ack=await frames.exchange({...first,phase:'evidence',packet:f.recipient.evidence(b)});
  assert.equal(f.recipient.acceptReceipt(ack).evidenceSha256,hash(b));assert.equal(await run,true);assert.equal(f.calls.filter(v=>v==='close').length,1);assert.equal((await fsp.readdir(d.dir)).length,1);
  assert(!publicFrames.includes('synthetic-private-password')&&!publicFrames.includes('PRIVATE KEY')&&!publicFrames.includes('never-on-disk-in-plaintext'));b.fill(0);
 }finally{frames.close();await d.dispose();f.recipient.close();}
});
test('missing live annotation or unavailable approved private directory stops sender before returning credentials',async()=>{
 for(const mode of ['annotation','directory']){const f=fixture(),d=await disk(f,mode==='directory'?{lstat:async()=>{throw Error('synthetic-private-unknown');}}:{});try{
  if(mode==='annotation'){const read=f.deps.readGithub;f.deps.readGithub=p=>p.includes('/annotations?')?Promise.resolve([]):read(p);}
  await assert.rejects(prepareHistoricalPrivateSender(args(f),{adapters:a=>historicalProductionReadAdapters(a,f.deps),sink:a=>historicalEncryptedDurableSink(a,{fs:d.io,platform:'linux'})}));
  assert.equal(f.credentials.password,undefined);assert(f.evidenceKey.every(v=>v===0));assert.equal((await fsp.readdir(d.dir)).length,0);
  if(mode==='annotation')assert.equal(f.calls.length,0);
 }finally{await d.dispose();f.recipient.close();}}
});
test('native finite readback keeps the original 30 second limit and the recovered pair cannot be replaced by an ordinary ended result',async()=>{
 for(const mode of ['stale','no-closure','foreign-pair']){const f=fixture();let now=Date.now();const verify=async()=>{if(mode==='stale')now+=30001;return {primaryRun:'37314031299:1',secondaryRun:mode==='foreign-pair'?'99124:1':'37321135064:1',federationHash:digest(f.profile.federation),sourceRequests:0,closure:mode==='no-closure'?null:{syntheticOnly:true}};};
  await assert.rejects(verifyHistoricalNativeEnding({execution:f.execution,store:historicalNativeReadStore(f.client),readConfig:f.readConfig,readGithub:f.readGithub,now:()=>now,verifyFederation:verify}));f.recipient.close();
 }
});
