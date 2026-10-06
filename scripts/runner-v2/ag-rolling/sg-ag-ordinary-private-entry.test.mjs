import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {EventEmitter} from 'node:events';import {execFileSync,spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {assertOrdinaryPrivatePipes,parseOrdinaryCredentials} from './sg-ag-ordinary-private-pipes.mjs';
import {assertOrdinaryPrivileges,assertOrdinaryProtectedGrant,verifyOrdinaryCaptureInventory} from './sg-ag-ordinary-admission.mjs';
import {createOrdinaryPrivateEvidence} from './sg-ag-ordinary-private-evidence.mjs';
import {connectOrdinaryMemoryGateway} from './sg-ag-ordinary-gateway.mjs';
import {verifyOrdinaryRuntimeFiles,requiredOrdinaryRuntimeFiles} from './sg-ag-ordinary-private-entry.mjs';
import {verifyBusinessLinuxEvidence,verifyOwnStrictLinux,BUSINESS_LINUX_REPOSITORY} from './sg-ag-ordinary-linux.mjs';
import {linuxPreparationTasks} from '../preparation-linux-evidence.mjs';import {digest} from './sg-business-delivery.mjs';
const env={GITHUB_ACTIONS:'true',RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_REPOSITORY:'zyzuoyang/sg-capture-runner',GITHUB_REF:'refs/heads/sg-ag-strict-control-20261006',GITHUB_JOB:'ag-rolling-strict-control',GITHUB_RUN_ID:'9999',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40)};
const identity={actorRun:'9999:1',actorCommit:env.GITHUB_SHA,uid:1001,directory:{dev:'1',ino:'4'}};
function metadata(){return {fstatSync:fd=>({uid:1001,mode:fd===4?0o700:0o600,dev:1,ino:fd+10,isFIFO:()=>fd!==4,isDirectory:()=>fd===4}),readlinkSync:p=>'pipe:['+(Number(p.split('/').at(-1))+10)+']',readFileSync:p=>'flags:\t00\nino:\t'+(Number(p.split('/').at(-1))+10)+'\n'};}
test('actual preauth and protected CLI stop on Windows before private input or clients',()=>{
 const pre=JSON.parse(execFileSync(process.execPath,['scripts/runner-v2/ag-rolling/sg-ag-ordinary-private-entry.mjs','--preauth'],{encoding:'utf8'}));assert.equal(pre.enabled,false);assert.equal(pre.newContinuationAllowed,false);
 if(process.platform!=='linux'){const r=spawnSync(process.execPath,['scripts/runner-v2/ag-rolling/sg-ag-ordinary-private-entry.mjs','--protected'],{input:'synthetic-must-not-be-read',env:{...process.env,...env},encoding:'utf8'});assert.equal(r.status,2);assert.equal(r.stdout,'');assert.match(r.stderr,/PRIVATE_ENTRY_STOP_NO_RETRY/);}
});
test('anonymous input metadata independently rejects UID, direction, duplicate inode and directory changes',()=>{
 assert.equal(assertOrdinaryPrivatePipes({env,io:metadata(),platform:'linux',euid:()=>1001}).actorRun,'9999:1');
 for(const mutate of [io=>{io.fstatSync=()=>({uid:0,isFIFO:()=>true,mode:0o600});},io=>{io.readFileSync=()=> 'flags:\t01\nino:\t10\n';},io=>{io.fstatSync=fd=>({uid:1001,mode:fd===4?0o755:0o600,dev:1,ino:10,isFIFO:()=>fd!==4,isDirectory:()=>fd===4});io.readlinkSync=()=> 'pipe:[10]';io.readFileSync=()=> 'flags:\t00\nino:\t10\n';}]){const io=metadata();mutate(io);assert.throws(()=>assertOrdinaryPrivatePipes({env,io,platform:'linux',euid:()=>1001}));}
 assert.throws(()=>assertOrdinaryPrivatePipes({env:{...env,GH_TOKEN:'synthetic'},io:metadata(),platform:'linux',euid:()=>1001}),/PRIVATE_PIPE_REQUIRED/);
});
test('credential envelope binds only the actual actor and accepts no extra or foreign key',()=>{
 const v={schema:'sg-ag-ordinary-private-credentials-v1',actorRun:identity.actorRun,actorCommit:identity.actorCommit,password:'synthetic',ghToken:'synthetic',nativeSshPrivateKey:'-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----',businessSshPrivateKey:'-----BEGIN OPENSSH PRIVATE KEY-----\nBBBB\n-----END OPENSSH PRIVATE KEY-----',evidenceKey:Buffer.alloc(32,4).toString('base64')};
 assert.equal(parseOrdinaryCredentials(structuredClone(v),identity).evidenceKey.length,32);
 for(const bad of [{...v,actorRun:'123:1'},{...v,actorCommit:'b'.repeat(40)},{...v,admin:'synthetic'},{...v,evidenceKey:'AAAA'}])assert.throws(()=>parseOrdinaryCredentials(bad,identity));
});
test('original 85 privileges are checked across all 81 databases without broad, extra, duplicate or removed actions',()=>{
 const registry=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')),profile=JSON.parse(fs.readFileSync('config/ag-rolling-queue-554533d7f75bedde74e5d9544dfb93188dfb7ad6ece00ae72da0fc051eb4dd31.json')),binding=JSON.parse(fs.readFileSync('config/ag-business-bindings.json')).bindings['32529'];
 const privileges=profile.payload.games.map(g=>({resource:{db:'sg_'+registry.plans[g.gameId].runtimeSlug,collection:'simulate'},actions:['update','find','insert']}));
 for(const [collection,actions] of Object.entries({capture_state_v2:['find'],capture_journal_v2:['find'],official_rounds:['find'],business_delivery_v1:['find','insert']}))privileges.push({resource:{db:'sg_capture_staging_v1',collection},actions});
 const fixture=p=>({authInfo:{authenticatedUsers:[{user:'sg_simulate_delivery_v1',db:'admin'}],authenticatedUserPrivileges:p}}),config={profile,plans:registry.plans,binding};assertOrdinaryPrivileges(fixture(privileges),config);
 for(const mutate of [p=>p.push(p[0]),p=>p[0].actions.push('remove'),p=>p[0].resource={anyResource:true},p=>p.splice(0,1),p=>p[1]=p[0]]){const p=structuredClone(privileges);mutate(p);assert.throws(()=>assertOrdinaryPrivileges(fixture(p),config));}
});
function grantFixture(){
 const descriptor={grantKey:'primary/strict-test',runtimeHash:'c'.repeat(64),entrySha256:'d'.repeat(64),evidenceKeyFingerprint:'e'.repeat(64),linux:{synthetic:true},captureEvidence:{synthetic:true},originalDocuments:Array.from({length:100},(_,i)=>({_id:String(i)})),ssh:{synthetic:true}};
 descriptor.expectedGrant={schema:'sg-ag-ordinary-protected-entry-v1',actorRun:identity.actorRun,actorCommit:identity.actorCommit,actorRepository:env.GITHUB_REPOSITORY,actorBranch:'sg-ag-strict-control-20261006',actorJob:env.GITHUB_JOB,workflow:'.github/workflows/trial-300k.yml',games:['32529'],sourceAllowance:0,resumeAllowance:0,nativeControllerScope:'original-primary-controller',mongoUsername:'sg_simulate_delivery_v1',originalPrivilegeCount:85,rtpAccount:'sgdelivery',rtpGame:'32529',cohortRun:'123:1',coordinatorRun:'123:1',captureCommit:'b'.repeat(40),runtimeHash:descriptor.runtimeHash,entrySha256:descriptor.entrySha256,linuxEvidenceHash:digest(descriptor.linux),captureEvidenceHash:digest(descriptor.captureEvidence),originalDocumentsHash:digest(descriptor.originalDocuments),originalCount:100,ssh:descriptor.ssh,evidenceDirectory:identity.directory,evidenceKeyFingerprint:descriptor.evidenceKeyFingerprint,uid:1001,publicationBoundaryProofHash:'f'.repeat(64),publicationCommit:identity.actorCommit};
 const document={_id:descriptor.grantKey,immutable:true,value:descriptor.expectedGrant};descriptor.grantDocumentHash=digest(document);return {descriptor,document};
}
test('whole protected grant binds own Linux, raw originals, entry, memory key, directory and distinct acting identity',()=>{
 const {descriptor,document}=grantFixture();assertOrdinaryProtectedGrant(document,descriptor,identity);
 for(const bad of [{...document,extra:true},{...document,value:{...document.value,originalCount:150}},{...document,value:{...document.value,actorRun:'123:1'}}])assert.throws(()=>assertOrdinaryProtectedGrant(bad,descriptor,identity));
 assert.throws(()=>assertOrdinaryProtectedGrant(document,{...descriptor,originalDocuments:descriptor.originalDocuments.slice(1)},identity));
 assert.throws(()=>assertOrdinaryProtectedGrant(document,descriptor,{...identity,directory:{dev:'1',ino:'5'}}));
});
test('actual capture inventory independently requires admit or join SUCCESS and all 20 exact own lanes',()=>{
 const actor={id:123,run_attempt:1,head_sha:'b'.repeat(40),head_branch:'main',repository:{full_name:env.GITHUB_REPOSITORY},event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',status:'in_progress'},rows=[{run_id:123,name:'ag-rolling-admit',status:'completed',conclusion:'success'},...Array.from({length:20},(_,i)=>({run_id:123,name:'AG rolling lane '+(i+1),status:i===0?'completed':'in_progress',conclusion:i===0?'failure':null}))],options={actor,jobs:{total_count:21,jobs:rows},repository:env.GITHUB_REPOSITORY,run:'123:1',commit:actor.head_sha,cohort:'primary'};
 assert.equal(verifyOrdinaryCaptureInventory(options),true);
 for(const mutate of [r=>r[0].conclusion='failure',r=>r[0].status='in_progress',r=>r[1].run_id=999,r=>r[2].name=r[1].name,r=>r[20].name='unexpected-source-job']){const jobs=structuredClone(options.jobs);mutate(jobs.jobs);assert.throws(()=>verifyOrdinaryCaptureInventory({...options,jobs}));}
});
const owner='9999:1:strict-ag-control',claimId='game:32529:'+'a'.repeat(64),page=(worker=0,end=100)=>({owner,claimId,phase:'delivered-page',worker,end,source:Array(100).fill({synthetic:true}),target:Array(100).fill({synthetic:true})});
const durable=(file,value)=>({fullReadback:true,durable:true,privateOnly:true,valueHash:digest(value)});
test('private full-page ACK refuses hash-only pages, duplicate worker pages and uncertain save replay',async()=>{
 const e=createOrdinaryPrivateEvidence({persist:durable,owner,claimId});await e.appendAndReadback(page());await assert.rejects(e.appendAndReadback(page()),/ALREADY_SAVED/);
 await assert.rejects(e.appendAndReadback({...page(0,200),source:[]}),/FULL_PAGE/);
 let writes=0;const broken=createOrdinaryPrivateEvidence({persist:()=>{writes++;throw Error('synthetic-unknown');},owner,claimId});await assert.rejects(broken.appendAndReadback(page()));await assert.rejects(broken.appendAndReadback(page(0,200)),/CONSUMED/);assert.equal(writes,1);
});
test('final private ACK requires every full 100-row page and confirms both full envelope and final receipt',async()=>{
 const e=createOrdinaryPrivateEvidence({persist:durable,owner,claimId}),full={owner,claimId,complete:{gameId:'32529',campaignCount:300000,fullReadback:true,independentlyVerified:true,originalUnchanged:true}};
 await assert.rejects(e.writeAndReadback(full),/ALL_300000/);
 for(let worker=0;worker<20;worker++)for(let end=100;end<=15000;end+=100)await e.appendAndReadback(page(worker,end));
 const ack=await e.writeAndReadback(full);assert.equal(ack.valueHash,digest(full.complete));assert.equal(ack.fullEnvelopeHash,digest(full));assert.equal(e.finalAckReceived,true);await assert.rejects(e.writeAndReadback(full),/CONSUMED/);
});
function fakeChannel(){const child=new EventEmitter();child.stdin=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();let writes=0,kills=0;child.stdin.write=(bytes,ack)=>{writes++;ack?.();};child.stdin.end=()=>{};child.kill=()=>{kills++;};return {child,identity:{open:command=>{assert.equal(command,'');return child;}},writes:()=>writes,kills:()=>kills};}
test('native transport waits for one real frame and poisons unknown ACK without reconnect or resend',async()=>{
 const f=fakeChannel(),t=connectOrdinaryMemoryGateway(f.identity);const p=t.request('hello');f.child.stdout.emit('data',Buffer.from('{"ok":true,"result":{"group":"primary"}}\n'));assert.deepEqual(await p,{group:'primary'});
 const unknown=t.request('cas',{collection:'state',key:'rolling-test'});f.child.emit('close',1);await assert.rejects(unknown,/UNKNOWN_NO_RETRY/);assert.throws(()=>t.request('cas',{}),/CONSUMED/);assert.equal(f.writes(),2);
});
test('native transport rejects unsolicited trailing frames before granting an ACK',async()=>{
 const f=fakeChannel(),t=connectOrdinaryMemoryGateway(f.identity);const p=t.request('create');f.child.stdout.emit('data',Buffer.from('{"ok":true,"result":{}}\n{}\n'));await assert.rejects(p,/UNKNOWN_NO_RETRY/);assert.equal(f.writes(),1);assert.equal(f.kills(),1);
});
test('own runtime manifest rejects changed bytes, path traversal and a foreign entry',()=>{
 const bytes=Buffer.from('synthetic-runtime'),sha=createHash('sha256').update(bytes).digest('hex'),files=Object.fromEntries([...Array.from({length:300},(_,i)=>'scripts/test-'+i+'.mjs'),...requiredOrdinaryRuntimeFiles].map(f=>[f,sha]));
 const d={runtimeFiles:files,runtimeHash:digest(files),entrySha256:sha};verifyOrdinaryRuntimeFiles(d,{root:'.',readBytes:()=>bytes});assert.throws(()=>verifyOrdinaryRuntimeFiles(d,{root:'.',readBytes:()=>Buffer.from('changed')}));
 const unsafe={...files,'scripts/../private':sha};assert.throws(()=>verifyOrdinaryRuntimeFiles({...d,runtimeFiles:unsafe,runtimeHash:digest(unsafe)},{root:'.',readBytes:()=>bytes}));
 assert.throws(()=>verifyOrdinaryRuntimeFiles({...d,entrySha256:'f'.repeat(64)},{root:'.',readBytes:()=>bytes}));
});
test('new candidate Linux requires its own exact 14 commands plus all nine full sealed task values',()=>{
 const commit='a'.repeat(40),run={id:777,repository:{full_name:BUSINESS_LINUX_REPOSITORY},head_sha:commit,head_branch:'sg-ag-strict-control-20261006',run_attempt:1,event:'workflow_dispatch',path:'.github/workflows/preflight.yml',status:'completed',conclusion:'success'},jobs={total_count:1,jobs:[{id:88,run_id:777,name:'preflight',status:'completed',conclusion:'success'}]};let n=0;
 const result={schema:'sg-offline-preflight-v1',passed:true,complete:true,sourceRequests:0,mongoWrites:0,runs:[{workers:3,passed:true,groups:Object.entries({python:8,'collector-protocol':3,'runner-persistence':3}).map(([group,count])=>({group,passed:true,expectedCommands:count,commands:Array.from({length:count},()=>({exitCode:0,argvHash:String(++n).padStart(64,'0')}))}))}]};
 const index={games:[]},origin={repository:BUSINESS_LINUX_REPOSITORY,runId:'777',attempt:'1',commit,workflow:'.github/workflows/preflight.yml'},tasks=linuxPreparationTasks({root:process.cwd(),index,result,origin}),e={run,jobs,result,index,tasks};assert.equal(verifyOwnStrictLinux(e,commit,process.cwd()).sealedTasks,9);
 assert.throws(()=>verifyBusinessLinuxEvidence({...e,run:{...run,head_branch:'sg-business-delivery-20261005'}},777,commit));assert.throws(()=>verifyOwnStrictLinux({...e,tasks:tasks.slice(1)},commit,process.cwd()));
 const altered=structuredClone(tasks);altered[0].receipt.supportingHashes=['f'.repeat(64)];assert.throws(()=>verifyOwnStrictLinux({...e,tasks:altered},commit,process.cwd()));assert.throws(()=>verifyOwnStrictLinux(e,'b'.repeat(40),process.cwd()));
});
