import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {captureXmlParser} from '../../trial/collector-loader.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
const xml=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// Identity/cookies are scoped to one AG task and one of its eight sessions.
// This factory performs no source I/O. send() is invoked behind the durable
// intent boundary and never retries an HTTP request.
export function nextgenSession({base,plan,queueId,kind,index,owner,ordinal,guard,fetchSource=fetch,now=Date.now}){
 if(fetchSource===fetch)assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'
  &&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&(process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner'||process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner'&&process.env.SG_AG_COHORT==='secondary'),
  'SG_GITHUB_SOURCE_REQUIRED');
 assert(base?.mode==='demo'&&base.serverAddress==='ogs-gdm-usnj.nyxop.net/nextgen'
  &&/^Free:/i.test(base.sessionId??'')&&typeof base.operatorId==='string'&&base.operatorId.length>0
  &&base.currency==='USD'&&plan.adapter==='native-nextgen-v1'&&plan.buy===0
  &&Number.isSafeInteger(ordinal)&&ordinal>0&&typeof guard==='function','SG_NEXTGEN_SOURCE_SCOPE');
 const sessionId=base.sessionId.slice(0,5)+createHmac('sha256',base.sessionId+'@'+base.operatorId)
  .update(JSON.stringify(['sg-ag-rolling-v1',queueId,plan.gameId,kind,index,owner,ordinal])).digest('hex').slice(0,32);
 const identity=createHash('sha256').update(sessionId+'@'+base.operatorId).digest('hex');
 const pid='gdmgcm'+sessionId,cookies=new Map();let closed=false;
 return {identity,pid,
  async send(requestPayload,msgId){
   assert(!closed&&typeof requestPayload==='string'&&params(requestPayload).PID===pid
    &&params(requestPayload).MSGID===msgId,'SG_NEXTGEN_REQUEST_SCOPE');await guard({stage:'request',msgId});
   const body='<gdmRequest><clienttype>flash</clienttype><lang>en_us</lang>'+
    `<currency>${xml(base.currency)}</currency><mode>demo</mode><token>${xml(sessionId+'@'+base.operatorId)}</token>`+
    `<methodName>processGameMessage</methodName><payload>${xml(requestPayload)}</payload></gdmRequest>`;
   const start=performance.now();let response,text;
   try{response=await fetchSource('https://ogs-gdm-usnj.nyxop.net/nextgen/',{method:'POST',redirect:'manual',
    signal:AbortSignal.timeout(30000),headers:{'Content-Type':'text/xml; charset=utf-8',
     ...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},body});
    text=await response.text();
   }catch{throw Object.assign(new Error('SOURCE_NETWORK_OUTCOME_UNKNOWN'),{code:'SOURCE_NETWORK_OUTCOME_UNKNOWN'});}
   for(const cookie of response.headers.getSetCookie?.()??[]){const first=cookie.split(';')[0],at=first.indexOf('=');
    if(at>0)cookies.set(first.slice(0,at),first.slice(at+1));}
   const step={ts:new Date(now()).toISOString(),methodName:'processGameMessage',msgId,requestPayload,
    responsePayload:'',responseXml:text,elapsedMs:Math.round(performance.now()-start),httpStatus:response.status};
   if(!response.ok)return {...step,sourceRejected:true,sourceError:'SOURCE_HTTP_REJECTED'};
   if(text.length>=262144||/<!DOCTYPE|<!ENTITY/i.test(text))return {...step,sourceRejected:true,sourceError:'SOURCE_XML_REJECTED'};
   try{const parsed=captureXmlParser().parse(text),root=parsed.GDMRESPONSE??parsed.gdmresponse??{};
    step.responsePayload=String(root.PAYLOAD??'');
    if(String(root.SUCCESS).toLowerCase()!=='true'||params(step.responsePayload).MSGID!==msgId)
     return {...step,sourceRejected:true,sourceError:'SOURCE_RESPONSE_REJECTED'};
    const p=params(step.responsePayload);if(p.AB!==undefined||p.B!==undefined)step.responseBalance=integer(p.AB??p.B);
   }catch{return {...step,sourceRejected:true,sourceError:'SOURCE_XML_REJECTED'};}
   return step;
  },close(){closed=true;cookies.clear();},
 };
}
