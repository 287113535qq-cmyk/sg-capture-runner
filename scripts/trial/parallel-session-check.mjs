import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {gameForShard} from './demo-sessions.mjs';
const require=createRequire(import.meta.url);
const {XMLParser}=require('../../collector/node_modules/fast-xml-parser');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});
const report={schema:'sg-parallel-session-check-v1',gameId:32471,sourceRequests:0,paidRoundRequests:0,results:[]};
const xml=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
try {
  assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_OS,'Linux');
  assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
  const base=JSON.parse(process.env.SG_TRIAL_DEMO_CONFIG || '{}');
  const games=Array.from({length:20},(_,i)=>gameForShard(base,i));
  report.distinctAnonymousIdentifiers=new Set(games.map(g=>g.sessionId)).size;
  for(let shard=0;shard<games.length;shard++){
    const game=games[shard],cookies=new Map(),r={shard,init:false,reelstrip:false};
    report.results.push(r);
    for(const msg of ['INIT','REELSTRIP']){
      const payload=`GN=${game.runtimeSlug}&PID=gdmgcm${game.sessionId}&MSGID=${msg}`;
      const body='<gdmRequest><clienttype>flash</clienttype><lang>en_us</lang>'+
        `<currency>${xml(game.currency)}</currency><mode>demo</mode><token>${xml(game.sessionId+'@'+game.operatorId)}</token>`+
        `<methodName>processGameMessage</methodName><payload>${xml(payload)}</payload></gdmRequest>`;
      report.sourceRequests++;
      const response=await fetch(`https://${game.serverAddress}/`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),
        headers:{'Content-Type':'text/xml; charset=utf-8',...(cookies.size?{Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')}:{})},body});
      r.httpStatus=response.status;
      if(!response.ok){report.error=response.status===429?'SOURCE_RATE_LIMITED':'SOURCE_HTTP_REJECTED';throw Error();}
      for(const c of response.headers.getSetCookie()){const s=c.split(';')[0],i=s.indexOf('=');if(i>0)cookies.set(s.slice(0,i),s.slice(i+1));}
      const text=await response.text();assert(text.length<2000000 && !/<!DOCTYPE|<!ENTITY/i.test(text));
      const parsed=parser.parse(text),root=parsed.GDMRESPONSE || parsed.gdmresponse || {};
      const p=Object.fromEntries(String(root.PAYLOAD || '').split('&').map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));
      if(String(root.SUCCESS).toLowerCase()!=='true' || p.MSGID!==msg){report.error='ANONYMOUS_SESSION_REJECTED';throw Error();}
      r[msg.toLowerCase()]=true;
      if(msg==='INIT'){assert(/^\d+$/.test(p.AB ?? p.B));r.initialBalanceRaw=Number(p.AB ?? p.B);}
    }
  }
  report.status='twenty-demo-handshakes-accepted';
  report.balanceIndependenceBetTestStillRequired=true;
}catch{
  report.status='parallel-session-preflight-stopped';report.error ||= 'PARALLEL_SESSION_CHECK_FAILED';process.exitCode=2;
}finally{
  console.log(JSON.stringify(report));
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\n\`\`\`json\n${JSON.stringify(report,null,2)}\n\`\`\`\n`);
}
