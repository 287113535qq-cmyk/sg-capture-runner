import assert from 'node:assert/strict';import test from 'node:test';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
import {huffNextRequest,huffMapping} from './huff-protocol.mjs';
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json'});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const p=spawnSync(process.env.PYTHON||'python3',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_huff_retrigger import sample;from test_huff_fields import PLAN;from huff_fields import HuffFields;r=sample();print(json.dumps({'raw':r,'fields':HuffFields(PLAN).settled(r)}))"],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);const {raw,fields}=JSON.parse(p.stdout);

test('fractional frame multipliers settle identically while Mansion sentinels do not become cash terminals',()=>{
 const change=value=>{
  const r=structuredClone(raw),step=r.steps.at(-1),params=Object.fromEntries(step.responsePayload.split('&').map(x=>x.split('=')));
  const g=Object.fromEntries(params.GSD.split('#').map(x=>x.split('~')));
  g.FRAMEWINS=[value,...Array(14).fill('0')].join('|');g.FRAMES=Array(15).fill('0').join('|');
  params.GSD=Object.entries(g).map(([k,v])=>k+'~'+v).join('#');step.responsePayload=Object.entries(params).map(([k,v])=>k+'='+v).join('&');
  step.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+step.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';
  return r;
 };
 const r=change('1.5'),py=spawnSync(process.env.PYTHON||'python3',['-c',"import json,sys;sys.path.insert(0,'service');from huff_fields import HuffFields;from huff_retrigger_review import PLAN;print(json.dumps(HuffFields(PLAN).settled(json.load(sys.stdin))))"],{input:JSON.stringify(r),encoding:'utf8'});
 assert.equal(py.status,0,py.stderr);const expected=JSON.parse(py.stdout);assert.equal(huffNextRequest(r),null);
 assert.deepEqual(prepareNextgenRound(r,huffMapping(r,'a'.repeat(64),{retrigger:expected.typeMappingHash})),expected);
 for(const code of ['-1','-2','-3','-4.00','-5']){
  const display=change(code);assert.equal(huffNextRequest(display),null);
  assert.deepEqual(prepareNextgenRound(display,huffMapping(display,'a'.repeat(64),{retrigger:expected.typeMappingHash})),expected);
 }
 for(const code of ['-6','-4.1']){
  const unknown=change(code);assert.throws(()=>huffNextRequest(unknown));
  assert.throws(()=>prepareNextgenRound(unknown,{buy:0,bonus:2,typeMappingHash:expected.typeMappingHash}));
 }
 const sentinel=change('-100');assert.throws(()=>huffNextRequest(sentinel),/HUFF_FRAME_EXIT_NOT_ADAPTED/);
 assert.throws(()=>prepareNextgenRound(sentinel,{buy:0,bonus:2,typeMappingHash:expected.typeMappingHash}),/HUFF_FRAME_EXIT_NOT_ADAPTED/);
});

test('earned previous slots persist on later frames without a new award',()=>{
 const r=structuredClone(raw);
 for(const s of r.steps.slice(3))for(const k of ['responsePayload','responseXml'])s[k]=s[k].replace('PCFID~1|','PCFID~1|1|');
 for(let i=3;i<r.steps.length;i++)assert.deepEqual(huffNextRequest({...r,steps:r.steps.slice(0,i)}),{MSGID:'FREE_GAME'});
 assert.equal(huffNextRequest(r),null);
 assert.deepEqual(prepareNextgenRound(r,huffMapping(r,'a'.repeat(64),{retrigger:fields.typeMappingHash})),fields);
 const unearned=structuredClone(raw);
 for(const k of ['responsePayload','responseXml'])unearned.steps[1][k]=unearned.steps[1][k].replace('PCFID~1|','PCFID~1|1|');
 assert.equal(huffNextRequest(unearned),null);
 assert.deepEqual(prepareNextgenRound(unearned,huffMapping(unearned,'a'.repeat(64),{retrigger:fields.typeMappingHash})),fields);
});
test('ordered previous slots preserve six-spin flow without any additional award',()=>{
 const r=structuredClone(raw);r.steps=r.steps.slice(0,7);
 for(const [i,s]of r.steps.entries()){
  const p=Object.fromEntries(s.responsePayload.split('&').map(x=>x.split('=')));
  Object.assign(p,{TFG:'6',NFG:String(6-i),CFGG:String(i)});
  const g=Object.fromEntries(p.GSD.split('#').map(x=>x.split('~')));
  if(i)Object.assign(g,{CFFGT:'0',CFTFG:'6',CFNFG:String(6-i),CFCFGG:String(i),PCFID:'1|'.repeat(i)});
  p.GSD=Object.entries(g).map(([k,v])=>k+'~'+v).join('#');
  s.responsePayload=Object.entries(p).map(([k,v])=>k+'='+v).join('&');
  s.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';
 }
 for(let i=1;i<7;i++)assert.deepEqual(huffNextRequest({...r,steps:r.steps.slice(0,i)}),{MSGID:'FREE_GAME'});
 assert.equal(huffNextRequest(r),null);
 const py=spawnSync(process.env.PYTHON||'python3',['-c',"import json,sys;sys.path.insert(0,'service');from huff_fields import HuffFields;from huff_retrigger_review import PLAN;print(json.dumps(HuffFields(PLAN).settled(json.load(sys.stdin))))"],{input:JSON.stringify(r),encoding:'utf8'});
 assert.equal(py.status,0,py.stderr);const expected=JSON.parse(py.stdout);
 assert.deepEqual(prepareNextgenRound(r,huffMapping(r,'a'.repeat(64),{retrigger:expected.typeMappingHash})),expected);
 for(const bad of ['1||','1|0|','1|2|','1|'.repeat(101)]){
  const changed=structuredClone(r);for(const k of ['responsePayload','responseXml'])changed.steps[2][k]=changed.steps[2][k].replace('PCFID~1|1|','PCFID~'+bad);
  assert.throws(()=>huffNextRequest(changed));assert.throws(()=>prepareNextgenRound(changed,{buy:0,bonus:2,typeMappingHash:expected.typeMappingHash}));
 }
});

test('Hard Hat retrigger keeps prefix incomplete and gives three-way identical settlement',()=>{
 for(let i=1;i<raw.steps.length;i++)assert.deepEqual(huffNextRequest({...raw,steps:raw.steps.slice(0,i)}),{MSGID:'FREE_GAME'});
 assert.equal(huffNextRequest(raw),null);const m=huffMapping(raw,'a'.repeat(64),{retrigger:fields.typeMappingHash});assert.deepEqual(prepareNextgenRound(raw,m),fields);
 assert.throws(()=>huffMapping(raw,'a'.repeat(64),{hardHat:fields.typeMappingHash}));
});
test('single previous Hard Hat slot keeps additive counters and three-way settlement',()=>{
 const r=structuredClone(raw);for(const s of r.steps)for(const k of ['responsePayload','responseXml'])s[k]=s[k].replace('PCFID~1|1|','PCFID~1|');
 for(let i=1;i<r.steps.length;i++)assert.deepEqual(huffNextRequest({...r,steps:r.steps.slice(0,i)}),{MSGID:'FREE_GAME'});
 assert.equal(huffNextRequest(r),null);assert.deepEqual(prepareNextgenRound(r,huffMapping(r,'a'.repeat(64),{retrigger:fields.typeMappingHash})),fields);
 const wrong=structuredClone(r);for(const k of ['responsePayload','responseXml'])wrong.steps[2][k]=wrong.steps[2][k].replace('CFFGT~1','CFFGT~0');
 assert.throws(()=>huffNextRequest(wrong));assert.throws(()=>prepareNextgenRound(wrong,{buy:0,bonus:2,typeMappingHash:fields.typeMappingHash}));
 for(const k of ['responsePayload','responseXml'])r.steps[2][k]=r.steps[2][k].replace('PCFID~1|','PCFID~0|');
 assert.throws(()=>huffNextRequest(r));assert.throws(()=>prepareNextgenRound(r,{buy:0,bonus:2,typeMappingHash:fields.typeMappingHash}));
});
test('Hard Hat retrigger independently rejects mismatched slots, counters, mixed features and replay',()=>{
 for(const [from,to]of [['PCFID~1|1|','PCFID~1|0|'],['CFFGT~1','CFFGT~0'],['FID=1|','FID=1|2|'],['RID=1','RID=0'],['NFG=5','NFG=0']]){
 const r=structuredClone(raw);for(const k of ['responsePayload','responseXml'])r.steps[2][k]=r.steps[2][k].replace(from,to);
 assert.throws(()=>huffNextRequest(r));assert.throws(()=>prepareNextgenRound(r,{buy:0,bonus:2,typeMappingHash:fields.typeMappingHash}));
 }
});
