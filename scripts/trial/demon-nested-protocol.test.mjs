import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {nextRequest,roundMapping} from './squid-protocol.mjs';
import {DEMON_NESTED_EXTENSION} from './demon-nested-protocol.mjs';
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const {nestedNext}=require('../../collector/sg.demon.ts');
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const cases=JSON.parse(fs.readFileSync('fixtures/demon-nested-synthetic.json','utf8'));
const registry=JSON.parse(fs.readFileSync('service/round_types.json','utf8'));
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
const hash=createHash('sha256').update(canonical(registry.profiles[DEMON_NESTED_EXTENSION])).digest('hex');
test('portable nested boundaries agree in actual Runner and TypeScript entrypoints',()=>{
 for(const c of cases){if(c.reject){assert.throws(()=>nextRequest(c.raw),c.name);assert.throws(()=>nestedNext(c.raw),c.name);}
 else {assert.deepEqual(nextRequest(c.raw),c.next,c.name);assert.deepEqual(nestedNext(c.raw),c.next,c.name);}}
});
test('nested mapping is distinct and TypeScript reconciles synthetic terminal money',()=>{
 const raw=cases.find(c=>c.name==='explicit outer terminal').raw;
 const mapping=roundMapping(raw,'base',{nested:hash,free:'old'});
 const normalized=prepareNextgenRound(raw,mapping);
 assert.equal(normalized.bonus,2);assert.equal(normalized.typeMappingHash,hash);
 assert.deepEqual(normalized.money,{startBalanceRaw:10000,endBalanceRaw:10000,totalWinRaw:100,betRaw:100});
 assert.throws(()=>roundMapping(raw,'base','old'));
 assert.throws(()=>prepareNextgenRound(raw,{...mapping,bonus:1}));
});
