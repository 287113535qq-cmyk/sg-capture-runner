import fs from 'node:fs';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {spawn} from 'node:child_process';
import {analyzer} from '../analyzer.mjs';import {stable} from '../mongo-writer.mjs';
import {ResourceGate} from '../resource-gate.mjs';import {RunnerState} from '../state-store.mjs';
import {authenticatedRead} from '../github-boundary.mjs';import {maintenanceBoundary} from '../demo-run-fence.mjs';
import {captureCollector} from '../../trial/collector-loader.mjs';
import {verifyLegacyPage,digest} from './sg-business-delivery.mjs';
import {assertOwnHistoricalGrant,assertOwnHistoricalPrivileges,HISTORICAL_USER,deliverOwnHistoricalGame} from './sg-historical-labomba-actor.mjs';
import {historicalPreauth} from './sg-historical-labomba-preauth.mjs';
import {receiveHistoricalPrivatePipe,withHistoricalMemoryIdentities,historicalChildEnvironment,historicalResourceTransport,historicalRtpHash} from './sg-historical-private-pipe.mjs';
import {requireBusinessLinux} from './sg-historical-labomba-linux.mjs';
import {verifyEndedFederation} from './sg-historical-ended-federation.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifestBytes=fs.readFileSync('config/ag-historical-labomba-manifest.json'),manifest=JSON.parse(manifestBytes);
const execution=historicalPreauth();
// A reviewed executor must supply this private pipe. No password or token is accepted in argv, environment, or temporary files.
assert(process.argv.length===2,'HISTORICAL_PRIVATE_PIPE_REQUIRED');
const auth=await receiveHistoricalPrivatePipe();
const linuxProof=await requireBusinessLinux({id:process.env.SG_BUSINESS_LINUX_RUN,commit:process.env.GITHUB_SHA,token:auth.ghToken});
const gh=authenticatedRead(auth.ghToken);delete auth.ghToken;
await withHistoricalMemoryIdentities(auth,execution.ssh,async({nativeIdentity,historicalIdentity})=>{
const require=createRequire(import.meta.url);require('../../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json',transpileOnly:true});
const {MongoClient,ObjectId}=require('../../../collector/node_modules/mongodb');
const client=new MongoClient('mongodb://52.87.94.113:27017',{auth:{username:HISTORICAL_USER,password:auth.password},authSource:'admin',authMechanism:'SCRAM-SHA-1',
 retryReads:false,retryWrites:false,maxPoolSize:2,connectTimeoutMS:10000,serverSelectionTimeoutMS:10000,socketTimeoutMS:30000});delete auth.password;
const childEnv=historicalChildEnvironment(process.env);
const parser=analyzer({python:process.env.PYTHON??'python3',env:childEnv});
const py=spawn(process.env.PYTHON??'python3',['-B','scripts/runner-v2/historical_labomba_business_candidate.py'],{env:childEnv,stdio:['pipe','pipe','pipe']});
let pending=null,buffer=Buffer.alloc(0),closed=false;
const fail=()=>{closed=true;if(pending){clearTimeout(pending.timer);pending.reject(Error('HISTORICAL_PY_CLOSED_NO_RETRY'));pending=null;}};
py.on('error',fail);py.on('close',fail);py.stdin.on('error',fail);py.stderr.on('data',()=>{});
py.stdout.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);if(buffer.length>16*1024*1024){fail();py.kill();return;}
 const end=buffer.indexOf(10);if(end<0)return;const line=buffer.subarray(0,end);buffer=buffer.subarray(end+1);
 if(!pending){fail();py.kill();return;}const p=pending;pending=null;clearTimeout(p.timer);
 try{const value=JSON.parse(line);assert(value.ok,'HISTORICAL_PY_REJECTED');p.resolve(value.result);}catch{p.reject(Error('HISTORICAL_PY_REJECTED'));}});
const independentConvert=records=>new Promise((resolve,reject)=>{assert(!closed&&!pending);const text=JSON.stringify({plan:manifest.plan,binding:manifest.binding,records})+'\n';
 assert(Buffer.byteLength(text)<=8*1024*1024);pending={resolve,reject,timer:setTimeout(()=>{fail();py.kill();},60000)};py.stdin.write(text);});
const transport=historicalResourceTransport(nativeIdentity),gate=new ResourceGate(),resourceStore=new RunnerState({transport,gate,deadline:Date.now()+325*60000});
const owner=process.env.GITHUB_RUN_ID+':1:historical-32723';
const report={schema:'sg-historical-labomba-run-v1',owner,commit:process.env.GITHUB_SHA,linuxProof,sourceRequests:0,nativeWrites:0,complete:false};
const jsonDoc=d=>d?{...d,_id:String(d._id)}:null;
try{
 await client.connect();const staging=client.db('sg_capture_staging_v1'),states=staging.collection('capture_state_v2'),journal=staging.collection('capture_journal_v2');
 const pool=client.db(manifest.database).collection('simulate'),auditCollection=staging.collection('business_delivery_v1');
 const options={hint:'_id_',maxTimeMS:15000};
 const store={get:(collection,key)=>{assert(['state','journal'].includes(collection));return (collection==='state'?states:journal).findOne({_id:'primary/'+key},options);},
  getMany:async(collection,keys)=>{const rows=await (collection==='state'?states:journal).find({_id:{$in:keys.map(k=>'primary/'+k)}},options).toArray();const by=new Map(rows.map(d=>[d._id,d]));return keys.map(k=>by.get('primary/'+k)??null);}};
 const boundary=maintenanceBoundary({read:gh,store,oldProfile:read('config/demo-pilot-beaver-20260930.json'),run:process.env.GITHUB_RUN_ID+':1',commit:process.env.GITHUB_SHA,workflowPath:'.github/workflows/historical-labomba.yml'});
 let lastBoundary=-Infinity,lastWindow=-Infinity;
 const guard=async()=>{
  await resourceStore.writable();assert(gate.status().metrics.diskFreeBytes>=25*1024**3,'HISTORICAL_DISK_RESERVE');
  const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(d=>d?.value.active===false),'HISTORICAL_GLOBAL_HOLD');
  assertOwnHistoricalPrivileges(await client.db('admin').command({connectionStatus:1,showPrivileges:true}),execution.permission);
  const grant=await journal.findOne({_id:execution.permission.grantKey},options);
  assertOwnHistoricalGrant(grant,execution,process.env);
  const source=(await store.get('state','rolling-source'))?.value;
  assert(source?.status==='idle'&&source.owner===null&&source.queueId===null&&source.lastRun===execution.window.run
   &&source.lastQueueId===execution.window.queueId,'HISTORICAL_NATIVE_WINDOW_NOT_IDLE');
  const previous=read('config/'+execution.window.profile),prior=(await store.get('journal',execution.window.permitKey))?.value;
  const ended=(await store.get('journal',`rolling-ended:${execution.window.queueId}:${execution.window.run}`))?.value;
  assert(digest(ended)===execution.window.endedProofHash&&source.endedProofHash===execution.window.endedProofHash,'HISTORICAL_CURRENT_ENDING_REQUIRED');
  if(Date.now()-lastWindow>=15000){const start=Date.now();
  await verifyEndedFederation({previous,prior,receipt:ended,store,
   readEnded:(id,repo)=>gh(`repos/${repo}/actions/runs/${id}`),readEndedJobs:(id,repo)=>gh(`repos/${repo}/actions/runs/${id}/jobs?filter=all&per_page=100`),
   readRecoveryProfile:activation=>read('config/ag-rolling-queue-'+activation+'.json')});
  const leaseKeys=previous.payload.games.flatMap(g=>[...['canary:1','canary:2'],...Array.from({length:20},(_,i)=>'worker:'+(i+1))]
   .map(t=>{const [kind,index]=t.split(':');return stagingLeaseKey(previous.payload.queueId,g,kind,Number(index));}));
  assert(leaseKeys.length===1782&&new Set(leaseKeys).size===1782,'HISTORICAL_ORIGINAL_LEASE_INVENTORY');
  for(let n=0;n<leaseKeys.length;n+=100)assert((await store.getMany('state',leaseKeys.slice(n,n+100))).every(d=>!d||d.value.expiresAt<=Date.now()),'HISTORICAL_NATIVE_LIVE_LEASE');
  assert(Date.now()-start<=30000,'HISTORICAL_WINDOW_READBACK_STALE');lastWindow=start;}
  if(Date.now()-lastBoundary>=15000){await boundary();lastBoundary=Date.now();}
 };
 const currentRtp=async()=>{const hash=await historicalRtpHash(historicalIdentity);
  assert(hash===manifest.rtpFileSha256,'HISTORICAL_OWN_CURRENT_RTP_CHANGED');};
 const claimPrefix='historical-game:32723:'+manifest.receiptValueHash;
 const audit={read:key=>{assert(key.startsWith(claimPrefix));return auditCollection.findOne({_id:key},options);},
  anyPrefix:async key=>Boolean((await auditCollection.find({_id:{$gte:key,$lt:key+'\uffff'}},options).limit(1).toArray()).length),
  create:async(key,value)=>{assert(key.startsWith(claimPrefix)&&value.immutable===true);
   const result=await auditCollection.insertOne({_id:key,...value},{writeConcern:{w:'majority',j:true,wtimeoutMS:15000}});
   assert(result.acknowledged===true&&result.insertedId===key,'HISTORICAL_DURABLE_INTENT_ACK_REQUIRED');}};
 const target={read:async ids=>(await pool.find({_id:{$in:ids.map(id=>new ObjectId(id))}},options).toArray()).map(jsonDoc),
  readOne:async id=>jsonDoc(await pool.findOne({_id:new ObjectId(id)},options)),
  originals:async()=>(await pool.find({},{sort:{_id:1},maxTimeMS:15000}).limit(151).toArray()).map(jsonDoc),
  count:()=>pool.countDocuments({},{maxTimeMS:15000}),countHistorical:()=>pool.countDocuments({'data.captureTrialId':manifest.trialId},{maxTimeMS:15000}),
  insert:async docs=>{const result=await pool.insertMany(docs.map(d=>({...d,_id:new ObjectId(d._id)})),{ordered:true,writeConcern:{w:'majority',j:true,wtimeoutMS:15000}});
   assert(result.acknowledged===true&&result.insertedCount===docs.length,'HISTORICAL_INSERT_ACK_REQUIRED');},
  casRtp:async(id,before,after)=>{const result=await pool.updateOne({_id:new ObjectId(id),rtp:before},{$set:{rtp:after}},{writeConcern:{w:'majority',j:true,wtimeoutMS:15000}});
   assert(result.acknowledged===true,'HISTORICAL_RTP_ACK_REQUIRED');return result;}};
 const verifyNative=async records=>{for(const r of records){const f=r.normalized;assert(stable(captureCollector('nextgen').prepareNextgenRound(r.raw,{buy:f.buy,bonus:f.bonus,typeMappingHash:f.typeMappingHash}))===stable(f),'HISTORICAL_NATIVE_JS_FIELDS');}
  await parser.verifyPage(manifest.plan,records);};
 const native={source:staging.collection('official_rounds'),evidence:async()=>({state:await states.findOne({_id:manifest.stateKey},options),receipt:await journal.findOne({_id:manifest.receiptKey},options)})};
 report.result=await deliverOwnHistoricalGame({manifest,owner,native,target,audit,verifyNative,independentConvert,
  verifyOriginals:documents=>verifyLegacyPage({documents,plan:manifest.plan,binding:manifest.binding,parser}),guard,currentRtp,emit:value=>console.log(JSON.stringify(value))});report.complete=true;
}catch(error){report.reason=/^[A-Z_]+$/.test(error.message??'')?error.message:'HISTORICAL_IO_OR_VALIDATION_STOP_NO_RETRY';process.exitCode=2;}
finally{parser.close();fail();py.stdin.end();py.kill();transport.close();await client.close();
 const evidence=Buffer.from(JSON.stringify(report,null,2)+'\n');
 try{if(process.env.SG_HISTORICAL_PRIVATE_EVIDENCE_FD==='3')fs.writeFileSync(3,evidence);
  else{fs.mkdirSync('business-evidence',{recursive:true});fs.writeFileSync('business-evidence/result.json',evidence,{flag:'wx'});}}
 finally{evidence.fill(0);}}
});
