import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {publishCanonicalLocalCheck} from './local-check-publication.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
const receipt=support=>({schema:'sg-preparation-gate-v1',gate:'local',gameId:32714,
 revisionHash:'c'.repeat(64),verified:true,sourceAllowance:0,supportingHashes:[support.repeat(64)]});
const temp=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sg-local-check-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};

test('two actual processes publish one local gate even when their successful check logs differ',{timeout:10000},async t=>{
 const dir=temp(t),ready=path.join(dir,'release'),url=new URL('./local-check-publication.mjs',import.meta.url).href;
 const code=`import fs from 'node:fs';import {publishCanonicalLocalCheck} from ${JSON.stringify(url)};
 const [dir,ready,value]=process.argv.slice(1);process.stdout.write('ready\\n');
 const run=()=>{if(!fs.existsSync(ready)){setTimeout(run,5);return;}
 const receipt=publishCanonicalLocalCheck({dir,receipt:JSON.parse(value),expectedChecks:1});
 process.stdout.write(JSON.stringify(receipt)+'\\n');};run();`;
 const children=['a','b'].map(value=>{
  const child=spawn(process.execPath,['--input-type=module','-e',code,dir,ready,JSON.stringify(receipt(value))],{windowsHide:true});
  let stdout='',stderr='';let notify;const started=new Promise(resolve=>notify=resolve);
  child.stdout.on('data',data=>{stdout+=data;if(stdout.includes('ready\n'))notify();});
  child.stderr.on('data',data=>stderr+=data);
  const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',exit=>{
   if(exit!==0)reject(Error(stderr));else resolve(JSON.parse(stdout.trim().split('\n').at(-1)));
  });});
  t.after(()=>child.kill());return {started,done};
 });
 await Promise.all(children.map(c=>c.started));fs.writeFileSync(ready,'go');
 const results=await Promise.all(children.map(c=>c.done));assert.deepEqual(results[0],results[1]);
 const gates=fs.readdirSync(dir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n));
 assert.deepEqual(gates,[hash(results[0])+'.json']);
 assert.deepEqual(publishCanonicalLocalCheck({dir,receipt:receipt('d'),expectedChecks:1}),results[0]);
});

test('a corrupt or foreign canonical gate cannot turn a successful check into readiness',t=>{
 for(const field of ['verified','sourceAllowance','revisionHash','gameId']){
  const dir=temp(t),value=receipt('a');
  const changed={...value,[field]:field==='verified'?false:field==='revisionHash'?'d'.repeat(64):1};
  fs.writeFileSync(path.join(dir,`local-${value.gameId}-${value.revisionHash}.json`),JSON.stringify(changed));
  assert.throws(()=>publishCanonicalLocalCheck({dir,receipt:value,expectedChecks:1}),/CANONICAL_CHANGED/);
  assert.equal(fs.readdirSync(dir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).length,0);
 }
});
