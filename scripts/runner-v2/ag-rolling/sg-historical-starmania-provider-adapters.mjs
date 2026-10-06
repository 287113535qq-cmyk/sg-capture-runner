import assert from 'node:assert/strict';
import {stable} from '../mongo-writer.mjs';
import {authenticatedRead} from '../github-boundary.mjs';
import {maintenanceBoundary} from '../demo-run-fence.mjs';
import {digest} from './sg-business-delivery.mjs';
import {assertOwnHistoricalGrant,assertOwnHistoricalPrivileges,assertOwnHistoricalClosedWindow,HISTORICAL_BRANCH} from './sg-historical-starmania-actor.mjs';
import {requireBusinessLinux} from './sg-historical-starmania-linux.mjs';
import {verifyEndedFederation} from './sg-historical-starmania-ended-federation.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';

// The returned surface contains no collection handle, write operation or source transport.
export function historicalNativeReadStore(client){
 const db=client.db('sg_capture_staging_v1'),collections={state:db.collection('capture_state_v2'),journal:db.collection('capture_journal_v2')};
 const options={hint:'_id_',maxTimeMS:15000};
 const select=c=>{assert(Object.hasOwn(collections,c),'HISTORICAL_READ_COLLECTION');return collections[c];};
 const keys=k=>{assert(Array.isArray(k)&&k.length>0&&k.length<=100&&new Set(k).size===k.length&&k.every(v=>typeof v==='string'&&v.length<2048&&!v.startsWith('primary/')));return k.map(v=>'primary/'+v);};
 return Object.freeze({get:(c,k)=>{const ids=keys([k]);return select(c).findOne({_id:ids[0]},options);},
  getMany:async(c,k)=>{const ids=keys(k),rows=await select(c).find({_id:{$in:ids}},options).toArray();assert(new Set(rows.map(d=>d._id)).size===rows.length&&rows.every(d=>ids.includes(d._id)));const by=new Map(rows.map(d=>[d._id,d]));return ids.map(id=>by.get(id)??null);}});
}
export async function verifyHistoricalNativeEnding({execution,store,readConfig,readGithub,now=Date.now,verifyFederation=verifyEndedFederation}){
 const started=now(),window=execution.window;
 assert(window?.run==='37314031299:1'&&window.queueId==='rolling-20261003225355-f0d07c84'&&/^[a-f0-9]{64}$/.test(window.endedProofHash));
 assert(window.profile==='ag-rolling-queue-5fb60599fd6bd3d2ff78b3fbce044a665edaeb5009fb9a6c30179bf5b323944b.json'
  &&window.permitKey==='rolling-activation:5fb60599fd6bd3d2ff78b3fbce044a665edaeb5009fb9a6c30179bf5b323944b:complete','HISTORICAL_WINDOW_BINDING');
 const source=await store.get('state','rolling-source'),previous=readConfig(window.profile),prior=(await store.get('journal',window.permitKey))?.value;
 const endedKey=`rolling-ended:${window.queueId}:${window.run}`,ending=await store.get('journal',endedKey);
 const value=source?.value,sourceSnapshot=stable(source),endingSnapshot=stable(ending);
 assert(value?.status==='idle'&&value.owner===null&&value.queueId===null&&value.lastRun===window.run&&value.lastQueueId===window.queueId,'HISTORICAL_NATIVE_WINDOW_NOT_IDLE');
 assert(digest(ending?.value)===window.endedProofHash&&value.endedProofHash===window.endedProofHash,'HISTORICAL_CURRENT_ENDING_REQUIRED');
 assert(previous.activation==='5fb60599fd6bd3d2ff78b3fbce044a665edaeb5009fb9a6c30179bf5b323944b'&&previous.payload?.queueId===window.queueId&&previous.federation,'HISTORICAL_ORIGINAL_FULL_FEDERATION_REQUIRED');
 const federation=await verifyFederation({previous,prior,receipt:ending.value,store,readEnded:(id,repo)=>readGithub(`repos/${repo}/actions/runs/${id}`),
  readEndedJobs:(id,repo)=>readGithub(`repos/${repo}/actions/runs/${id}/jobs?filter=all&per_page=100`),readRecoveryProfile:a=>{assert(/^[a-f0-9]{64}$/.test(a));return readConfig('ag-rolling-queue-'+a+'.json');}});
 assert(federation?.primaryRun==='37314031299:1'&&federation.secondaryRun==='37321135064:1'&&federation.federationHash===digest(previous.federation)
  &&federation.sourceRequests===0&&federation.closure,'HISTORICAL_CURRENT_RECOVERED_FEDERATION_REQUIRED');
 assertOwnHistoricalClosedWindow(federation);
 const leaseKeys=previous.payload.games.flatMap(g=>['canary:1','canary:2',...Array.from({length:20},(_,i)=>'worker:'+(i+1))].map(t=>{const[kind,index]=t.split(':');return stagingLeaseKey(previous.payload.queueId,g,kind,Number(index));}));
 assert(leaseKeys.length===1782&&new Set(leaseKeys).size===1782,'HISTORICAL_ORIGINAL_LEASE_INVENTORY');
 for(let n=0;n<leaseKeys.length;n+=100)assert((await store.getMany('state',leaseKeys.slice(n,n+100))).every(d=>!d||d.value.expiresAt<=now()),'HISTORICAL_NATIVE_LIVE_LEASE');
 assert(stable(await store.get('state','rolling-source'))===sourceSnapshot&&stable(await store.get('journal',endedKey))===endingSnapshot,'HISTORICAL_NATIVE_ENDING_CHANGED');
 assert(now()>=started&&now()-started<30000,'HISTORICAL_WINDOW_READBACK_STALE');return true;
}
// Production defaults call the original authenticated REST, exact Linux parser and canonical boundary.
// Injected dependencies are for local tests; they never constitute actual production permission.
export function historicalProductionReadAdapters({context,execution,manifestSha256,client,token,readConfig},dependencies={}){
 context=structuredClone(context);execution=structuredClone(execution);
 assert(execution.schema==='sg-historical-starmania-execution-v1'&&execution.enabled===true&&execution.minimumPermissionApproved===true&&execution.linuxPermissionGranted===true
  &&execution.branch===HISTORICAL_BRANCH&&stable(execution.gameIds)===stable(['32737'])&&execution.manifestSha256===manifestSha256&&context.manifestSha256===manifestSha256,'HISTORICAL_SENDER_DISABLED');
 assert(manifestSha256==='ab41fca9e5cda4025cac3dac7efc995419c4ab0d37a3a27b450b028673d8cedf','HISTORICAL_OWN_MANIFEST_REQUIRED');
 assert(token&&typeof readConfig==='function');
 const now=dependencies.now??Date.now,readGithub=dependencies.readGithub??authenticatedRead(token),store=historicalNativeReadStore(client);
 const boundary=(dependencies.makeBoundary??maintenanceBoundary)({read:readGithub,store,oldProfile:readConfig('demo-pilot-beaver-20260930.json'),run:context.run,commit:context.commit,workflowPath:context.workflow});
 const used=new Set();let failed=false;
 const once=(name,fn)=>async arg=>{try{assert(!failed&&!used.has(name));used.add(name);return await fn(arg);}catch{failed=true;throw Error('HISTORICAL_PRODUCTION_READ_STOP_NO_RETRY');}};
 const protectedRead=async()=>{
  const start=now();assertOwnHistoricalPrivileges(await client.db('admin').command({connectionStatus:1,showPrivileges:true}),execution.permission);
  const grant=await store.get('journal',execution.permission.grantKey.slice('primary/'.length));
  assertOwnHistoricalGrant(grant,execution,{GITHUB_RUN_ID:context.run.split(':')[0],GITHUB_SHA:context.commit,SG_BUSINESS_LINUX_RUN:context.linuxRun});
  assert(now()>=start&&now()-start<10000);return {grant:structuredClone(grant),observedAt:start};
 };
 return Object.freeze({readGithub:onceRead(readGithub,()=>failed,()=>{failed=true;}),readProtectedAdmission:once('protected',protectedRead),
  verifyOriginalCanonical:once('canonical',async()=>{await boundary();return true;}),
  verifyOwnLinux:once('linux',async()=>{const proof=await(dependencies.requireLinux??requireBusinessLinux)({id:context.linuxRun,commit:context.commit,token});assert(proof.run===Number(context.linuxRun)&&proof.commit===context.commit&&proof.joinedCommands===14);return true;}),
  verifyNativeEnding:once('ending',async({protectedRead:before})=>{
   await verifyHistoricalNativeEnding({execution,store,readConfig,readGithub,now,verifyFederation:dependencies.verifyFederation??verifyEndedFederation});
   // A second, independent protected read is a fresh gate after the finite inventory, never a retry.
   const after=await protectedRead();assert(stable(after.grant)===stable(before.grant),'HISTORICAL_PROTECTED_GRANT_CHANGED');before.observedAt=after.observedAt;return true;
  })});
}
function onceRead(read,failed,stop){const seen=new Set();return async path=>{try{assert(!failed()&&!seen.has(path));seen.add(path);return await read(path);}catch{stop();throw Error('HISTORICAL_PRODUCTION_READ_STOP_NO_RETRY');}};}
