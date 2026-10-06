import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {assertOwnHistoricalPrivileges,HISTORICAL_USER} from './sg-historical-labomba-actor.mjs';
import {parseHistoricalPrivateEnvelope,rejectHistoricalCredentialEnvironment} from './sg-historical-private-pipe.mjs';
import {stable} from '../mongo-writer.mjs';
import {assertHistoricalProviderConfiguration,assertHistoricalProviderChallenge,createHistoricalProvider} from './sg-historical-provider-channel.mjs';
import {attestHistoricalHostedChallenge} from './sg-historical-provider-attestation.mjs';
import {historicalProductionReadAdapters} from './sg-historical-provider-adapters.mjs';
import {historicalEncryptedDurableSink} from './sg-historical-provider-sink.mjs';
import {historicalLauncherConfiguration,assertHistoricalLauncherBinding,historicalInheritedPipeAdmission} from './sg-historical-private-launcher.mjs';
const read=name=>{assert(name==='ag-historical-labomba-execution.json'||name==='demo-pilot-beaver-20260930.json'||/^ag-rolling-queue-[a-f0-9]{64}\.json$/.test(name));return JSON.parse(fs.readFileSync('config/'+name));};
export function historicalSenderPreauth(execution=read('ag-historical-labomba-execution.json')){
 assert(execution.enabled===true&&execution.minimumPermissionApproved===true&&execution.linuxPermissionGranted===true
  &&execution.fixedPrivateIoService?.enabled===true&&execution.privateEvidenceSink?.enabled===true,'HISTORICAL_PRIVATE_SENDER_DISABLED');
 assertHistoricalProviderConfiguration(execution.privateProvider);historicalLauncherConfiguration(execution);return execution;
}
export async function openHistoricalSenderMongo({password,execution},dependencies={}){
 const require=createRequire(import.meta.url),MongoClient=dependencies.MongoClient??require('../../../collector/node_modules/mongodb').MongoClient;
 const client=new MongoClient('mongodb://52.87.94.113:27017',{auth:{username:HISTORICAL_USER,password},authSource:'admin',authMechanism:'SCRAM-SHA-1',retryReads:false,retryWrites:false,
  maxPoolSize:2,connectTimeoutMS:10000,serverSelectionTimeoutMS:10000,socketTimeoutMS:30000});
 try{await client.connect();assertOwnHistoricalPrivileges(await client.db('admin').command({connectionStatus:1,showPrivileges:true}),execution.permission);return client;}
 catch{await client.close().catch(()=>{});throw Error('HISTORICAL_PRIVATE_SENDER_MONGO_STOP_NO_RETRY');}
}
// One external sender attempt; this module releases no bytes before actual attestation.
// The native server relay does not invoke this orchestrator or gain its GitHub credential.
export async function prepareHistoricalPrivateSender({challenge,execution,manifestBytes,credentials,signingPrivateKey,evidenceKey,client,readConfig=read},dependencies={}){
 let provider,sink,protectedSnapshot;
 try{
  historicalSenderPreauth(execution);const context=structuredClone(challenge.context),manifestSha256=createHash('sha256').update(manifestBytes).digest('hex');
  assertHistoricalProviderChallenge(challenge,context);assert(manifestSha256===context.manifestSha256);
  const adapters=(dependencies.adapters??historicalProductionReadAdapters)({context,execution,manifestSha256,client,token:credentials.ghToken,readConfig});
  const readProtectedAdmission=async()=>{protectedSnapshot=await adapters.readProtectedAdmission();return protectedSnapshot;};
  const attestation=await attestHistoricalHostedChallenge({challenge,context,execution,...adapters,readProtectedAdmission});
  assertHistoricalLauncherBinding(execution,context,protectedSnapshot.grant);
  assert(stable(protectedSnapshot.grant.value.fixedPrivateIoService)===stable({...execution.fixedPrivateIoService,endpoint:execution.privateProvider.endpoint,
   tlsSpkiSha256:execution.privateProvider.tlsSpkiSha256,privateInheritedPipes:true}),'HISTORICAL_PROTECTED_FIXED_IO_REQUIRED');
  sink=(dependencies.sink??historicalEncryptedDurableSink)({binding:execution.privateEvidenceSink,context,grant:protectedSnapshot.grant,key:evidenceKey});
  await sink.prepare();
  provider=createHistoricalProvider({challenge,context,config:execution.privateProvider,credentials,signingPrivateKey,attestation});
  for(const key of ['password','ghToken','nativeSshPrivateKey','historicalSshPrivateKey'])delete credentials[key];evidenceKey.fill(0);signingPrivateKey=null;
  return Object.freeze({credentialPacket:provider.credentialPacket,acceptEvidence:packet=>provider.acceptEvidence(packet,sink),close(){provider.close();sink.close();}});
 }catch{provider?.close();sink?.close();throw Error('HISTORICAL_PRIVATE_SENDER_STOP_NO_RETRY');}
 finally{evidenceKey?.fill(0);for(const name of ['password','ghToken','nativeSshPrivateKey','historicalSshPrivateKey'])delete credentials?.[name];}
}
export async function readHistoricalSenderBootstrap({input=process.stdin,context,timeoutMs=60000}){
 const chunks=[];let size=0,timer;
 try{
  const bytes=await Promise.race([new Promise((resolve,reject)=>{input.on('data',b=>{size+=b.length;if(size>196608){reject(Error());input.destroy();return;}chunks.push(b);});input.once('error',reject);input.once('end',()=>resolve(Buffer.concat(chunks)));}),
   new Promise((_resolve,reject)=>{timer=setTimeout(()=>{input.destroy();reject(Error());},timeoutMs);})]);
  try{const v=JSON.parse(bytes);assert(Object.keys(v).sort().join(',')==='credentials,evidenceKey,schema,signingPrivateKey'&&v.schema==='sg-historical-private-sender-bootstrap-v1');
   const auth=Buffer.from(JSON.stringify(v.credentials));try{parseHistoricalPrivateEnvelope(auth,{GITHUB_RUN_ID:context.run.split(':')[0],GITHUB_SHA:context.commit});}finally{auth.fill(0);}
   assert(typeof v.signingPrivateKey==='string'&&v.signingPrivateKey.length<16384&&typeof v.evidenceKey==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v.evidenceKey));
   const evidenceKey=Buffer.from(v.evidenceKey,'base64url');assert(evidenceKey.length===32&&evidenceKey.toString('base64url')===v.evidenceKey);delete v.evidenceKey;
   return {credentials:v.credentials,signingPrivateKey:v.signingPrivateKey,evidenceKey};
  }finally{bytes.fill(0);}
 }catch{throw Error('HISTORICAL_PRIVATE_SENDER_INPUT_STOP_NO_RETRY');}finally{clearTimeout(timer);chunks.forEach(b=>b.fill(0));}
}
export function historicalSenderFrameReader(input,context){
 let buffer=Buffer.alloc(0),pending=null,stopped=false;const used=new Set();
 const close=()=>{stopped=true;buffer.fill(0);buffer=Buffer.alloc(0);if(pending){clearTimeout(pending.timer);pending.reject(Error('HISTORICAL_PRIVATE_SENDER_FRAME_STOP_NO_RETRY'));pending=null;}};
 input.on('error',close);input.on('end',close);input.on('data',b=>{try{assert(!stopped&&pending);buffer=Buffer.concat([buffer,b]);assert(buffer.length<=6*1024*1024);const end=buffer.indexOf(10);if(end<0)return;assert(end===buffer.length-1);
  const v=JSON.parse(buffer);assert(Object.keys(v).sort().join(',')==='challengeHash,context,packet,phase,schema'&&v.schema==='sg-historical-fixed-private-exchange-v1'
   &&v.phase===pending.phase&&stable(v.context)===stable(context)&&/^[a-f0-9]{64}$/.test(v.challengeHash));const p=pending;pending=null;clearTimeout(p.timer);buffer.fill(0);buffer=Buffer.alloc(0);p.resolve(v);
 }catch{close();}});
 return Object.freeze({close,receive:(phase,timeoutMs)=>new Promise((resolve,reject)=>{try{assert(!stopped&&!pending&&!used.has(phase)&&['credentials','evidence'].includes(phase));used.add(phase);pending={phase,resolve,reject,timer:setTimeout(close,timeoutMs)};}catch{close();reject(Error('HISTORICAL_PRIVATE_SENDER_FRAME_STOP_NO_RETRY'));}})});
}
async function writeFrame(output,frame){const bytes=Buffer.from(JSON.stringify(frame)+'\n');assert(bytes.length<=6*1024*1024);try{await new Promise((resolve,reject)=>output.write(bytes,e=>e?reject(e):resolve()));}finally{bytes.fill(0);}}
export async function runHistoricalPrivateSender({execution=historicalSenderPreauth(),input=process.stdin,privateInput,privateOutput,manifestBytes=fs.readFileSync('config/ag-historical-labomba-manifest.json')}={},dependencies={}){
 historicalSenderPreauth(execution);rejectHistoricalCredentialEnvironment(process.env);
 (dependencies.verifyInheritedPipes??historicalInheritedPipeAdmission)({execution,role:'sender'});
 const context=execution.fixedPrivateIoService.context;let auth,client,provider,frames;
 try{
  auth=await readHistoricalSenderBootstrap({input,context});client=await(dependencies.openMongo??openHistoricalSenderMongo)({password:auth.credentials.password,execution});
  frames=historicalSenderFrameReader(privateInput,context);const first=await frames.receive('credentials',60000);
  const {historicalChallengeHash}=await import('./sg-historical-provider-channel.mjs');assert(first.challengeHash===historicalChallengeHash(first.packet));
  provider=await prepareHistoricalPrivateSender({challenge:first.packet,execution,manifestBytes,...auth,client},dependencies);auth=null;
  const next=frames.receive('evidence',330*60000);next.catch(()=>{});
  await writeFrame(privateOutput,{...first,packet:provider.credentialPacket});const evidence=await next;assert(evidence.challengeHash===first.challengeHash);
  const receipt=await provider.acceptEvidence(evidence.packet);await writeFrame(privateOutput,{...evidence,packet:receipt});return true;
 }catch{throw Error('HISTORICAL_PRIVATE_SENDER_STOP_NO_RETRY');}
 finally{frames?.close();provider?.close();auth?.evidenceKey?.fill(0);if(auth)for(const k of ['password','ghToken','nativeSshPrivateKey','historicalSshPrivateKey'])delete auth.credentials[k];await client?.close().catch(()=>{});}
}
// A separately approved launcher supplies FD3/FD4. No private value enters arguments or environment.
if(process.argv[1]&&fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])){
 let entered=false;
 try{assert(process.argv.length===2);const execution=historicalSenderPreauth();
  entered=true;
  await runHistoricalPrivateSender({execution,privateInput:fs.createReadStream(null,{fd:3,autoClose:false}),privateOutput:fs.createWriteStream(null,{fd:4,autoClose:false})});}
 catch{process.stderr.write(entered?'HISTORICAL_PRIVATE_SENDER_STOP_NO_RETRY\n':'HISTORICAL_PRIVATE_SENDER_DISABLED_NO_INPUT_OR_NETWORK\n');process.exitCode=2;}
}
