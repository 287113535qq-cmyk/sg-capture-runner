import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {analyzer} from '../analyzer.mjs';
import {BALANCE_CONTRACT} from './sg-held-balance.mjs';
import {verifyOrdinaryNativePage} from './sg-ag-ordinary-business.mjs';
import {createNativePageVerificationCache} from './sg-native-page-verification-cache.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32500'];
const pid='gdmgcmoffline-efficiency',hash='a'.repeat(64);
function step(msg,win,remaining){const payload=`MSGID=${msg}&IFG=${Number(msg==='FREE_GAME')}&NFG=${remaining}&FID=0|&B=${900+win}&AB=900&TW=${win}`;
 return {methodName:'processGameMessage',msgId:msg,requestPayload:Object.entries({...plan.requestParams,PID:pid,MSGID:msg}).map(([k,v])=>k+'='+v).join('&'),responsePayload:payload,
 responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',responseBalance:900,elapsedMs:0};}
const raw={fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',balanceContract:BALANCE_CONTRACT,startBalanceRaw:1000,
 steps:[step('BET',0,2),step('FREE_GAME',20,1),step('FREE_GAME',50,0)]};
const parser=analyzer({python:process.env.PYTHON||'python'}),pages=[];
try{
 const normalized=await parser.call({op:'fields',plan,raw});
 for(let page=0;page<10;page++){
  const records=[];
  for(let i=1;i<=100;i++)records.push(await parser.call({op:'record',plan,raw,normalized,sequence:page*100+i,attempt:'synthetic-efficiency',sessionHash:hash,worker:0,batchId:1}));
  pages.push(records);
 }
 const verify=(plan,records)=>verifyOrdinaryNativePage({plan,records,parser});
 await verify(plan,pages[0]);
 let start=performance.now();
 for(let pass=0;pass<3;pass++)for(const page of pages)await verify(plan,page);
 const baselineMs=performance.now()-start,cache=createNativePageVerificationCache({verify});
 start=performance.now();for(let pass=0;pass<3;pass++)for(const page of pages)await cache.verify(plan,page);
 const cachedMs=performance.now()-start;
 const altered=structuredClone(pages[0]);altered.at(-1).raw.steps[0].responseXml+='<changed/>';
 let corruptRejected=false;try{await cache.verify(plan,altered);}catch{corruptRejected=true;}
 const result={schema:'sg-native-page-cache-local-benchmark-v1',fixture:'synthetic-held-award-three-frames',uniqueRecords:1000,passes:3,baselinePageChecks:30,cachedPageChecks:10,cacheHits:20,
 baselineMs,cachedMs,speedup:baselineMs/cachedMs,corruptRejected,sourceRequests:0,mongoWrites:0};
 if(!corruptRejected)throw Error('CORRUPT_CACHE_PAGE_ACCEPTED');
 console.log(JSON.stringify(result,null,2));
}finally{parser.close();}

