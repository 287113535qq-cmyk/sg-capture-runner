import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,createPublicKey,createPrivateKey,diffieHellman,hkdfSync,randomBytes,createCipheriv,createDecipheriv,sign,verify} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {parseHistoricalPrivateEnvelope} from './sg-historical-private-pipe.mjs';
import {HISTORICAL_BRANCH} from './sg-historical-labomba-actor.mjs';
import {consumeHistoricalProviderAttestation} from './sg-historical-provider-attestation.mjs';

const REPO='zyzuoyang/sg-capture-runner',WORKFLOW='.github/workflows/historical-labomba.yml';
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=v=>Buffer.from(stable(v));
const publicDer=k=>k.export({format:'der',type:'spki'}).toString('base64url');
function publicKey(value,type){
 assert(typeof value==='string'&&/^[A-Za-z0-9_-]{50,100}$/.test(value));
 const key=createPublicKey({key:Buffer.from(value,'base64url'),format:'der',type:'spki'});
 assert(key.asymmetricKeyType===type&&publicDer(key)===value);return key;
}
function fixedError(){return Error('HISTORICAL_PRIVATE_PROVIDER_STOP_NO_RETRY');}
function fields(v,expected){assert(v&&Object.keys(v).sort().join(',')===[...expected].sort().join(','));}
export function assertHistoricalProviderConfiguration(config){
 try{
  assert(config?.schema==='sg-historical-private-provider-v1'&&config.enabled===true);
  const url=new URL(config.endpoint);
  assert(url.protocol==='https:'&&url.hostname==='52.87.94.113'&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/sg-historical-32723');
  assert(/^[a-f0-9]{64}$/.test(config.tlsSpkiSha256??''));publicKey(config.signingPublicKey,'ed25519');
  assert(config.signingPublicKeySha256===hash(Buffer.from(config.signingPublicKey,'base64url')));
  return config;
 }catch{throw fixedError();}
}
export function historicalProviderContext(env,manifestSha256){
 try{
  assert(env.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Linux'&&env.RUNNER_ENVIRONMENT==='github-hosted'
   &&env.GITHUB_REPOSITORY===REPO&&env.GITHUB_REF==='refs/heads/'+HISTORICAL_BRANCH&&env.GITHUB_JOB==='ag-rolling-business-delivery'
   &&env.GITHUB_RUN_ATTEMPT==='1'&&/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID??'')&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')
   &&/^[1-9][0-9]*$/.test(env.SG_BUSINESS_LINUX_RUN??'')&&env.SG_BUSINESS_GAME_IDS==='32723'&&/^[a-f0-9]{64}$/.test(manifestSha256));
  return {gameId:32723,repository:REPO,branch:HISTORICAL_BRANCH,workflow:WORKFLOW,job:'ag-rolling-business-delivery',run:env.GITHUB_RUN_ID+':1',commit:env.GITHUB_SHA,linuxRun:env.SG_BUSINESS_LINUX_RUN,manifestSha256};
 }catch{throw fixedError();}
}
export function assertHistoricalProviderChallenge(challenge,context,now=Date.now()){
 try{
  fields(context,['gameId','repository','branch','workflow','job','run','commit','linuxRun','manifestSha256']);
  assert(context.gameId===32723&&context.repository===REPO&&context.branch===HISTORICAL_BRANCH&&context.workflow===WORKFLOW&&context.job==='ag-rolling-business-delivery'
   &&/^[1-9][0-9]*:1$/.test(context.run)&&/^[a-f0-9]{40}$/.test(context.commit)&&/^[1-9][0-9]*$/.test(context.linuxRun)&&/^[a-f0-9]{64}$/.test(context.manifestSha256));
  fields(challenge,['schema','context','recipientPublicKey','nonce','createdAt','expiresAt']);
  assert(challenge.schema==='sg-historical-private-challenge-v1'&&stable(challenge.context)===stable(context));
  publicKey(challenge.recipientPublicKey,'x25519');
  assert(/^[a-f0-9]{64}$/.test(challenge.nonce)&&Number.isSafeInteger(challenge.createdAt)&&Number.isSafeInteger(challenge.expiresAt)
   &&challenge.expiresAt-challenge.createdAt===60000&&now>=challenge.createdAt&&now<challenge.expiresAt);
  return challenge;
 }catch{throw fixedError();}
}
function derive(privateKey,peer,challengeHash){
 const shared=diffieHellman({privateKey,publicKey:publicKey(peer,'x25519')});
 try{return Object.fromEntries(['credentials','evidence','receipt'].map(p=>[p,Buffer.from(hkdfSync('sha256',shared,Buffer.from(challengeHash,'hex'),'sg-historical-provider-v1/'+p,32))]));}
 finally{shared.fill(0);}
}
function seal(phase,plain,key,challengeHash){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(bytes({phase,challengeHash}));
 const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
 return {phase,challengeHash,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),ciphertext:ciphertext.toString('base64url')};
}
function open(packet,phase,key,challengeHash,maxBytes){
 fields(packet,['phase','challengeHash','iv','tag','ciphertext']);
 assert(packet.phase===phase&&packet.challengeHash===challengeHash);
 const decode=(v,length)=>{assert(typeof v==='string'&&/^[A-Za-z0-9_-]+$/.test(v));const b=Buffer.from(v,'base64url');assert(b.toString('base64url')===v&&(!length||b.length===length));return b;};
 const iv=decode(packet.iv,12),tag=decode(packet.tag,16),ciphertext=decode(packet.ciphertext);
 assert(ciphertext.length>0&&ciphertext.length<=maxBytes);
 const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(bytes({phase,challengeHash}));decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(ciphertext),decipher.final()]);
}
function evidenceIdentity(plain,context){
 assert(Buffer.isBuffer(plain)&&plain.length>0&&plain.length<=4*1024*1024);
 const v=JSON.parse(plain.toString('utf8'));
 assert(v.schema==='sg-historical-labomba-run-v1'&&v.owner===context.run+':historical-32723'&&v.commit===context.commit
  &&v.linuxProof?.run===Number(context.linuxRun)&&v.linuxProof.commit===context.commit&&v.linuxProof.joinedCommands===14
  &&v.sourceRequests===0&&v.nativeWrites===0&&typeof v.complete==='boolean');return v;
}
export function createHistoricalRecipient({context,config,now=Date.now()}){
 context=structuredClone(context);config=structuredClone(config);
 assertHistoricalProviderConfiguration(config);
 let privateKey;({privateKey}=generateKeyPairSync('x25519'));let keys=null,state='challenge',evidenceHash=null,evidenceSize=null;
 const challenge={schema:'sg-historical-private-challenge-v1',context,recipientPublicKey:publicDer(createPublicKey(privateKey)),nonce:randomBytes(32).toString('hex'),createdAt:now,expiresAt:now+60000};
 assertHistoricalProviderChallenge(challenge,context,now);const challengeHash=hash(bytes(challenge));
 const close=()=>{state='closed';privateKey=null;if(keys)Object.values(keys).forEach(b=>b.fill(0));keys=null;};
 return {get challenge(){return structuredClone(challenge);},challengeHash,close,
  acceptCredentials(signed,at=Date.now()){
   let plain;
   try{
    assert(state==='challenge');state='credentials-consumed';assertHistoricalProviderChallenge(challenge,context,at);
    fields(signed,['schema','providerPublicKey','packet','signature']);
    assert(signed.schema==='sg-historical-signed-credentials-v1');publicKey(signed.providerPublicKey,'x25519');
    assert(typeof signed.signature==='string'&&/^[A-Za-z0-9_-]{86}$/.test(signed.signature)
     &&verify(null,bytes({schema:signed.schema,providerPublicKey:signed.providerPublicKey,packet:signed.packet}),publicKey(config.signingPublicKey,'ed25519'),Buffer.from(signed.signature,'base64url')));
    keys=derive(privateKey,signed.providerPublicKey,challengeHash);privateKey=null;
    plain=open(signed.packet,'credentials',keys.credentials,challengeHash,131071);
    const auth=parseHistoricalPrivateEnvelope(plain,{GITHUB_RUN_ID:context.run.split(':')[0],GITHUB_SHA:context.commit});
    keys.credentials.fill(0);state='actor';return auth;
   }catch{close();throw fixedError();}finally{plain?.fill(0);}
  },
  evidence(plain){try{assert(state==='actor');state='evidence-consumed';evidenceIdentity(plain,context);evidenceHash=hash(plain);evidenceSize=plain.length;
   const packet=seal('evidence',plain,keys.evidence,challengeHash);keys.evidence.fill(0);return packet;
  }catch{close();throw fixedError();}},
  acceptReceipt(packet){let plain;try{assert(state==='evidence-consumed');state='receipt-consumed';plain=open(packet,'receipt',keys.receipt,challengeHash,4096);
   const v=JSON.parse(plain);assert(stable(v)===stable({schema:'sg-historical-private-evidence-receipt-v1',context,challengeHash,evidenceSha256:evidenceHash,evidenceBytes:evidenceSize,fullReadback:true}));close();return v;
  }catch{close();throw fixedError();}finally{plain?.fill(0);}}
 };
}
// The caller must first obtain the actual read-only attestation. This function only transports private bytes.
export function createHistoricalProvider({challenge,context,config,signingPrivateKey,credentials,attestation,now=Date.now()}){
 challenge=structuredClone(challenge);context=structuredClone(context);config=structuredClone(config);
 let keys=null,state='new';const close=()=>{state='closed';if(keys)Object.values(keys).forEach(b=>b.fill(0));keys=null;};let plain;
 try{
  assertHistoricalProviderConfiguration(config);assertHistoricalProviderChallenge(challenge,context,now);
  const challengeHash=hash(bytes(challenge));
  assert(consumeHistoricalProviderAttestation(attestation)&&attestation.schema==='sg-historical-hosted-private-attestation-v1'&&attestation.challengeHash===challengeHash&&stable(attestation.context)===stable(context)
   &&attestation.originalCanonicalVerified===true&&attestation.ownLinux14Sealed9Verified===true&&attestation.minimumGrantVerified===true
   &&attestation.nativeIdleAndEndedFederationVerified===true&&attestation.protectedProviderBindingVerified===true
   &&now>=attestation.observedAt&&now-attestation.observedAt<10000);
  const signing=createPrivateKey(signingPrivateKey);assert(signing.asymmetricKeyType==='ed25519'&&publicDer(createPublicKey(signing))===config.signingPublicKey);
  plain=Buffer.from(JSON.stringify(credentials));parseHistoricalPrivateEnvelope(plain,{GITHUB_RUN_ID:context.run.split(':')[0],GITHUB_SHA:context.commit});
  const ephemeral=generateKeyPairSync('x25519');keys=derive(ephemeral.privateKey,challenge.recipientPublicKey,challengeHash);
  const body={schema:'sg-historical-signed-credentials-v1',providerPublicKey:publicDer(ephemeral.publicKey),packet:seal('credentials',plain,keys.credentials,challengeHash)};
  keys.credentials.fill(0);state='evidence';const credentialPacket={...body,signature:sign(null,bytes(body),signing).toString('base64url')};
  return {credentialPacket,close,async acceptEvidence(packet,{writePrivate,readPrivate}){
   let value,readback;
   try{assert(state==='evidence');state='evidence-consumed';value=open(packet,'evidence',keys.evidence,challengeHash,4*1024*1024);evidenceIdentity(value,context);
    keys.evidence.fill(0);const receipt={schema:'sg-historical-private-evidence-receipt-v1',context,challengeHash,evidenceSha256:hash(value),evidenceBytes:value.length,fullReadback:true};
    await writePrivate(value,receipt);readback=await readPrivate(receipt);
    assert(Buffer.isBuffer(readback)&&readback.length===value.length&&readback.equals(value));
    const ack=seal('receipt',bytes(receipt),keys.receipt,challengeHash);close();return ack;
   }catch{close();throw fixedError();}finally{value?.fill(0);readback?.fill(0);}
  }};
 }catch{close();throw fixedError();}finally{plain?.fill(0);}
}
export const historicalChallengeHash=challenge=>hash(bytes(challenge));
