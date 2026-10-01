import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('real isolated Rhino collector loads only its family and preserves complete normalized fields',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',`
 import assert from 'node:assert/strict';import {createRequire} from 'node:module';
 import path from 'node:path';import {captureCollector,captureXmlParser} from './scripts/trial/collector-loader.mjs';
 import {rhinoFixture} from './scripts/trial/rhino-fixture.mjs';
 const require=createRequire(import.meta.url);
 require('./collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json'),transpileOnly:true});
 assert.equal(Object.keys(require.cache).some(p=>p.endsWith('sg.ingest.ts')),false);
 const selected=captureCollector('rhino');assert.equal(selected,captureCollector('rhino'));
 const raw=rhinoFixture(0),mapping={buy:0,bonus:0,typeMappingHash:'a'.repeat(64)},fields=selected.rhinoFields(raw,mapping);
 assert.deepEqual(fields,require('./collector/sg.rhino.ts').rhinoFields(raw,mapping));
 for(const name of ['sg.ingest.ts','sg.pearl.ts','sg.pyramids.ts'])assert(!Object.keys(require.cache).some(p=>p.endsWith(name)));
 assert.throws(()=>captureCollector('../../outside'));
 assert.deepEqual(captureXmlParser().parse('<X a="2"/>'),{X:{a:'2'}});
 assert.equal(captureXmlParser(),captureXmlParser());
 console.log(JSON.stringify({verified:true}));`],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{verified:true});
});
