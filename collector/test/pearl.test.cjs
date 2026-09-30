const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {pearlFields}=require('../sg.pearl');
const root=path.resolve(__dirname,'../..');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
test('independent collector and Python Runner agree on Pearl records and reject money tampering',async()=>{
 const {pearlFixture}=await import('../../scripts/trial/pearl-fixture.mjs');
 const {pearlMapping}=await import('../../scripts/trial/pearl-protocol.mjs');
 const plan=JSON.parse(fs.readFileSync(path.join(root,'config/round-one-plans.json'),'utf8'))['32795'];
 const profile=JSON.parse(fs.readFileSync(path.join(root,'service/round_types.json'),'utf8')).profiles[plan.sourceKey];
 for(const free of [false,true]){
  const raw=pearlFixture(free),fields=pearlFields(raw,pearlMapping(raw,hash(profile)));
  const request={op:'record',plan,raw,normalized:fields,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',sessionHash:'a'.repeat(64),worker:0,batchId:1};
  const result=spawnSync(process.env.PYTHON||'python3',['-B','scripts/runner-v2/record_fields.py'],{cwd:root,input:JSON.stringify(request)+'\n',encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const response=JSON.parse(result.stdout);assert.equal(response.ok,true,response.error);
  assert.deepEqual(response.result.normalized,fields);assert.equal(fields.bonus,Number(free));
  const bad=structuredClone(raw);bad.steps.at(-1).responseBalance++;
  assert.throws(()=>pearlFields(bad,pearlMapping(raw,hash(profile))),/SG_PEARL_BALANCE/);
 }
});
