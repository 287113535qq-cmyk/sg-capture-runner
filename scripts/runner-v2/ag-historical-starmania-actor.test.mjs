import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {stable} from './mongo-writer.mjs';import {digest} from './ag-rolling/sg-business-delivery.mjs';
import {assertOwnHistoricalActor,assertOwnHistoricalGrant,assertOwnHistoricalPrivileges,MINIMUM_PRIVILEGES,
 HISTORICAL_USER,HISTORICAL_BRANCH,parseHistoricalPrivateCredentials,retagOwnHistoricalOriginal,deliverOwnHistoricalGame,createOwnHistoricalImmutable} from './ag-rolling/sg-historical-starmania-actor.mjs';
const manifest=JSON.parse(fs.readFileSync('config/ag-historical-starmania-manifest.json'));
const env={GITHUB_ACTIONS:'true',RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_REPOSITORY:'zyzuoyang/sg-capture-runner',GITHUB_REF:'refs/heads/'+HISTORICAL_BRANCH,
 GITHUB_JOB:'ag-rolling-business-delivery',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'999123',GITHUB_SHA:'a'.repeat(40),SG_BUSINESS_GAME_IDS:'32737',SG_BUSINESS_LINUX_RUN:'999124'};
const execution={schema:'sg-historical-starmania-execution-v1',enabled:true,branch:HISTORICAL_BRANCH,gameIds:['32737'],manifestSha256:'b'.repeat(64),
 permission:{username:HISTORICAL_USER,sshAccount:'sghistorical32737',grantKey:'primary/historical-delivery-permission:32737:'+'b'.repeat(64)},
 window:{run:'37314031299:1',queueId:'rolling-20261003225355-f0d07c84',endedProofHash:'c'.repeat(64)},
 ssh:{host:'52.87.94.113',hostKeyFingerprint:'synthetic-public-host',knownHostsSha256:'d'.repeat(64),nativeIdentityFingerprint:'synthetic-native',historicalIdentityFingerprint:'synthetic-historical'}};
const canonical=p=>p.map(v=>({resource:v.resource,actions:[...v.actions].sort()})).sort((a,b)=>stable(a).localeCompare(stable(b)));
test('malformed private input produces a fixed error without echoing any input value',()=>{
 const fixture={password:'synthetic-private-value',ghToken:'synthetic-token'};
 assert.deepEqual(parseHistoricalPrivateCredentials(Buffer.from(JSON.stringify(fixture))),fixture);
 for(const bytes of [Buffer.from('{synthetic-private-value'),Buffer.from(JSON.stringify({...fixture,extra:true})),Buffer.alloc(16384),Buffer.from(JSON.stringify({...fixture,password:123}))]){
  assert.throws(()=>parseHistoricalPrivateCredentials(bytes),e=>e.message==='HISTORICAL_PRIVATE_CREDENTIALS_REJECTED');
 }
});
function grant(){return {_id:execution.permission.grantKey,value:{schema:'sg-historical-starmania-permission-v1',gameId:32737,username:HISTORICAL_USER,minimumPermissionApproved:true,immutable:true,
 branch:HISTORICAL_BRANCH,manifestSha256:execution.manifestSha256,privilegesHash:digest(canonical(MINIMUM_PRIVILEGES)),sshAccount:'sghistorical32737',rtpFileSha256:manifest.rtpFileSha256,
 privateEvidence:{mode:'inherited-fd3',gameId:32737,run:env.GITHUB_RUN_ID+':1',commit:env.GITHUB_SHA,privateOnly:true},
 ssh:{nativeAccount:'sgcapture',historicalAccount:'sghistorical32737',resourceOnly:true,rtpHashOnly:true,...execution.ssh},
 linux:{run:999124,commit:env.GITHUB_SHA,joinedCommands:14,sealedReceipts:Array.from({length:9},(_,i)=>({mailbox:'fixture:'+i,run:999124,commit:env.GITHUB_SHA,received:true,receiptHash:String(i).repeat(64)}))}}};}
test('exclusive historical actor rejects other branches, games, attempts and disabled execution',()=>{
 assertOwnHistoricalActor(env,execution,execution.manifestSha256);
 for(const delta of [{SG_BUSINESS_GAME_IDS:'32737,32731'},{SG_BUSINESS_GAME_IDS:'32731'},{GITHUB_REF:'refs/heads/main'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_JOB:'preflight'},{SG_TRIAL_DEMO_CONFIG:'x'}])assert.throws(()=>assertOwnHistoricalActor({...env,...delta},execution,execution.manifestSha256));
 assert.throws(()=>assertOwnHistoricalActor(env,{...execution,enabled:false},execution.manifestSha256));
 assert.throws(()=>assertOwnHistoricalActor(env,execution,'d'.repeat(64)));
});
test('actual privileges must equal the own minimum; an admin or the existing81 writer is rejected',()=>{
 const status={authInfo:{authenticatedUsers:[{user:HISTORICAL_USER,db:'admin'}],authenticatedUserPrivileges:structuredClone(MINIMUM_PRIVILEGES)}};
 assertOwnHistoricalPrivileges(status,execution.permission);
 for(const mutate of [s=>s.authInfo.authenticatedUsers[0].user='admin',s=>s.authInfo.authenticatedUsers[0].user='sg_simulate_delivery_v1',
  s=>s.authInfo.authenticatedUserPrivileges.push({resource:{db:'sg_polterheist96',collection:'simulate'},actions:['insert']}),
  s=>s.authInfo.authenticatedUserPrivileges[0].actions.push('remove'),s=>s.authInfo.authenticatedUserPrivileges.pop()]){const s=structuredClone(status);mutate(s);assert.throws(()=>assertOwnHistoricalPrivileges(s,execution.permission));}
});
test('protected grant binds the own14 checks and all9 sealed mailboxes to this exact actor commit',()=>{
 assertOwnHistoricalGrant(grant(),execution,env);
 for(const mutate of [g=>g.value.gameId=32731,g=>g.value.minimumPermissionApproved=false,g=>g.value.linux.joinedCommands=13,
  g=>g.value.linux.commit='d'.repeat(40),g=>g.value.linux.sealedReceipts.pop(),g=>g.value.linux.sealedReceipts[1].mailbox='fixture:0',
  g=>g.value.linux.sealedReceipts[0].run=37355624055,g=>g.value.privilegesHash='e'.repeat(64),g=>g.value.sshAccount='sgdelivery']){const g=grant();mutate(g);assert.throws(()=>assertOwnHistoricalGrant(g,execution,env));}
});
const original=()=>({_id:'1'.repeat(24),gameId:33137,bet:0.5,mul:2,buy:0,bonus:0,rtp:[0,100],data:{steps:[{raw:'synthetic-unchanged'}],money:{start:10000,end:10050}}});
function io(){const rows=new Map([[original()._id,original()]]),entries=new Map(),order=[];return {rows,entries,order,
 target:{readOne:async id=>structuredClone(rows.get(id)),casRtp:async(id,before,after)=>{order.push('cas');assert.deepEqual(rows.get(id).rtp,before);rows.get(id).rtp=structuredClone(after);return {matchedCount:1,modifiedCount:1};}},
 audit:{read:async key=>entries.get(key),create:async(key,v)=>{order.push(key.endsWith('intent')?'intent':'ack');assert(!entries.has(key));entries.set(key,{_id:key,...structuredClone(v)});}}};}
test('original retagging preserves all other values and reads back intent, exactCAS and ack',async()=>{
 const x=io(),document=original(),rtp=manifest.binding.rtp;
 assert.equal(await retagOwnHistoricalOriginal({document,rtp,target:x.target,audit:x.audit,key:'own',guard:async()=>{}}),true);
 assert.deepEqual(x.order,['intent','cas','ack']);assert.deepEqual(x.rows.get(document._id),{...document,rtp});assert.deepEqual(document,original());
});
test('changed original or priorRTP intent is rejected before new writes',async()=>{
 for(const alter of [x=>x.rows.get(original()._id).bet=2,x=>x.entries.set('own:intent',{unknown:true})]){
  const x=io();alter(x);await assert.rejects(retagOwnHistoricalOriginal({document:original(),rtp:manifest.binding.rtp,target:x.target,audit:x.audit,key:'own',guard:async()=>{}}));assert.equal(x.order.length,0);
 }
});
test('unchanged RTP needs no durable intent or update',async()=>{
 const x=io();assert.equal(await retagOwnHistoricalOriginal({document:original(),rtp:original().rtp,target:x.target,audit:x.audit,key:'own',guard:async()=>{}}),false);assert.equal(x.order.length,0);
});
test('unknownCAS leaves its intent; replay cannot issue another update',async()=>{
 const x=io();let writes=0;x.target.casRtp=async()=>{writes++;throw Error('UNKNOWN_CAS_ACK');};
 const args={document:original(),rtp:manifest.binding.rtp,target:x.target,audit:x.audit,key:'own',guard:async()=>{}};
 await assert.rejects(retagOwnHistoricalOriginal(args),/UNKNOWN_CAS_ACK/);assert.equal(writes,1);assert(x.entries.has('own:intent'));assert(!x.entries.has('own:ack'));
 await assert.rejects(retagOwnHistoricalOriginal(args),/HISTORICAL_EXISTING_RTP_INTENT/);assert.equal(writes,1);
});
test('partial readback rejects a changed money value and does not acknowledge the update',async()=>{
 const x=io(),cas=x.target.casRtp;x.target.casRtp=async(...args)=>{const result=await cas(...args);x.rows.get(original()._id).data.money.end++;return result;};
 await assert.rejects(retagOwnHistoricalOriginal({document:original(),rtp:manifest.binding.rtp,target:x.target,audit:x.audit,key:'own',guard:async()=>{}}),/HISTORICAL_ORIGINAL_FULL_READBACK/);
 assert.deepEqual(x.order,['intent','cas']);assert(!x.entries.has('own:ack'));
});
test('unknown original read is attempted once and creates no audit entry',async()=>{
 const x=io();let reads=0;x.target.readOne=async()=>{reads++;throw Error('UNKNOWN_READ');};
 await assert.rejects(retagOwnHistoricalOriginal({document:original(),rtp:manifest.binding.rtp,target:x.target,audit:x.audit,key:'own',guard:async()=>{}}),/UNKNOWN_READ/);
 assert.equal(reads,1);assert.equal(x.entries.size,0);
});
test('production orchestration checks its immutable source before any baseline or business mutation',async()=>{
 let targetReads=0,auditWrites=0;
 await assert.rejects(deliverOwnHistoricalGame({manifest,owner:'999123:1:historical-32737',guard:async()=>{},native:{evidence:async()=>({state:null,receipt:null})},
 target:{count:async()=>{targetReads++;}},audit:{create:async()=>{auditWrites++;}},currentRtp:async()=>{}}),/HISTORICAL_IMMUTABLE_SOURCE_CHANGED/);
 assert.equal(targetReads,0);assert.equal(auditWrites,0);
});

test('durable immutable audit readback compares every owner, status, hash and value before continuing',async()=>{
 for(const alter of [v=>v.owner='foreign',v=>v.status='changed',v=>v.proofHash='b'.repeat(64),v=>v.immutable=false,v=>v.extra=true]){
  let creates=0,reads=0;const value={owner:'own',status:'validating',proofHash:'a'.repeat(64),immutable:true};
  const audit={create:async()=>{creates++;},read:async()=>{reads++;const v={_id:'own',...value};alter(v);return v;}};
  await assert.rejects(createOwnHistoricalImmutable({audit,key:'own',value,guard:async()=>{}}),/HISTORICAL_IMMUTABLE_FULL_READBACK/);
  assert.equal(creates,1);assert.equal(reads,1);
 }
});
test('unknown immutable audit ACK or independent readback is consumed once and never retried',async()=>{
 for(const unknown of ['create','read']){
  const calls=[];const audit={create:async()=>{calls.push('create');if(unknown==='create')throw Error('UNKNOWN_ACK');},read:async()=>{calls.push('read');throw Error('UNKNOWN_READ');}};
  await assert.rejects(createOwnHistoricalImmutable({audit,key:'own',value:{immutable:true,owner:'own'},guard:async()=>{}}),/UNKNOWN_/);
  assert.deepEqual(calls,unknown==='create'?['create']:['create','read']);
 }
});
test('protected private evidence permission cannot be borrowed from a foreign run or public flag',()=>{
 for(const alter of [g=>delete g.value.privateEvidence,g=>g.value.privateEvidence.gameId=32723,g=>g.value.privateEvidence.run='foreign:1',g=>g.value.privateEvidence.privateOnly=false]){
  const g=grant();alter(g);assert.throws(()=>assertOwnHistoricalGrant(g,execution,env),/HISTORICAL_PROTECTED_PRIVATE_EVIDENCE_REQUIRED/);
 }
});
