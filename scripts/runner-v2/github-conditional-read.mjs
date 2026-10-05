import assert from 'node:assert/strict';
import {withGithubHttpDiagnostic} from './github-read-diagnostic.mjs';
const tag=value=>typeof value==='string'&&/^(?:W\/)?"[a-fA-F0-9]{16,128}"$/.test(value);
const opaque=value=>value.replace(/^W\//,'');
const eligible=path=>/^repos\/(zyzuoyang|287113535qq-cmyk)\/sg-capture-runner\/actions\/runs(?:\?status=(?:in_progress|queued|pending|waiting|requested)&per_page=100(?:&page=[12])?|\/[0-9]{1,20}(?:\/jobs\?filter=all&per_page=100)?)$/.test(path);
// One authenticated GET per validation. A matching server 304 is fresh
// evidence for that exact URL and ETag, never an offline fallback.
export function conditionalGithubRead(token,{fetchRead=fetch,maxEntries=64}={}){
 assert(typeof token==='string'&&token.length>0,'GITHUB_AUTH_REQUIRED');
 assert(Number.isInteger(maxEntries)&&maxEntries>0&&maxEntries<=64,'GITHUB_CACHE_BOUND');
 const cache=new Map();
 return async path=>{
  assert(path.startsWith('repos/')&&!path.includes('..'),'INVALID_GITHUB_PATH');
  const previous=eligible(path)?cache.get(path):undefined;
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'};
  if(previous)headers['If-None-Match']=previous.etag;
  let response;
  try{response=await fetchRead('https://api.github.com/'+path,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)});}
  catch(error){cache.delete(path);throw error;}
  const etag=response.headers?.get('etag');
  // If-None-Match uses RFC 9110 weak comparison: GitHub sends W/ on its
  // initial 200 and omits W/ on 304. The quoted opaque tag must still match.
  if(response.status===304&&previous&&tag(etag)&&opaque(etag)===opaque(previous.etag))return structuredClone(previous.value);
  try{assert(response.ok,'GITHUB_RUN_READ_FAILED');}
  catch(error){cache.delete(path);throw withGithubHttpDiagnostic(error,path,response);}
  cache.delete(path);const value=await response.json();
  const contradictoryFirstPage=/\?status=/.test(path)&&!path.endsWith('&page=2')
   &&Number.isInteger(value?.total_count)&&Array.isArray(value?.workflow_runs)&&value.total_count!==value.workflow_runs.length;
  if(eligible(path)&&!contradictoryFirstPage&&tag(etag)&&value!==null&&typeof value==='object'){
   const encoded=JSON.stringify(value);
   if(encoded.length<=4*1024*1024){cache.set(path,{etag,value:structuredClone(value)});while(cache.size>maxEntries)cache.delete(cache.keys().next().value);}
  }
  return value;
 };
}
