import test from 'node:test';import assert from 'node:assert/strict';
import {veryFruityStaticIdentity,VERYFRUITY_CONFIG_URL} from './veryfruity-static-config.mjs';
test('only fixed static identity leaves review; unrelated fields are not emitted or used as permission',()=>{
 const text=JSON.stringify({glsGameID:'12345',glsVersionID:'1_0',glsGameName:'veryfruity',secretFixture:'private'});
 const v=veryFruityStaticIdentity(text);assert.equal(v.glsGameID,'12345');assert.equal(v.captureAuthorization,false);
 assert(!JSON.stringify(v).includes('private'));assert.equal(v.sourceRequests,0);
 assert.equal(veryFruityStaticIdentity(JSON.stringify({glsGameID:12345,glsVersionID:'1_0'})).glsGameID,'12345');
 assert.equal(new URL(VERYFRUITY_CONFIG_URL).pathname,'/resource-service/content/veryfruity/app/config/engine-gls.json');
});
test('missing or mismatched identity never falls back to Pearl or an OGS runtime id',()=>{
 for(const c of [{},{glsGameID:'',glsVersionID:'1_0'},{glsGameID:'20327tail',glsVersionID:'1_0'},
  {glsGameID:'12345',glsVersionID:'',glsGameName:'veryfruity'},
  {glsGameID:'12345',glsVersionID:'1_0',glsGameName:'another'}])assert.throws(()=>veryFruityStaticIdentity(JSON.stringify(c)));
 assert.throws(()=>veryFruityStaticIdentity('x'.repeat(65537)));
});
