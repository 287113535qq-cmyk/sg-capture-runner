import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyTerminal} from './sg-own-terminal.mjs';
import {automaticFreePrefix} from './sg-automatic-free.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
import {analyzer} from '../analyzer.mjs';
import {params} from '../../trial/capture-batch.mjs';
const home=path.dirname(fileURLToPath(import.meta.url));
const fixtures=JSON.parse(fs.readFileSync(path.join(home,'sg-own-terminal-cases.json')));
function edit(raw,index,key,value){const step=raw.steps[index<0?raw.steps.length+index:index],pairs=step.responsePayload.split('&').filter(Boolean).map(s=>s.split(/=(.*)/s).slice(0,2)),v=Object.fromEntries(pairs);v[key]=value;
 step.responsePayload=Object.entries(v).map(([k,v])=>`${k}=${v}`).join('&');step.responseXml='<?xml version="1.0"?><GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD><![CDATA['+step.responsePayload+']]></PAYLOAD></GDMRESPONSE>';}
const corpus=[];
const additional=JSON.parse(fs.readFileSync(path.join(home,'sg-own-terminal-additional-cases.json')));
for(const [i,f] of additional.entries()){
 corpus.push({input:f,accepted:true});
 test(`additional own complete terminal ${i} keeps the balance equation`,()=>{
  const v=verifyTerminal(f.plan,f.raw);assert.equal(v.endBalanceRaw,v.startBalanceRaw-v.betRaw+v.totalWinRaw);
 });
}
for(const f of fixtures){
 test(`${f.gameId} immutable full terminal fails old policy and reconciles complete money in candidate`,()=>{
  assert.throws(()=>automaticFreePrefix(f.plan,f.raw),/UNREVIEWED_AUTOMATIC_TERMINAL/);
  const out=verifyTerminal(f.plan,f.raw);assert.equal(out.endBalanceRaw,out.startBalanceRaw-out.betRaw+out.totalWinRaw);
  assert.equal(out.totalWinRaw,f.gameId==='32708'?2885:7000);assert.equal(out.bonus,1);
 });
 corpus.push({input:f,accepted:true});
 const damages=[['wrong game',x=>x.plan.gameId=32741],['wrong stake',x=>x.plan.betRaw++],['truncated',x=>x.raw.steps.pop()],
  ['changed intermediate win',x=>edit(x.raw,1,'TW','999999')],['changed final balance',x=>edit(x.raw,-1,'AB','1')],
  ['changed win delta',x=>edit(x.raw,-1,'CW','1')],['pending free',x=>edit(x.raw,-1,'NFG','1')],
  ['unknown feature',x=>edit(x.raw,-1,'FID','9|')],['counter',x=>edit(x.raw,-1,'CFGG','0')],
  ['free total',x=>edit(x.raw,-1,'FGTW','1')],['new explicit key',x=>edit(x.raw,-1,'FS_2','1')],
  ['request mode',x=>x.raw.steps.at(-1).requestPayload+='&REC=1'],['changed player',x=>x.raw.steps.at(-1).requestPayload=x.raw.steps.at(-1).requestPayload.replace(/PID=[^&]+/,'PID=gdmgcmother')],
  ['changed response session',x=>edit(x.raw,-1,'SID','changed')],['observer',x=>x.raw.steps.at(-1).responseBalance++],
  ['rejected response',x=>x.raw.steps.at(-1).sourceRejected=true],['bad XML',x=>x.raw.steps.at(-1).responseXml=x.raw.steps.at(-1).responseXml.replace('<SUCCESS>true','<SUCCESS>false')],
  ['timing',x=>x.raw.steps.at(-1).elapsedMs=300001],['unfinished nested feature',x=>{const raw=x.raw.steps.at(-1).responsePayload;const g=Object.fromEntries(raw.split('&').filter(Boolean).map(s=>s.split(/=(.*)/s).slice(0,2))).GSD;edit(x.raw,-1,'GSD',f.gameId==='32708'?g+'#SNFG~1':g.replace('WHEEL;4000|','WHEEL;3999|'));}]];
 for(const [label,change] of damages){const x=structuredClone(f);change(x);corpus.push({input:x,accepted:false});test(`${f.gameId} rejects ${label}`,()=>assert.throws(()=>verifyTerminal(x.plan,x.raw)));}
}
test('independent Python agrees on both real terminals and every damaged frame',()=>{
 const python=process.env.SG_TEST_PYTHON??'python3';
 const p=spawnSync(python,[path.join(home,'sg-own-terminal-fixtures.py')],{input:JSON.stringify(corpus.map(x=>x.input)),encoding:'utf8',timeout:30000});
 assert.equal(p.status,0,p.stderr);const outputs=JSON.parse(p.stdout);assert.equal(outputs.length,corpus.length);
 for(let i=0;i<corpus.length;i++){assert.equal(outputs[i].accepted,corpus[i].accepted,`case ${i}`);if(outputs[i].accepted)assert.deepEqual(outputs[i].value,verifyTerminal(corpus[i].input.plan,corpus[i].input.raw));}
});
for(const gameId of [32708,32715])test(`own ${gameId} actual codec and Python record verification with session-redacted evidence`,async()=>{
 const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans[gameId];let sequence=0;
 for(const f of additional.filter(f=>f.plan.gameId===gameId)){
  const codec=await nextgenCodec({plan,session:{pid:params(f.raw.steps[0].requestPayload).PID},sequence:()=>++sequence,worker:0,batchId:1,
   createAnalyzer:()=>analyzer({python:process.env.SG_TEST_PYTHON??'python3'})});
  try{const raw=codec.createRaw({balance:f.raw.startBalanceRaw});
   for(const step of f.raw.steps){const next=await codec.next(raw);assert.deepEqual(params(codec.payload(next)),params(step.requestPayload));raw.steps.push(step);}
   assert.equal(await codec.next(raw),null);const result=await codec.prepare(raw,{attempt:'offline-redacted-terminal',sessionHash:'a'.repeat(64)});
   assert.equal(result.independentlyVerified,true);assert.deepEqual(result.record.raw,raw);
   assert.equal(result.record.normalized.money.totalWinRaw,verifyTerminal(f.plan,f.raw).totalWinRaw);
   await assert.rejects(()=>codec.next(f.raw),/UNREVIEWED_AUTOMATIC_TERMINAL/);
  }finally{codec.close();}
 }
});
