import test from 'node:test';import assert from 'node:assert/strict';
import {preparedCountAuthorization} from './prepared-count-authorization.mjs';
test('prepared profile paths are committed exact authorizations, not names or hashes supplied by a mailbox',()=>{
 const activation='a'.repeat(64),name=`formal-prepared-count-32714-${activation}.json`;
 const entry={schema:'sg-prepared-count-authorization-v1',gameId:32714,activation};
 const read=()=>({schema:'sg-prepared-count-authorizations-v1',sourceAllowance:0,profiles:{[name]:entry}});
 assert.deepEqual(preparedCountAuthorization(name,read),entry);
 for(const bad of ['../'+name,'formal-prepared-count-32719-'+activation+'.json',name.replace(activation,'b'.repeat(64))])
  assert.throws(()=>preparedCountAuthorization(bad,read));
 assert.throws(()=>preparedCountAuthorization(name,()=>({schema:'sg-prepared-count-authorizations-v1',sourceAllowance:0,profiles:{}})));
});
