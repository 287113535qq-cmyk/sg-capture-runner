import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {analyzer} from '../analyzer.mjs';import {RunnerState} from '../state-store.mjs';import {ResourceGate} from '../resource-gate.mjs';
import {authenticatedRead} from '../github-boundary.mjs';
import {serializeTransport} from './sg-transport.mjs';import {digest} from './sg-business-delivery.mjs';
import {createAdmittedStrictControl} from './sg-ag-strict-entry.mjs';
import {assertOrdinaryPrivatePipes,receiveOrdinaryPrivateJson,parseOrdinaryCredentials} from './sg-ag-ordinary-private-pipes.mjs';
import {withOrdinaryMemoryIdentities,ordinaryChildEnvironment,ordinaryRtpHash} from './sg-ag-ordinary-memory-ssh.mjs';
import {connectOrdinaryMemoryGateway} from './sg-ag-ordinary-gateway.mjs';
import {verifyOwnStrictLinux} from './sg-ag-ordinary-linux.mjs';
import {assertOrdinaryProtectedGrant,assertOrdinaryPrivileges,createOrdinaryAdmission} from './sg-ag-ordinary-admission.mjs';
import {createPrivateControlWriter} from './sg-ag-private-control.mjs';
import {openOrdinaryPrivateEvidence} from './sg-ag-ordinary-private-evidence.mjs';
export const ordinaryPrivateEntryStatus=Object.freeze({schema:'sg-ag-ordinary-private-entry-status-v1',actualPortsConstructedOnlyAfterPrivateAdmission:true,
 enabled:false,productionLauncherBound:false,ownExactLinuxVerified:false,productionWalkthroughCompleted:false,newContinuationAllowed:false,sourceAllowance:0});
export const requiredOrdinaryRuntimeFiles=Object.freeze([
 ...['sg-ag-ordinary-private-entry','sg-ag-ordinary-admission','sg-ag-ordinary-gateway','sg-ag-ordinary-linux','sg-ag-ordinary-memory-ssh','sg-ag-ordinary-private-pipes','sg-ag-ordinary-private-evidence',
  'sg-ag-strict-entry','ag-original-full-control','sg-ag-full-control-adapter','sg-ag-production-io','sg-ag-native-merge','sg-ag-ordinary-business','sg-ag-completed-prefix','sg-ag-private-control',
  'sg-business-document','sg-business-delivery','sg-business-native-reader','sg-existing-business'].map(n=>'scripts/runner-v2/ag-rolling/'+n+'.mjs'),
 'scripts/runner-v2/record_fields.py','service/business_fields.py','service/existing_business_fields.py','config/ag-business-bindings.json','config/ag-business-delivery-policy.json',
 'scripts/runner-v2/state-store.mjs','scripts/runner-v2/resource-gate.mjs','scripts/runner-v2/analyzer.mjs','scripts/runner-v2/demo-run-fence.mjs','scripts/runner-v2/github-boundary.mjs']);
export function verifyOrdinaryRuntimeFiles(descriptor,{root=process.cwd(),readBytes=p=>fs.readFileSync(p)}={}){
 assert(Object.keys(descriptor.runtimeFiles??{}).length>=300&&digest(descriptor.runtimeFiles)===descriptor.runtimeHash,'SG_AG_ORDINARY_OWN_RUNTIME_MANIFEST');
 assert(requiredOrdinaryRuntimeFiles.every(f=>Object.hasOwn(descriptor.runtimeFiles,f)),'SG_AG_ORDINARY_REQUIRED_RUNTIME_FILE_MISSING');
 const actualEntry='scripts/runner-v2/ag-rolling/sg-ag-ordinary-private-entry.mjs';
 assert(descriptor.runtimeFiles[actualEntry]===descriptor.entrySha256,'SG_AG_ORDINARY_ACTUAL_ENTRY_FILE_REQUIRED');
 for(const [file,hash] of Object.entries(descriptor.runtimeFiles)){
  assert(/^(scripts|service|collector|config|\.github)\/[A-Za-z0-9_./-]+$/.test(file)&&!file.includes('..')&&/^[a-f0-9]{64}$/.test(hash),'SG_AG_ORDINARY_RUNTIME_FILE_SCOPE');
  assert(createHash('sha256').update(readBytes(path.join(root,file))).digest('hex')===hash,'SG_AG_ORDINARY_RUNTIME_BYTES_CHANGED');
 }
 return true;
}
// The protected parent provides distinct private read pipes (credentials and
// approval/evidence) and its already-open approved directory at fd 4. This
// function neither creates a grant nor provisions a directory/account/service.
export async function runProtectedOrdinaryEntry(){
 const identity=assertOrdinaryPrivatePipes();const descriptor=await receiveOrdinaryPrivateJson(3);
 verifyOrdinaryRuntimeFiles(descriptor);verifyOwnStrictLinux(descriptor.linux,identity.actorCommit,process.cwd());
 assert(descriptor.expectedGrant?.actorRun===identity.actorRun&&descriptor.expectedGrant?.actorCommit===identity.actorCommit,'SG_AG_ORDINARY_ACTOR_APPROVAL_BINDING');
 const auth=parseOrdinaryCredentials(await receiveOrdinaryPrivateJson(0,{maxBytes:131072}),identity);
 const key=auth.evidenceKey;delete auth.evidenceKey;
 let client,parser,transport;
 try{
  assert(createHash('sha256').update(key).digest('hex')===descriptor.evidenceKeyFingerprint,'SG_AG_ORDINARY_APPROVED_MEMORY_KEY');
  assert(/^ag-rolling-queue-[a-f0-9]{64}\.json$/.test(descriptor.profile),'SG_AG_ORDINARY_PROFILE_FILENAME');
  const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=readJson('config/'+descriptor.profile),registry=readJson('config/ag-rolling-plans.json'),bindings=readJson('config/ag-business-bindings.json').bindings,binding=bindings['32529'],policy=readJson('config/ag-business-delivery-policy.json');
  const game=profile.payload.games.find(g=>g.gameId==='32529');assert(game?.baseline===0&&binding?.queueId===profile.payload.queueId&&registry.plans['32529']?.adapter==='native-nextgen-v1'
   &&profile.federation.assignments.some(a=>a.gameId==='32529'&&a.cohort==='primary'),'SG_AG_ORDINARY_EXACT_OWN_GAME');
  const require=createRequire(import.meta.url);require('../../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json',transpileOnly:true});
  const {MongoClient,ObjectId}=require('../../../collector/node_modules/mongodb');
  client=new MongoClient('mongodb://52.87.94.113:27017',{auth:{username:'sg_simulate_delivery_v1',password:auth.password},authSource:'admin',authMechanism:'SCRAM-SHA-1',
   retryReads:false,retryWrites:false,maxPoolSize:2,connectTimeoutMS:10000,serverSelectionTimeoutMS:10000,socketTimeoutMS:60000,writeConcern:{w:'majority',j:true,wtimeoutMS:15000}});delete auth.password;
  await client.connect();const journal=client.db('sg_capture_staging_v1').collection('capture_journal_v2');
  assertOrdinaryPrivileges(await client.db('admin').command({connectionStatus:1,showPrivileges:true}),{profile,plans:registry.plans,binding});
  assertOrdinaryProtectedGrant(await journal.findOne({_id:descriptor.grantKey},{hint:'_id_',maxTimeMS:15000}),descriptor,identity);
  const gh=authenticatedRead(auth.ghToken);delete auth.ghToken;
  return await withOrdinaryMemoryIdentities(auth,descriptor.ssh,async({nativeIdentity,businessIdentity})=>{
   transport=serializeTransport(connectOrdinaryMemoryGateway(nativeIdentity));const gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+340*60000});
   parser=analyzer({python:process.env.PYTHON??'python3',env:ordinaryChildEnvironment(process.env)});
   const owner=identity.actorRun+':strict-ag-control',context={run:identity.actorRun,commit:identity.actorCommit,queueId:profile.payload.queueId,campaigns:[game.campaignId],approvedEntrySha256:descriptor.entrySha256};
   const privateControlPersist=createPrivateControlWriter({directoryFd:4,key,context});
   const nativeKey='rolling-merge:'+digest([profile.payload.queueId,game.gameId,game.campaignId]),nativeReceipt=await store.get('journal',nativeKey+':complete');
   assert(nativeReceipt?.value.count===300000&&nativeReceipt.value.fullReadback&&nativeReceipt.value.independentlyVerified,'SG_AG_ORDINARY_OWN_NATIVE_COMPLETE');
   assert(digest(nativeReceipt.value)===policy.completeProofs['32529'].receiptHash&&nativeReceipt.value.recordsHash===policy.completeProofs['32529'].recordsHash,'SG_AG_ORDINARY_OWN_IMMUTABLE_PROOF_CHANGED');
   const privateEvidence=openOrdinaryPrivateEvidence({directoryFd:4,key,context,owner,claimId:'game:32529:'+digest(nativeReceipt.value)});
   const admission=createOrdinaryAdmission({descriptor,identity,profile,plans:registry.plans,binding,store,transport,client,read:gh,oldProfile:readJson('config/demo-pilot-beaver-20260930.json'),privateEvidence,privateControlPersist});
   await admission.guard();const capture=descriptor.expectedGrant;
   const state={version:1,queueId:profile.payload.queueId,runId:Number(capture.cohortRun.split(':')[0]),phase:'running',games:[{...structuredClone(game),phase:'ready'}]};
   const runtime=createAdmittedStrictControl({state,profile,cohortRun:capture.cohortRun,coordinatorRun:capture.coordinatorRun,commit:capture.captureCommit,actorRun:identity.actorRun,actorCommit:identity.actorCommit,
    repository:cohortReposPrimary,store,transport,parser,businessClient:client,ObjectId,bindings,plans:registry.plans,githubRead:admission.captureRead,admission,privateEvidence,privateControlPersist,
    approvedEntrySha256:descriptor.entrySha256,currentRtp:async b=>{assert(String(b.gameId)==='32529'&&await ordinaryRtpHash(businessIdentity)===b.rtpFileSha256,'SG_AG_ORDINARY_OWN_RTP_CHANGED');}});
   privateControlPersist('own-control-state',state);await runtime.reconcile();
   assert(state.games[0].phase==='complete'&&privateEvidence.finalAckReceived,'SG_AG_ORDINARY_FULL_WALKTHROUGH_NOT_COMPLETED');
   const final={schema:'sg-ag-own-ordinary-walkthrough-v1',actorRun:identity.actorRun,actorCommit:identity.actorCommit,captureRun:capture.cohortRun,captureCommit:capture.captureCommit,
    gameId:'32529',finalSimulateFullReadback:true,privateFullAck:true,newContinuationAllowed:false,sourceRequests:0,originalQuotaPreserved:true};
   privateControlPersist('own-control-state',{state,final});return final;
  });
 }finally{delete auth.password;delete auth.ghToken;delete auth.nativeSshPrivateKey;delete auth.businessSshPrivateKey;key.fill(0);parser?.close();transport?.close();await client?.close();}
}
const cohortReposPrimary='zyzuoyang/sg-capture-runner';
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--preauth'){console.log(JSON.stringify(ordinaryPrivateEntryStatus));}
 else if(process.argv.length===3&&process.argv[2]==='--protected'){
  try{await runProtectedOrdinaryEntry();}catch{process.stderr.write('SG_AG_ORDINARY_PRIVATE_ENTRY_STOP_NO_RETRY\n');process.exitCode=2;}
 }else{process.stderr.write('SG_AG_ORDINARY_PRIVATE_LAUNCHER_REQUIRED\n');process.exitCode=2;}
}
