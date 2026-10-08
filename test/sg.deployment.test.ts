import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import yaml from 'js-yaml';
test('SG deployment keeps AG twenty lanes and original worker while preserving private evidence',()=>{
 const x:any=yaml.load(fs.readFileSync('.github/workflows/capture-sg-whole-ag-rolling.yml','utf8'));
 assert.equal(x.jobs.rolling.if,"github.repository == '287113535qq-cmyk/sg-capture-runner'");
 assert.deepEqual(Object.keys(x.on),['workflow_dispatch']);assert.equal(x.jobs.rolling.strategy['max-parallel'],20);assert.equal(x.jobs.rolling.strategy['fail-fast'],false);
 const step=x.jobs.rolling.steps.find((s:any)=>s.run==='node -r ts-node/register scripts/rolling-worker.ts');assert(step);assert.equal(step.env.AG_CAPTURE_PLATFORM,'sg');assert.equal(step.env.SG_SOURCE_EVIDENCE_KEY,undefined);
 const upload=x.jobs.rolling.steps.find((s:any)=>s.uses?.startsWith('actions/upload-artifact'));assert(upload.with.path.endsWith('.enc'));assert.equal(upload.if,'always()');
});
test('evidence encryption round-trips exact bytes with authentication and never overwrites an archive',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ag-seal-')),input=path.join(dir,'source'),output=path.join(dir,'sealed');const raw=crypto.randomBytes(250000),key=crypto.randomBytes(32);fs.writeFileSync(input,raw);
 try {const run=()=>spawnSync(process.execPath,['scripts/seal-source-evidence.mjs',input,output],{env:{...process.env,SG_SOURCE_EVIDENCE_KEY:key.toString('hex')},encoding:'utf8'});const q=run();assert.equal(q.status,0,q.stderr);const data=fs.readFileSync(output);assert.equal(data.subarray(0,5).toString(),'SGAG1');const decipher=crypto.createDecipheriv('aes-256-gcm',key,data.subarray(5,17));decipher.setAuthTag(data.subarray(-16));assert.deepEqual(Buffer.concat([decipher.update(data.subarray(17,-16)),decipher.final()]),raw);assert.notEqual(run().status,0);assert.deepEqual(fs.readFileSync(output),data);}
 finally{fs.rmSync(dir,{recursive:true});}
});
