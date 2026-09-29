import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
test('independent campaign rebind binds complete runtime and finite remaining quota',()=>{
 const p=JSON.parse(fs.readFileSync('config/demon-nested-rebind-20260929.json','utf8'));
 assert.equal(hash(p),'620b0e95839a85dba3ee6a9827d2275089040c89b9980259f637dcbd7749ba52','applied profile is permanently frozen');
 assert.equal(p.schema,'sg-demon-nested-rebind-v1');assert.equal(p.complete,267);assert.equal(p.checkpoint,267);assert.equal(p.pending,2);
 assert.deepEqual(p.shortCapture,{originalComplete:246,currentComplete:267,remaining:179,resumeWorkers:[0,14],perWorkerTotal:10,finalComplete:446});
 const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(path=>[path,createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
 assert.deepEqual(actual,p.adapterFiles);assert.equal(hash(actual),p.adapterHash);
 for(const file of ['service/demon_nested_fields.py','scripts/trial/demon-nested-protocol.mjs','collector/sg.demon.ts','scripts/runner-v2/pending-first.mjs','.github/workflows/trial-300k.yml'])assert(p.adapterFiles[file]);
});
