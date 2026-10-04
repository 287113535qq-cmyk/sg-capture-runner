import assert from 'node:assert/strict';
import {analyzer} from '../analyzer.mjs';
import {stable} from '../mongo-writer.mjs';
import {SOURCE,review,settled,fiveBootstrap} from './sg-five-treasures.mjs';
import {fivePayload} from './sg-five-source.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
export async function fiveCodec({plan,session,sequence,worker,batchId,createAnalyzer=analyzer}){
 assert(plan.adapter==='five-treasures-wms-v1'&&plan.sourceKey===SOURCE&&plan.buy===0&&typeof sequence==='function','WMS_CODEC_SCOPE');
 const parser=createAnalyzer();let first=false;
 try{assert((await parser.call({op:'plan',plan}))?.validated===true,'SG_CODEC_PLAN');}
 catch(error){parser.close();throw error;}
 return {
  payload:next=>fivePayload(next,session.session,first),
  guardMsg:(msg,payload)=>msg==='Logic'&&parseXml(payload).children.some(n=>n.tag==='Stake')?'BET':msg,
  async bootstrap(exchange){
   first=false;const previous=session.session;
   const step=await exchange('Init',fivePayload({MSGID:'Init'},previous));
   const js=fiveBootstrap(step,previous),py=await parser.call({op:'five_bootstrap',plan,step,session:previous});
   assert(stable(js)===stable(py),'SG_JS_PY_BOOTSTRAP_MISMATCH');session.setSession(js.session);return js.balanceRaw;
  },
  createRaw({balance}){return {fixtureOnly:false,protocol:'wms',sourceKey:SOURCE,
   roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:balance,steps:[]};},
  async next(raw,chooseOption){
   const state=review(raw),js=state.next===null?null:{MSGID:state.next};
   const py=await parser.call({op:'next',plan,raw});assert(stable(js)===stable(py),'SG_JS_PY_ROUTE_MISMATCH');
   if(state.session!==null)session.setSession(state.session);first=raw.steps.length===0;
   if(js?.MSGID==='FreeSpinChoice'){
    const options=Array.from({length:5},(_,choice)=>({pickIndex:choice+1,choice}));
    const selected=typeof chooseOption==='function'?await chooseOption(options):options[0];
    assert(options.some(o=>o.pickIndex===selected?.pickIndex&&o.choice===selected?.choice),'WMS_CHOICE_NOT_ADAPTED');
    js.choice=selected.choice;
   }
   if(js)assert((await parser.call({op:'intent',plan,raw,payload:fivePayload(js,session.session,first)}))?.validated===true,'SG_REQUEST_MODE');
   return js;
  },
  async prepare(raw,{attempt,sessionHash}){
   const py=await parser.call({op:'fields',plan,raw}),js=settled(raw,py.typeMappingHash);
   assert(stable(js)===stable(py),'SG_JS_PY_FIELDS_MISMATCH');
   const record=await parser.call({op:'record',plan,raw,normalized:js,sequence:sequence(),attempt,sessionHash,worker,batchId});
   assert((await parser.call({op:'verify',plan,raw,record}))?.verified===true,'SG_FULL_RECORD_VALIDATION');
   const picked=raw.steps.find(s=>s.msgId==='FreeSpinChoice');
   return {record,independentlyVerified:true,endBalanceRaw:py.money.endBalanceRaw,
    optionIndex:picked?Number(one(parseXml(picked.requestPayload),'FreeSpinChoice').a.type)+1:0};
  },close:()=>parser.close(),
 };
}
