import fs from 'node:fs';import assert from 'node:assert/strict';
export function preparedCountAuthorization(name,read=file=>JSON.parse(fs.readFileSync(file,'utf8'))){
 const match=/^formal-prepared-count-([0-9]{5})-([a-f0-9]{64})\.json$/.exec(name??'');
 assert(match,'PREPARED_COUNT_PROFILE_PATH');
 const registry=read('config/prepared-count-authorizations.json'),entry=registry.profiles?.[name];
 assert(registry.schema==='sg-prepared-count-authorizations-v1'&&registry.sourceAllowance===0
  &&entry?.gameId===Number(match[1])&&entry.activation===match[2]
  &&entry.schema==='sg-prepared-count-authorization-v1','PREPARED_COUNT_PROFILE_UNAUTHORIZED');
 return entry;
}
