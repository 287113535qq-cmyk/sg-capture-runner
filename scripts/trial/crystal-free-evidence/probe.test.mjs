import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants,createHash} from 'node:crypto';
import {collect,playPayload,encryptedJournal,assertSingleGithubAttempt,INTENT} from './probe.mjs';
const init=JSON.parse(fs.readFileSync(new URL('../../../config/ag-rolling-own-wms-init-fixtures.json',import.meta.url)))['32759'];
const trigger=JSON.parse(fs.readFileSync(new URL('./route-vectors-private.json',import.meta.url))).cases[0].input.xml;
const base={mode:'demo',sessionId:'Free:offline-probe-only',operatorId:'offline-operator'};
const header=trigger.match(/<Header[^>]*\/>/)[0];
const cash=trigger.match(/<Balance name="CASH_BALANCE" value="([0-9]+)"/)[1];
const end=`<GameResponse type="EndGame">${header}<AccountData/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const ordinary=trigger.replace(/<FSInfo[^>]*\/>/,'');
const events=()=>{const a=[];return {a,write:x=>a.push(structuredClone(x))};};
const response=(xml,status=200)=>({ok:status===200,status,text:async()=>xml,headers:{getSetCookie:()=>[]}});
test('only pinned public encryption key is part of this runnable artifact',()=>{
 const b=fs.readFileSync(new URL('./evidence-public.pem',import.meta.url));
 assert.equal(createHash('sha256').update(b).digest('hex'),'47d7727f2e1134a14b6b94ae45793a45034c02df859eba9e1d6e4ebdb87fdfe1');
 assert(b.toString().includes('BEGIN PUBLIC KEY'));assert(!b.toString().includes('PRIVATE'));
});
function scripted(xmls){let n=0;const calls=[];return {calls,fetchSource:async(url,opts)=>{calls.push({url,body:opts.body});assert(n<xmls.length);return response(xmls[n++]);}};}
test('bounded ordinary observation creates no production credit and preserves intent before response',async()=>{
 const j=events(),s=scripted([init.responseXml,ordinary,end]);const r=await collect({base,journal:j,fetchSource:s.fetchSource,maxStarts:1});
 assert.equal(r.completedObservationRounds,1);assert.equal(r.naturalFeatureTerminals,0);assert.equal(r.captureCredit,0);assert.equal(r.databaseWrites,0);
 assert.equal(j.a.filter(x=>x.kind==='intent').length,3);assert.equal(j.a.filter(x=>x.kind==='response').length,3);
 for(const x of j.a.filter(x=>x.kind==='response'))assert(j.a.findIndex(y=>y.kind==='intent'&&y.requestNo===x.requestNo)<j.a.indexOf(x));
 assert(s.calls[1].body.includes('<Stake total="25" fsOn="1" />'));
});
test('synthetic full routing exercise never issues early EndGame or awards validated capture',async()=>{
 const replies=[init.responseXml,trigger];for(let i=1;i<=7;i++)replies.push(trigger.replace('freeSpinNumber="0"',`freeSpinNumber="${i}"`).replace('freeSpin="N"','freeSpin="Y"'));
 replies.push(end);const j=events(),s=scripted(replies),r=await collect({base,journal:j,fetchSource:s.fetchSource,maxStarts:1});
 assert.equal(r.naturalFeatureTerminals,1);assert.equal(r.sourceRequests,10);assert.equal(r.captureCredit,0);assert.equal(r.activeRound,false);
 assert.equal(s.calls.filter(x=>x.body.includes('type="EndGame"')).length,1);assert(s.calls.at(-1).body.includes('type="EndGame"'));
 assert(j.a.filter(x=>x.kind==='round-end').every(x=>x.independentlyMoneyValidated===false));
});
test('transport uncertainty is single attempt, fully retained, never replayed',async()=>{
 const j=events();let calls=0;const r=await collect({base,journal:j,fetchSource:async()=>{calls++;throw Error('TIMEOUT');}});
 assert.equal(calls,1);assert.equal(r.unknownTransportOutcome,true);assert.equal(r.completedObservationRounds,0);assert.equal(j.a.filter(x=>x.kind==='intent').length,1);assert.equal(j.a.at(-1).kind,'closed');
});
test('unknown free payload closes only this evidence attempt, without forcing EndGame',async()=>{
 const j=events(),s=scripted([init.responseXml,trigger.replace('<FSInfo ','<FSInfo unknown="1" ')]),r=await collect({base,journal:j,fetchSource:s.fetchSource});
 assert.equal(r.status,'evidence-stopped');assert.equal(r.sourceRequests,2);assert.equal(r.activeRound,true);assert.equal(r.naturalFeatureTerminals,0);
});
test('HTTP rejection has durable response, no automatic resend',async()=>{
 const j=events();let n=0;const r=await collect({base,journal:j,fetchSource:async()=>response(n++?'<Error/>':init.responseXml,n===1?200:503)});
 assert.equal(n,2);assert.equal(r.unknownTransportOutcome,false);assert.equal(r.activeRound,true);assert.equal(r.completedObservationRounds,0);
});
test('EndGame balance change is not a completed observation',async()=>{
 const j=events(),s=scripted([init.responseXml,ordinary,end.replace(`value="${cash}"`,`value="${Number(cash)+1}"`)]),r=await collect({base,journal:j,fetchSource:s.fetchSource,maxStarts:1});
 assert.equal(r.error,'ENDGAME_EVIDENCE_CHANGED');assert.equal(r.completedObservationRounds,0);assert.equal(r.activeRound,true);
});
test('unknown fields outside FSInfo are not silently accepted',async()=>{
 const j=events(),s=scripted([init.responseXml,trigger.replace('<ReelSpin ','<ReelSpin extra="1" ')]),r=await collect({base,journal:j,fetchSource:s.fetchSource});
 assert.equal(r.error,'UNREVIEWED_EVIDENCE_SHAPE');assert.equal(r.completedObservationRounds,0);
});
test('bounded count preserves unresolved state and stops new requests',async()=>{
 const j=events(),s=scripted([init.responseXml,trigger]),r=await collect({base,journal:j,fetchSource:s.fetchSource,maxRequests:2});
 assert.equal(r.sourceRequests,2);assert.equal(r.activeRound,true);assert.equal(r.error,'EVIDENCE_BOUND_REACHED');
});
test('only fresh anonymous demo credentials may be used',async()=>{
 for(const b of [{...base,mode:'real'},{...base,sessionId:'old-session'}, {...base,operatorId:''}]){
  let n=0;await assert.rejects(collect({base:b,journal:events(),fetchSource:async()=>{n++;}}));assert.equal(n,0);
 }
});
test('journal encrypts, authenticates, chains and atomically forbids a duplicate file',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crystal-journal-')),file=path.join(dir,'private.enc');
 try{
  const pair=generateKeyPairSync('rsa',{modulusLength:2048});const j=encryptedJournal(file,pair.publicKey);j.write({kind:'intent',secret:'offline-secret'});j.write({kind:'response',value:7});j.close();
  assert.throws(()=>encryptedJournal(file,pair.publicKey));const text=fs.readFileSync(file,'utf8');assert(!text.includes('offline-secret'));
  const [head,...rows]=text.trim().split('\n').map(JSON.parse),key=privateDecrypt({key:pair.privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(head.wrappedKey,'base64'));
  let previous='0'.repeat(64);const decoded=[];
  for(const row of rows){const {hash,...body}=row;assert.equal(hash,createHash('sha256').update(JSON.stringify(body)).digest('hex'));assert.equal(body.previous,previous);
   const c=createDecipheriv('aes-256-gcm',key,Buffer.from(body.iv,'base64'));c.setAAD(Buffer.from(`${INTENT}:${body.sequence}:${previous}`));c.setAuthTag(Buffer.from(body.tag,'base64'));
   decoded.push(JSON.parse(Buffer.concat([c.update(Buffer.from(body.ciphertext,'base64')),c.final()])));previous=hash;
  }
  assert.equal(decoded[0].secret,'offline-secret');assert.equal(decoded[1].value,7);assert.equal(previous,j.hash);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
const env={GITHUB_ACTIONS:'true',RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_REPOSITORY:'287113535qq-cmyk/sg-capture-runner',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123',GITHUB_TOKEN:'offline',GITHUB_WORKFLOW_REF:'287113535qq-cmyk/sg-capture-runner/.github/workflows/trial-session-check.yml@refs/heads/sg-crystal-free-evidence-20261008'};
const listing=(total=1,id=123)=>async()=>({ok:true,json:async()=>({total_count:total,workflow_runs:[{id,head_sha:env.GITHUB_SHA}]})});
test('own first GitHub diagnostic identity is accepted',async()=>{await assertSingleGithubAttempt(env,listing());});
for(const [label,e,f]of [['rerun',{...env,GITHUB_RUN_ATTEMPT:'2'},listing()],['other-host',{...env,RUNNER_ENVIRONMENT:'self-hosted'},listing()],['wrong-workflow',{...env,GITHUB_WORKFLOW_REF:'other'},listing()],['duplicate-run',env,listing(2)],['wrong-run',env,listing(1,124)]])test('single-use guard rejects '+label,async()=>{await assert.rejects(assertSingleGithubAttempt(e,f));});
