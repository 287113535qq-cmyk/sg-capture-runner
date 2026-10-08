import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzer} from '../analyzer.mjs';
const fixtures=JSON.parse(readFileSync('config/ag-rolling-own-wms-init-fixtures.json'));
const plans=JSON.parse(readFileSync('config/ag-rolling-plans.json')).plans;
const names={'32752':'acorn','32759':'crystalforest','32764':'dragonspin','32770':'giantsgold','32774':'himalayas'};
const clone=v=>structuredClone(v);
const edited=(v,change)=>{const s=clone(v);s.responsePayload=change(s.responsePayload);s.responseXml=s.responsePayload;return s;};
for(const [id,name]of Object.entries(names)){
 const {bootstrap}=await import(`./sg-${name}-base.mjs`);
 const codecFactory=(await import(`./sg-${name}-codec.mjs`))[`${name}Codec`];
 const fixture=fixtures[id],plan=plans[id],call=(p,s)=>p.call({op:`${name}_bootstrap`,plan,step:s,session:'own-init-fixture'});
 const parser=()=>analyzer({python:process.env.SG_TEST_PYTHON??'python3'});
 test(`${id}: real full Init validates independently through production JS and Python IPC`,async()=>{
  const p=parser();try{const js=bootstrap(fixture,'own-init-fixture');assert.deepEqual(await call(p,fixture),js);assert.equal(js.balanceRaw,100000);}finally{p.close();}
 });
 test(`${id}: production codec consumes the natural Init exactly once and keeps ordinary stake`,async()=>{
  const p=parser(),s={session:'own-init-fixture',setSession(v){this.session=v;}};
  const codec=await codecFactory({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>p});let calls=0;
  try{
   const balance=await codec.bootstrap(async(msg,payload)=>{calls++;assert.equal(msg,'Init');assert.equal(payload,fixture.requestPayload);return clone(fixture);});
   assert.equal(balance,100000);assert.equal(calls,1);
   const next=await codec.next(codec.createRaw({balance}));assert.equal(next.MSGID,'Logic');assert.equal(codec.guardMsg(next.MSGID,codec.payload(next)),'BET');
  }finally{codec.close();p.close();}
 });
 test(`${id}: only checked session and cash may vary; capability tables stay pinned`,async()=>{
  const s=edited(fixture,x=>x.replace('sessionID="own-init-fixture"','sessionID="rotated-session"').replace('value="100000"','value="99999"'));s.responseBalance=99999;
  const p=parser();try{const js=bootstrap(s,'own-init-fixture');assert.deepEqual(await call(p,s),js);assert.equal(js.balanceRaw,99999);assert.equal(js.session,'rotated-session');}finally{p.close();}
 });
 test(`${id}: full Init rejects recovery, result, table mutation, unknown fields and monetary tampering in both implementations`,async()=>{
  const changes=[
   x=>x.replace('isRecovering="N"','isRecovering="Y"'),
   x=>x.replace('type="Init"','type="Logic"'),
   x=>x.replace(/gameID="\d+"/,'gameID="99999"'),
   x=>x.replace('sessionID="own-init-fixture"','sessionID=""'),
   x=>x.replace('</GameResponse>','<GameResult/></GameResponse>'),
   x=>x.replace('</GameResponse>','<Unknown/></GameResponse>'),
   x=>x.replace('</GameResponse>','<PageInfo pageCount="2"/></GameResponse>'),
   x=>x.replace('<GameVariantInfo ','<GameVariantInfo unreviewed="1" '),
   x=>x.replace(/<GameVariantInfo[^>]*\/>/,''),
   x=>x.replace('<Award index="0">','<Award index="999">'),
   x=>x.replace(/<Stakes count="\d+"/,'<Stakes count="1"'),
   x=>x.replace('<Stakes ', '<Stakes unknown="1" '),
   x=>x.replace('type="0"','type="1"'),
   x=>x.replace('<Balances>','<Balances>unexpected'),
   x=>x.replace('value="100000"','value="100001"'),
   x=>x.replace('value="100000"','value="-1"'),
   x=>x.replace('value="100000"','value="9007199254740992"')
  ];
  const invalid=changes.map(fn=>{const s=edited(fixture,fn);assert.notEqual(s.responsePayload,fixture.responsePayload);return s;});
  invalid.push({...fixture,responseBalance:100001},{...fixture,sourceRejected:true},{...fixture,elapsedMs:300001},{...fixture,responseXml:'<Changed/>'},{...fixture,msgId:'Logic'});
  const p=parser();try{for(const s of invalid){assert.throws(()=>bootstrap(s,'own-init-fixture'));await assert.rejects(()=>call(p,s));}}finally{p.close();}
 });
 test(`${id}: another game's valid Init cannot be borrowed`,async()=>{
  const other=Object.keys(names).find(k=>k!==id),s=clone(fixtures[other]);s.requestPayload=fixture.requestPayload;
  const p=parser();try{assert.throws(()=>bootstrap(s,'own-init-fixture'));await assert.rejects(()=>call(p,s));}finally{p.close();}
 });
}
