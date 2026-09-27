import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {nextRequest,roundMapping,SQUID_SOURCE} from './squid-protocol.mjs';

const step=(msg,response,extra='')=>({msgId:msg,requestPayload:`GN=squidgameonemoregame96&PID=gdmgcmfixture&MSGID=${msg}${extra}`,responsePayload:`MSGID=${msg}&${response}`});
const trigger=step('BET','B=98283&AB=97783&TW=500&FID=1|&CFG=1&FS_1=0&NFR_1=1&FPM_1=|&FTV_1=2500;3;3;4;4;4;|');
test('jackpot start without state tags preserves three picks and mandatory end',()=>{
  const raw={sourceKey:SQUID_SOURCE,steps:[trigger]};
  assert.deepEqual(nextRequest(raw),{MSGID:'FEATURE_START',CFG:'1'});
  raw.steps.push(step('FEATURE_START','B=98283&AB=97783&TW=500','&CFG=1'));
  for(let i=0;i<3;i++){
    assert.deepEqual(nextRequest(raw),{MSGID:'FEATURE_PICK',CFG:'1',FP:`1|${i+1}|${i}`});
    raw.steps.push(step('FEATURE_PICK','B=98283&AB=97783&TW=500',`&CFG=1&FP=1|${i+1}|${i}`));
  }
  assert.deepEqual(nextRequest(raw),{MSGID:'FEATURE_END',CFG:'1'});
  raw.steps.push(step('FEATURE_END','B=100783&AB=100783&TW=3000','&CFG=1'));
  assert.equal(nextRequest(raw),null);
  assert.deepEqual(roundMapping(raw,'base','extended'),{buy:0,bonus:2,typeMappingHash:'extended'});
});
test('a failed source response does not authorize another pick',()=>{
  const raw={sourceKey:SQUID_SOURCE,steps:[trigger,step('FEATURE_START','MSGID=ERROR','&CFG=1')]};
  assert.throws(()=>nextRequest(raw));
});
test('Runner fields match independent Python analysis for jackpot and combined settlement',()=>{
  const require=createRequire(import.meta.url);
  require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
  const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
  const result=spawnSync(process.env.PYTHON || 'python',['-c',
    "import sys,json;sys.path[:0]=['service','service/tests'];from test_squid_fields import sample,PLAN;from squid_fields import SquidFields;print(json.dumps([{'raw':sample(c),'fields':SquidFields(PLAN).settled(sample(c))} for c in [False,True]]))"],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  for(const {raw,fields} of JSON.parse(result.stdout)){
    assert.equal(nextRequest(raw),null);
    assert.deepEqual(prepareNextgenRound(raw,roundMapping(raw,'base',fields.typeMappingHash)),fields);
  }
});
