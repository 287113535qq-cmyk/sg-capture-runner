import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import path from 'node:path';
import {veryFruitySession,veryFruityPayload,veryFruityInit} from './veryfruity-session.mjs';
import {ACTION_CONTRACT_HASH} from './veryfruity-action-protocol.mjs';
const py=process.env.PYTHON??'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe';
function fixture(){const r=spawnSync(py,['-c','import json;from test_veryfruity_action_fields import fixture;p,r=fixture();print(json.dumps(p))'],{encoding:'utf8',env:{...process.env,PYTHONPATH:['service','service/tests'].join(path.delimiter)}});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
test('new demo session binds generation, run and worker; formal and wrong group are rejected',()=>{
 const p={...fixture(),trialId:'offline',demoGeneration:'a'.repeat(64),runnerGroup:'secondary'},b={mode:'demo',sessionId:'Free:offline',operatorId:'offline'};
 const a=veryFruitySession(b,p,20,'123:1');assert.equal(a,veryFruitySession(b,p,20,'123:1'));
 for(const [worker,run] of [[21,'123:1'],[20,'124:1']])assert.notEqual(a,veryFruitySession(b,p,worker,run));
 for(const change of [{countAllocation:'formal'},{runnerGroup:'primary'},{actionContractHash:'b'.repeat(64)}])assert.throws(()=>veryFruitySession(b,{...p,...change},20,'123:1'));
 assert.equal(p.actionContractHash,ACTION_CONTRACT_HASH);
});
test('Init advertised wager guards first paid request and leaves display fields independent',()=>{
 const p=fixture();assert(!veryFruityPayload(p,'Init','new').includes('Stake'));
 assert(veryFruityPayload(p,'Logic','next').includes('<Stake perLine="1" total="20"/>'));
 assert(!veryFruityPayload(p,'EndGame','next').includes('Stake'));
 const xml='<GameResponse type="Init"><Header gameID="20206" versionID="1_0" ccyCode="" lang="en_US" isRecovering="N" sessionID="next"/><Balances><Balance name="CASH_BALANCE" value="1000"/></Balances><Stakes>1|2|5|</Stakes><CurrencyMultiplier>1</CurrencyMultiplier><PaylineInfo>'+Array.from({length:20},(_,i)=>`<Payline index="${i}"/>`).join('')+'</PaylineInfo><DisplayExtension/></GameResponse>';
 assert.equal(veryFruityInit(p,xml).balance,1000);
 for(const x of [xml.replace('1|2|5|','2|5|'),xml.replace('isRecovering="N"','isRecovering="Y"'),xml.replace('</GameResponse>','<Recovery/></GameResponse>')])assert.throws(()=>veryFruityInit(p,x));
});
