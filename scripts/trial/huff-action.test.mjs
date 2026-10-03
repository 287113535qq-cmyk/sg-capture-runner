import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {huffActionNext,ACTION_CONTRACT_HASH} from './huff-action-protocol.mjs';
import {actionContract} from './pyramids-action-contracts.mjs';
import {huffNextRequest,huffMapping} from './huff-protocol.mjs';
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({transpileOnly:true,project:'collector/tsconfig.json'});
const {huffActionNext:collectorNext,prepareNextgenActionRound}=require('../../collector/sg.huff-action.ts');
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const vector=JSON.parse(fs.readFileSync(new URL('./fixtures/huff-action.json',import.meta.url)));
const plan=vector.plan;
const normalize=raw=>prepareNextgenActionRound(raw,plan);
const xml=p=>'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+p.replaceAll('&','&amp;')+'</PAYLOAD><OGS_RC>0</OGS_RC></GDMRESPONSE>';
function response(raw,index,values){
  const s=raw.steps[index],p=Object.fromEntries(s.responsePayload.split('&').map(v=>v.split('=')));
  Object.assign(p,values);for(const k of Object.keys(p))if(p[k]===undefined)delete p[k];
  s.responsePayload=Object.entries(p).map(([k,v])=>k+'='+v).join('&');s.responseXml=xml(s.responsePayload);
}
test('known FID3 follows its validated action, independent of cosmetic fields and gameplay classification',()=>{
  assert.equal(actionContract(plan).collectorKind,'huffAction');
  const raw=structuredClone(vector.raw);
  for(let count=0;count<=raw.steps.length;count++){
    const prefix={...raw,steps:raw.steps.slice(0,count)};
    assert.deepEqual(huffActionNext(plan,prefix),collectorNext(prefix,plan));
    assert.deepEqual(huffActionNext(plan,prefix),count===raw.steps.length?null:{MSGID:count?'FREE_GAME':'BET'});
  }
  assert.equal(ACTION_CONTRACT_HASH,plan.actionContractHash);
  const fields=normalize(raw);assert.equal(fields.bonus,null);assert.equal(fields.classificationStatus,'pending');
  assert.deepEqual(fields.money,{startBalanceRaw:100000,endBalanceRaw:100250,totalWinRaw:750,betRaw:500});
  raw.steps[2].responsePayload+='&UNKNOWN_DISPLAY=1.250';raw.steps[2].responseXml=xml(raw.steps[2].responsePayload);
  assert.deepEqual(normalize(raw),fields);
});
test('unverified requests, transitions, XML, counters and money are rejected by both implementations',()=>{
  const mutations=[
    r=>response(r,1,{FID:'5|'}),r=>response(r,1,{NFG:undefined}),r=>response(r,2,{CFGG:'0'}),
    r=>response(r,2,{TFG:'7'}),r=>response(r,2,{B:'99501'}),r=>response(r,7,{AB:'99500'}),
    r=>response(r,2,{GCT:'1'}),r=>response(r,2,{CFG:'1'}),r=>response(r,2,{FID:'4|'}),
    r=>{r.steps[2].requestPayload=r.steps[2].requestPayload.replace('gdmgcmoffline-vector','gdmgcmother');},
    r=>{r.steps[2].responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>different</PAYLOAD></GDMRESPONSE>';},
    r=>response(r,7,{GSD:'FEAT~HOMEIMP#FRAMEWINS~'+['-100',...Array(19).fill('0')].join('|')}),
    r=>response(r,7,{GSD:'FEAT~HOMEIMP#VA~'+[13,13,13,14,14,14,14,14,14].join(',')}),
  ];
  for(const mutate of mutations){const raw=structuredClone(vector.raw);mutate(raw);
    assert.throws(()=>huffActionNext(plan,raw));assert.throws(()=>collectorNext(raw,plan));}
});
test('partial FID3 evidence continues but cannot count as a completed round',()=>{
  const raw={...vector.raw,steps:vector.raw.steps.slice(0,2)};
  assert.deepEqual(huffActionNext(plan,raw),{MSGID:'FREE_GAME'});assert.throws(()=>normalize(raw),/INCOMPLETE/);
  assert.throws(()=>huffActionNext({...plan,actionContractHash:'b'.repeat(64)},raw),/PROFILE/);
});
test('original base entry handles reviewed FID3 without rewriting raw or assigning a gameplay type',()=>{
  const raw=structuredClone(vector.raw);delete raw.requestFlowVersion;delete raw.actionContractHash;
  const before=JSON.stringify(raw);
  for(let count=2;count<=raw.steps.length;count++){
    const prefix={...raw,steps:raw.steps.slice(0,count)};
    assert.deepEqual(huffNextRequest(prefix),huffActionNext(plan,{...vector.raw,steps:vector.raw.steps.slice(0,count)}));
  }
  const mapping=huffMapping(raw,'a'.repeat(64));
  assert.equal(mapping.bonus,null);
  assert.deepEqual(prepareNextgenRound(raw,mapping),normalize(vector.raw));
  assert.equal(JSON.stringify(raw),before);
  const partial={...raw,steps:raw.steps.slice(0,2)};
  assert.throws(()=>huffMapping(partial,'a'.repeat(64)),/INCOMPLETE/);
  assert.throws(()=>prepareNextgenRound(partial,mapping),/INCOMPLETE/);
  assert.throws(()=>prepareNextgenRound(raw,{...mapping,bonus:3}),/MAPPING/);
});
