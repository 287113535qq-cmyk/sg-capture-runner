import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {escapeXml,PEARL_ENDPOINT} from '../../trial/pearl-session.mjs';
import {SOURCE,HEADER,request,fiveResponse} from './sg-five-treasures.mjs';
import {parseXml,one,children} from '../../trial/pearl-protocol.mjs';
export function fivePayload(next,session,first=false){
 assert(['Init','Logic','FreeSpinChoice','EndGame'].includes(next.MSGID),'WMS_REQUEST_SCOPE');
 const header='<Header '+Object.entries({...HEADER,sessionID:session}).map(([k,v])=>`${k}="${escapeXml(v)}"`).join(' ')+'/>';
 const content=first?'<Stake total="176"/><PaylineCount count="1"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':
  next.MSGID==='FreeSpinChoice'?`<FreeSpinChoice type="${next.choice}"/>`:'';
 const text=`<GameRequest type="${next.MSGID==='FreeSpinChoice'?'Logic':next.MSGID}">${header}${content}</GameRequest>`;
 if(next.MSGID!=='Init')request(text,next.MSGID,first);return text;
}
// Identity only at construction. The shared AG exchange boundary owns all
// intents, HTTP, fsync, ACK, limits and closure; there is no request retry.
export function fiveSession({base,plan,queueId,kind,index,owner,ordinal,guard,fetchSource=fetch,now=Date.now}){
 if(fetchSource===fetch)assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'
  &&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&(process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner'||process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner'&&process.env.SG_AG_COHORT==='secondary'),'SG_GITHUB_SOURCE_REQUIRED');
 assert(plan.adapter==='five-treasures-wms-v1'&&plan.sourceKey===SOURCE&&plan.gameId===32749
  &&plan.runtimeGameId===32971&&plan.betRaw===176&&plan.buy===0&&plan.maxSteps===8
  &&base?.mode==='demo'&&/^Free:/i.test(base.sessionId??'')&&typeof base.operatorId==='string'&&base.operatorId.length>0
  &&Number.isSafeInteger(ordinal)&&ordinal>0&&typeof guard==='function','WMS_SOURCE_SCOPE');
 const first=base.sessionId.slice(0,5)+createHmac('sha256',base.sessionId+'@'+base.operatorId)
  .update(JSON.stringify(['sg-ag-wms-five-v1',queueId,plan.gameId,kind,index,owner,ordinal])).digest('hex').slice(0,32);
 let session=first,closed=false;const cookies=new Map();
 return {identity:createHash('sha256').update(first+'@'+base.operatorId).digest('hex'),
  get session(){return session;},
  setSession(value){assert(!closed&&typeof value==='string'&&value.length>0&&value.length<=1024,'WMS_SESSION_REQUIRED');session=value;},
  async send(payload,msg){
   assert(!closed,'SG_SOURCE_CLOSED');const q=parseXml(payload),h=one(q,'Header');
   assert(h.a.sessionID===session&&q.tag==='GameRequest'&&q.a.type===(msg==='FreeSpinChoice'?'Logic':msg),'WMS_SESSION_CHAIN_MISMATCH');
   if(msg==='Init')assert(children(q).length===1&&payload===fivePayload({MSGID:'Init'},session),'WMS_REQUEST_MISMATCH');
   else request(payload,msg,children(q).some(n=>n.tag==='Stake'));
   await guard({stage:'request',msgId:msg==='Logic'&&children(q).some(n=>n.tag==='Stake')?'BET':msg});
   const start=performance.now();let response,text;
   try{response=await fetchSource(PEARL_ENDPOINT,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),
    headers:{'Content-Type':'text/xml; charset=utf-8',...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},body:payload});
    text=await response.text();}catch{throw Object.assign(new Error('SOURCE_NETWORK_OUTCOME_UNKNOWN'),{code:'SOURCE_NETWORK_OUTCOME_UNKNOWN'});}
   for(const cookie of response.headers.getSetCookie?.()??[]){const part=cookie.split(';')[0],at=part.indexOf('=');if(at>0)cookies.set(part.slice(0,at),part.slice(at+1));}
   const step={ts:new Date(now()).toISOString(),methodName:'GLS:'+(msg==='FreeSpinChoice'?'Logic':msg),msgId:msg,
    requestPayload:payload,responsePayload:text,responseXml:text,elapsedMs:Math.round(performance.now()-start),httpStatus:response.status};
   if(!response.ok)return {...step,sourceRejected:true,sourceError:'SOURCE_HTTP_REJECTED'};
   try{const state=fiveResponse(text,msg);step.responseBalance=state.balance;}
   catch{return {...step,sourceRejected:true,sourceError:'SOURCE_XML_REJECTED'};}
   return step;
  },close(){closed=true;cookies.clear();},
 };
}
