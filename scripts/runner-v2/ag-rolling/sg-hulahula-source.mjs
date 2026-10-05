import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {escapeXml,PEARL_ENDPOINT} from '../../trial/pearl-session.mjs';
import {SOURCE,HEADER,request,response as readResponse} from './sg-hulahula-base.mjs';
import {parseXml,one,children} from '../../trial/pearl-protocol.mjs';
export function hulahulaPayload(next,session,first=false){
 assert(['Init','Logic','EndGame'].includes(next.MSGID),'WMS_REQUEST_SCOPE');
 const header='<Header '+Object.entries({...HEADER,sessionID:session}).map(([k,v])=>`${k}="${escapeXml(v)}"`).join(' ')+'/>';
 const content=first?'<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><Stake total="100" isBigBet="0"/>':'';
 const text=`<GameRequest type="${next.MSGID}">${header}${content}</GameRequest>`;
 request(text,next.MSGID,first);return text;
}
// The original AG exchange boundary owns durable intents, response ACKs,
// isolation, resource guards and closure. Construction issues no source request.
export function hulahulaSession({base,plan,queueId,kind,index,owner,ordinal,guard,fetchSource=fetch,now=Date.now}){
 if(fetchSource===fetch)assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'
  &&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&(process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner'
   ||process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner'&&process.env.SG_AG_COHORT==='secondary'),'SG_GITHUB_SOURCE_REQUIRED');
 assert(plan.adapter==='hulahula-base-wms-v1'&&plan.sourceKey===SOURCE&&plan.gameId===32775
  &&plan.runtimeGameId===32997&&plan.wmsGameId===20188&&plan.runtimeSlug==='hulahulanights'&&plan.betRaw===100&&plan.buy===0&&plan.maxSteps===2
  &&base?.mode==='demo'&&/^Free:/i.test(base.sessionId??'')&&typeof base.operatorId==='string'&&base.operatorId.length>0
  &&Number.isSafeInteger(ordinal)&&ordinal>0&&typeof guard==='function','WMS_SOURCE_SCOPE');
 const first=base.sessionId.slice(0,5)+createHmac('sha256',base.sessionId+'@'+base.operatorId)
  .update(JSON.stringify(['sg-ag-wms-hulahula-base-v1',queueId,plan.gameId,kind,index,owner,ordinal])).digest('hex').slice(0,32);
 let session=first,closed=false;const cookies=new Map();
 return {identity:createHash('sha256').update(first+'@'+base.operatorId).digest('hex'),get session(){return session;},
  setSession(value){assert(!closed&&typeof value==='string'&&value.length>0&&value.length<=1024,'WMS_SESSION_REQUIRED');session=value;},
  async send(payload,msg){
   assert(!closed,'SG_SOURCE_CLOSED');const q=parseXml(payload),h=one(q,'Header'),paid=children(q).some(n=>n.tag==='Stake');
   assert(h.a.sessionID===session&&q.tag==='GameRequest'&&q.a.type===msg,'WMS_SESSION_CHAIN_MISMATCH');request(payload,msg,paid);
   await guard({stage:'request',msgId:paid?'BET':msg});const start=performance.now();let http,text;
   try{http=await fetchSource(PEARL_ENDPOINT,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),
    headers:{'Content-Type':'text/xml; charset=utf-8',...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},body:payload});
    text=await http.text();}catch{throw Object.assign(new Error('SOURCE_NETWORK_OUTCOME_UNKNOWN'),{code:'SOURCE_NETWORK_OUTCOME_UNKNOWN'});}
   for(const cookie of http.headers.getSetCookie?.()??[]){const part=cookie.split(';')[0],at=part.indexOf('=');if(at>0)cookies.set(part.slice(0,at),part.slice(at+1));}
   const step={ts:new Date(now()).toISOString(),methodName:'GLS:'+msg,msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,
    elapsedMs:Math.round(performance.now()-start),httpStatus:http.status};
   if(!http.ok)return {...step,sourceRejected:true,sourceError:'SOURCE_HTTP_REJECTED'};
   try{step.responseBalance=readResponse(text,msg).balance;}catch{return {...step,sourceRejected:true,sourceError:'SOURCE_XML_REJECTED'};}
   return step;
  },close(){closed=true;cookies.clear();},
 };
}
