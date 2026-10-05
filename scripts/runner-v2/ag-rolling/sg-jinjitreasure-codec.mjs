import assert from 'node:assert/strict';
import {analyzer} from '../analyzer.mjs';
import {stable} from '../mongo-writer.mjs';
import {SOURCE,review,settled,bootstrap} from './sg-jinjitreasure-base.mjs';
import {jinjitreasurePayload} from './sg-jinjitreasure-source.mjs';
import {parseXml,children} from '../../trial/pearl-protocol.mjs';
export async function jinjitreasureCodec({plan,session,sequence,worker,batchId,createAnalyzer=analyzer}){
 assert(plan.adapter==='jinjitreasure-base-wms-v1'&&plan.sourceKey===SOURCE&&plan.buy===0&&typeof sequence==='function','WMS_CODEC_SCOPE');
 const parser=createAnalyzer();let first=false;
 try{assert((await parser.call({op:'plan',plan}))?.validated===true,'SG_CODEC_PLAN');}catch(e){parser.close();throw e;}
 return {payload:next=>jinjitreasurePayload(next,session.session,first),
  guardMsg:(msg,payload)=>msg==='Logic'&&children(parseXml(payload)).some(n=>n.tag==='Stake')?'BET':msg,
  async bootstrap(exchange){first=false;const previous=session.session,step=await exchange('Init',jinjitreasurePayload({MSGID:'Init'},previous));
   const js=bootstrap(step,previous),py=await parser.call({op:'jinjitreasure_bootstrap',plan,step,session:previous});
   assert(stable(js)===stable(py),'SG_JS_PY_BOOTSTRAP_MISMATCH');session.setSession(js.session);return js.balanceRaw;},
  createRaw({balance}){return {fixtureOnly:false,protocol:'wms',sourceKey:SOURCE,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:balance,steps:[]};},
  async next(raw){const state=review(raw),js=state.next===null?null:{MSGID:state.next},py=await parser.call({op:'next',plan,raw});
   assert(stable(js)===stable(py),'SG_JS_PY_ROUTE_MISMATCH');if(state.session!==null)session.setSession(state.session);first=raw.steps.length===0;
   if(js)assert((await parser.call({op:'intent',plan,raw,payload:jinjitreasurePayload(js,session.session,first)}))?.validated===true,'SG_REQUEST_MODE');return js;},
  async prepare(raw,{attempt,sessionHash}){const py=await parser.call({op:'fields',plan,raw}),js=settled(raw,py.typeMappingHash);
   assert(stable(js)===stable(py),'SG_JS_PY_FIELDS_MISMATCH');
   const record=await parser.call({op:'record',plan,raw,normalized:js,sequence:sequence(),attempt,sessionHash,worker,batchId});
   assert((await parser.call({op:'verify',plan,raw,record}))?.verified===true,'SG_FULL_RECORD_VALIDATION');
   return {record,independentlyVerified:true,endBalanceRaw:py.money.endBalanceRaw,optionIndex:0};},close:()=>parser.close(),
 };
}
