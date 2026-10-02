import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
// Exact path from the fixed client Adapter.setupPaths and Engine.configure.
// Static configuration GET only: no GLS Init/Logic/EndGame or credentials.
export const VERYFRUITY_CONFIG_URL='https://resource.atc.casinarena.com/resource-service/content/veryfruity/app/config/engine-gls.json';
export function veryFruityStaticIdentity(text){
 assert(typeof text==='string'&&Buffer.byteLength(text)<=65536,'VERYFRUITY_STATIC_CONFIG_SIZE');
 const config=JSON.parse(text);
 assert(config&&typeof config==='object'&&!Array.isArray(config),'VERYFRUITY_STATIC_CONFIG_SHAPE');
 const gameID=typeof config.glsGameID==='number'&&Number.isSafeInteger(config.glsGameID)?String(config.glsGameID):config.glsGameID;
 assert(typeof gameID==='string'&&/^[1-9][0-9]{0,9}$/.test(gameID)
  &&typeof config.glsVersionID==='string'&&/^[a-zA-Z0-9_.-]{1,64}$/.test(config.glsVersionID),'VERYFRUITY_STATIC_IDENTITY_REQUIRED');
 if(config.glsGameName)assert.equal(config.glsGameName,'veryfruity','VERYFRUITY_STATIC_GAME');
 return {gameId:32812,glsGameID:gameID,glsVersionID:config.glsVersionID,
  staticConfigSha256:createHash('sha256').update(text).digest('hex'),staticRequests:1,
  sourceRequests:0,paidRoundRequests:0,databaseRequests:0,captureAuthorization:false};
}
async function main(){
 assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'
  &&['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner'].includes(process.env.GITHUB_REPOSITORY),'GITHUB_STATIC_REVIEW_ONLY');
 const response=await fetch(VERYFRUITY_CONFIG_URL,{redirect:'error',signal:AbortSignal.timeout(30000)});
 assert(response.ok,'VERYFRUITY_STATIC_CONFIG_HTTP');
 const length=Number(response.headers.get('content-length')??0);assert(length<=65536,'VERYFRUITY_STATIC_CONFIG_SIZE');
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;assert(size<=65536,'VERYFRUITY_STATIC_CONFIG_SIZE');chunks.push(chunk);}
 console.log(JSON.stringify(veryFruityStaticIdentity(Buffer.concat(chunks).toString('utf8'))));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(error=>{console.log(JSON.stringify({error:/^[A-Z_]+$/.test(error.message)?error.message:'VERYFRUITY_STATIC_REVIEW_FAILED',staticRequests:1,sourceRequests:0,paidRoundRequests:0,databaseRequests:0}));process.exitCode=2;});
}
