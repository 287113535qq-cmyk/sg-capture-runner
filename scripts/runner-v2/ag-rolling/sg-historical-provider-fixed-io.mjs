import assert from 'node:assert/strict';import https from 'node:https';
import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import {X509Certificate,createPublicKey,createHash,verify} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {assertHistoricalProviderConfiguration,assertHistoricalProviderChallenge,historicalChallengeHash} from './sg-historical-provider-channel.mjs';
import {assertOwnHistoricalGrant} from './sg-historical-labomba-actor.mjs';
import {assertHistoricalLauncherBinding,historicalInheritedPipeAdmission} from './sg-historical-private-launcher.mjs';
const fail=()=>Error('HISTORICAL_FIXED_PRIVATE_IO_STOP_NO_RETRY');
const exact=(v,keys)=>assert(v&&Object.keys(v).sort().join(',')===[...keys].sort().join(','));
function packet(v,phase,hash){exact(v,['phase','challengeHash','iv','tag','ciphertext']);assert(v.phase===phase&&v.challengeHash===hash);
 for(const[k,n]of[['iv',12],['tag',16],['ciphertext',0]]){assert(typeof v[k]==='string'&&/^[A-Za-z0-9_-]+$/.test(v[k]));const b=Buffer.from(v[k],'base64url');assert(b.toString('base64url')===v[k]&&(!n||b.length===n)&&b.length>0&&b.length<=4*1024*1024);}}
function credentials(v,hash,config){exact(v,['schema','providerPublicKey','packet','signature']);assert(v.schema==='sg-historical-signed-credentials-v1');packet(v.packet,'credentials',hash);
 assert(typeof v.providerPublicKey==='string'&&/^[A-Za-z0-9_-]{50,100}$/.test(v.providerPublicKey));const peer=createPublicKey({key:Buffer.from(v.providerPublicKey,'base64url'),type:'spki',format:'der'});
 assert(peer.asymmetricKeyType==='x25519'&&peer.export({type:'spki',format:'der'}).toString('base64url')===v.providerPublicKey);
 assert(typeof v.signature==='string'&&/^[A-Za-z0-9_-]{86}$/.test(v.signature)&&Buffer.from(v.signature,'base64url').toString('base64url')===v.signature&&verify(null,Buffer.from(stable({schema:v.schema,providerPublicKey:v.providerPublicKey,packet:v.packet})),
  createPublicKey({key:Buffer.from(config.signingPublicKey,'base64url'),type:'spki',format:'der'}),Buffer.from(v.signature,'base64url')));}
async function body(request){const chunks=[];let size=0;try{for await(const b of request){size+=b.length;assert(size<=6*1024*1024);chunks.push(b);}assert(request.complete!==false);return JSON.parse(Buffer.concat(chunks));}finally{chunks.forEach(b=>b.fill(0));}}
// A bounded relay only: encrypted packets on public HTTPS and inherited private I/O.
// There are no GitHub calls, Mongo writes, source engines, worker loops or dispatch operations here.
export function historicalFixedPrivateIoHandler({context,config,exchangePrivate,now=Date.now}){
 context=structuredClone(context);config=structuredClone(config);assertHistoricalProviderConfiguration(config);
 let state='credentials',challengeHash=null,createdAt=null;
 return async(request,response)=>{
  try{assert(request.method==='POST'&&!request.headers.authorization&&!request.headers.cookie&&request.headers['content-type']==='application/json');
   const phase=request.url=== '/sg-historical-32723/credentials'?'credentials':request.url==='/sg-historical-32723/evidence'?'evidence':null;
   assert(phase&&state===phase);state=phase+'-consumed';request.setTimeout?.(60000,()=>request.destroy());
   const value=await body(request);
   if(phase==='credentials'){assertHistoricalProviderChallenge(value,context,now());challengeHash=historicalChallengeHash(value);createdAt=value.createdAt;}
   else{assert(now()>=createdAt&&now()-createdAt<330*60000);packet(value,'evidence',challengeHash);}
   const result=await exchangePrivate({schema:'sg-historical-fixed-private-exchange-v1',phase,context,challengeHash,packet:value});
   if(phase==='credentials'){assertHistoricalProviderChallenge(value,context,now());credentials(result,challengeHash,config);state='evidence';}
   else{packet(result,'receipt',challengeHash);state='closed';}
   const encoded=Buffer.from(JSON.stringify(result));assert(encoded.length<=6*1024*1024);
   response.writeHead(200,{'content-type':'application/json','cache-control':'no-store','connection':'close'});response.end(encoded,()=>encoded.fill(0));
  }catch{state='closed';if(!response.headersSent)response.writeHead(409,{'content-type':'application/json','cache-control':'no-store','connection':'close'});
   response.end('{"error":"HISTORICAL_FIXED_PRIVATE_IO_STOP_NO_RETRY"}');}
 };
}
export function createHistoricalFixedPrivateServer({context,execution,grant,tlsPrivateKey,tlsCertificate,exchangePrivate,now=Date.now},dependencies={}){
 assertHistoricalLauncherBinding(execution,context,grant);
 const config=assertHistoricalProviderConfiguration(execution.privateProvider),service=execution.fixedPrivateIoService;
 assert(service?.schema==='sg-historical-fixed-private-io-service-v1'&&service.enabled===true&&stable(service.context)===stable(context)
  &&stable(grant?.value?.fixedPrivateIoService)===stable({...service,endpoint:config.endpoint,tlsSpkiSha256:config.tlsSpkiSha256,privateInheritedPipes:true}),'HISTORICAL_PROTECTED_FIXED_IO_REQUIRED');
 const cert=new X509Certificate(tlsCertificate),key=createPublicKey(tlsPrivateKey),der=cert.publicKey.export({type:'spki',format:'der'});
 assert(cert.checkIP('52.87.94.113')==='52.87.94.113'&&now()>=Date.parse(cert.validFrom)&&now()<Date.parse(cert.validTo)
  &&der.equals(key.export({type:'spki',format:'der'}))&&createHash('sha256').update(der).digest('hex')===config.tlsSpkiSha256,'HISTORICAL_FIXED_IO_TLS_BINDING');
 const server=(dependencies.createServer??https.createServer)({key:tlsPrivateKey,cert:tlsCertificate,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',requestTimeout:60000,headersTimeout:10000,keepAliveTimeout:1},
  historicalFixedPrivateIoHandler({context,config,exchangePrivate,now}));
 server.on('clientError',(_error,socket)=>socket.destroy());return server;
}
export function historicalPrivateFrameExchange({input,output}){
 let pending=null,buffer=Buffer.alloc(0),stopped=false;
 const stop=()=>{stopped=true;buffer.fill(0);buffer=Buffer.alloc(0);if(pending){clearTimeout(pending.timer);pending.reject(fail());pending=null;}};
 input.on('error',stop);input.on('end',stop);output.on('error',stop);
 input.on('data',chunk=>{try{assert(pending&&!stopped);buffer=Buffer.concat([buffer,chunk]);assert(buffer.length<=6*1024*1024);const end=buffer.indexOf(10);if(end<0)return;
  assert(end===buffer.length-1);const answer=JSON.parse(buffer);exact(answer,['schema','phase','context','challengeHash','packet']);assert(answer.schema==='sg-historical-fixed-private-exchange-v1'
   &&answer.phase===pending.value.phase&&answer.challengeHash===pending.value.challengeHash&&stable(answer.context)===stable(pending.value.context));
  const p=pending;pending=null;clearTimeout(p.timer);buffer.fill(0);buffer=Buffer.alloc(0);p.resolve(answer.packet);
 }catch{stop();}});
 const used=new Set();return Object.freeze({close:stop,exchange:value=>new Promise((resolve,reject)=>{try{assert(!stopped&&!pending&&!used.has(value.phase));used.add(value.phase);const encoded=Buffer.from(JSON.stringify(value)+'\n');assert(encoded.length<=6*1024*1024);
  pending={value:structuredClone(value),resolve,reject,timer:setTimeout(stop,60000)};output.write(encoded,e=>{encoded.fill(0);if(e)stop();});
 }catch{stop();reject(fail());}})});
}
export async function runHistoricalFixedPrivateServer({execution,input=process.stdin,privateInput,privateOutput},dependencies={}){
 const {historicalSenderPreauth,openHistoricalSenderMongo}=await import('./sg-historical-provider-sender.mjs');historicalSenderPreauth(execution);
 const {rejectHistoricalCredentialEnvironment}=await import('./sg-historical-private-pipe.mjs');rejectHistoricalCredentialEnvironment(process.env);
 (dependencies.verifyInheritedPipes??historicalInheritedPipeAdmission)({execution,role:'fixed-io'});
 let client,relay,server,bootstrap,bytes;const chunks=[];let timer;
 try{
  bytes=await Promise.race([new Promise((resolve,reject)=>{let size=0;input.on('data',b=>{size+=b.length;if(size>196608){input.destroy();reject(fail());return;}chunks.push(b);});input.once('error',reject);input.once('end',()=>resolve(Buffer.concat(chunks)));}),new Promise((_resolve,reject)=>{timer=setTimeout(()=>{input.destroy();reject(fail());},60000);})]);
  bootstrap=JSON.parse(bytes);exact(bootstrap,['schema','password','tlsPrivateKey','tlsCertificate']);assert(bootstrap.schema==='sg-historical-fixed-private-io-bootstrap-v1'
   &&typeof bootstrap.password==='string'&&bootstrap.password.length>0&&bootstrap.password.length<16384&&typeof bootstrap.tlsPrivateKey==='string'&&bootstrap.tlsPrivateKey.length<16384
   &&typeof bootstrap.tlsCertificate==='string'&&bootstrap.tlsCertificate.length<16384);bytes.fill(0);bytes=null;chunks.forEach(b=>b.fill(0));clearTimeout(timer);
  client=await(dependencies.openMongo??openHistoricalSenderMongo)({password:bootstrap.password,execution});delete bootstrap.password;
  const context=execution.fixedPrivateIoService.context,start=Date.now();
  const grant=await client.db('sg_capture_staging_v1').collection('capture_journal_v2').findOne({_id:execution.permission.grantKey},{hint:'_id_',maxTimeMS:15000});
  assertOwnHistoricalGrant(grant,execution,{GITHUB_RUN_ID:context.run.split(':')[0],GITHUB_SHA:context.commit,SG_BUSINESS_LINUX_RUN:context.linuxRun});assert(Date.now()-start<10000);
  relay=historicalPrivateFrameExchange({input:privateInput,output:privateOutput});
  server=createHistoricalFixedPrivateServer({context,execution,grant,tlsPrivateKey:bootstrap.tlsPrivateKey,tlsCertificate:bootstrap.tlsCertificate,exchangePrivate:relay.exchange});bootstrap=null;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(443,'0.0.0.0',resolve);});
  server.once('close',()=>{relay.close();client.close().catch(()=>{});});server.once('error',()=>{relay.close();server.close();});return server;
 }catch{relay?.close();server?.close();await client?.close().catch(()=>{});throw fail();}
 finally{clearTimeout(timer);bytes?.fill(0);chunks.forEach(b=>b.fill(0));bootstrap=null;}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])){
 let entered=false;
 try{assert(process.argv.length===2);const execution=JSON.parse(fs.readFileSync('config/ag-historical-labomba-execution.json'));
  const {historicalSenderPreauth}=await import('./sg-historical-provider-sender.mjs');historicalSenderPreauth(execution);entered=true;
  await runHistoricalFixedPrivateServer({execution,privateInput:fs.createReadStream(null,{fd:3,autoClose:false}),privateOutput:fs.createWriteStream(null,{fd:4,autoClose:false})});}
 catch{process.stderr.write(entered?'HISTORICAL_FIXED_PRIVATE_IO_STOP_NO_RETRY\n':'HISTORICAL_FIXED_PRIVATE_IO_DISABLED_NO_INPUT_OR_NETWORK\n');process.exitCode=2;}
}
