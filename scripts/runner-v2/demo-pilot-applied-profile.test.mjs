import fs from 'node:fs';import assert from 'node:assert/strict';import test from 'node:test';import {createHash} from 'node:crypto';import {protocolHash as hash} from './protocol-resume.mjs';
test('applied pilot and finished-run retirement profiles stay frozen across later reports',()=>{
 for(const [name,expected] of [['demo-pilot-replacement-20260930.json','f904fa2ba1fdee54e6610d9d7b14a543712ab3aeb7696635f73064e081aa052e'],['demo-retire-pilot-20260930.json','11fc9abec2be621de82765a5f0ba91005d6664714c57c6c72e49701eceb3f069']]){
  const p=JSON.parse(fs.readFileSync('config/'+name,'utf8'));assert.equal(hash(p),expected);
  assert(Object.entries(p.files).some(([path,h])=>createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')!==h));
 }
});
