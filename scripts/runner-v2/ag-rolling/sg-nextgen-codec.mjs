import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {analyzer} from '../analyzer.mjs';
import {stable} from '../mongo-writer.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {nextRequest} from '../../trial/squid-protocol.mjs';
import {actionContract} from '../../trial/pyramids-action-contracts.mjs';
import {captureCollector} from '../../trial/collector-loader.mjs';
import {heldBalanceFields,BALANCE_CONTRACT} from './sg-held-balance.mjs';
import {automaticFreeNext,automaticFreeFields,AUTOMATIC_FREE_CONTRACT} from './sg-automatic-free.mjs';
import {reviewExplicitPrefix} from './sg-explicit-review.mjs';
import {EXPLICIT_PROBE,explicitProbeRoute,explicitProbePick,explicitProbeIntent} from './sg-explicit-probe.mjs';
import {ZERO_ABPM,zeroAbpmNext,zeroAbpmFields} from './sg-zero-abpm.mjs';
const require=createRequire(import.meta.url);let registered=false;
function loadCollector(){if(!registered){require('../../../collector/node_modules/ts-node').register({
 project:path.resolve('collector/tsconfig.json'),transpileOnly:true});registered=true;}}
// Original SG JS normalizer plus independent Python protocol/money/hash
// checks, behind the original AG session scheduler. One analyzer per session
// keeps eight concurrent sources independent without concurrent private IPC.
export async function nextgenCodec({plan,session,sequence,worker,batchId,createAnalyzer=analyzer}){
 assert(plan.adapter==='native-nextgen-v1'&&plan.buy===0&&typeof sequence==='function','SG_NEXTGEN_CODEC_SCOPE');
 const parser=createAnalyzer(),contract=actionContract(plan);loadCollector();
 try{assert((await parser.call({op:'plan',plan}))?.validated===true,'SG_CODEC_PLAN');}
 catch(error){parser.close();throw error;}
 const payload=next=>Object.entries(['INIT','REELSTRIP'].includes(next.MSGID)?
  {GN:plan.runtimeSlug,PID:session.pid,MSGID:next.MSGID}:next.MSGID.startsWith('FEATURE_')?
   {GN:plan.runtimeSlug,PID:session.pid,...next}:{...plan.requestParams,PID:session.pid,...next})
  .map(([k,v])=>`${k}=${v}`).join('&');
 return {
  payload,
  async bootstrap(exchange){
   const init=await exchange('INIT',payload({MSGID:'INIT'}));assert(!init.sourceRejected,'SG_INIT_REJECTED');
   const js=integer(params(init.responsePayload).AB??params(init.responsePayload).B);
   const py=await parser.call({op:'nextgen_bootstrap',plan,step:init,pid:session.pid});
   assert(py?.validated===true&&py.balanceRaw===js,'SG_INIT_BALANCE');
   const reels=await exchange('REELSTRIP',payload({MSGID:'REELSTRIP'}));assert(!reels.sourceRejected,'SG_REELSTRIP_REJECTED');
   assert((await parser.call({op:'nextgen_bootstrap',plan,step:reels,pid:session.pid}))?.validated===true,'SG_REELSTRIP_VALIDATION');
   return js;
  },
  createRaw({balance}){return {fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,
   roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:balance,steps:[],
   ...(plan.balanceContract===BALANCE_CONTRACT?{balanceContract:BALANCE_CONTRACT}:{}),
   ...(plan.automaticFreeContract===AUTOMATIC_FREE_CONTRACT?{automaticFreeContract:AUTOMATIC_FREE_CONTRACT}:{}),
   ...(plan.explicitProbeContract===EXPLICIT_PROBE?{explicitProbeContract:EXPLICIT_PROBE}:{}),
   ...(plan.zeroAbpmContract===ZERO_ABPM?{zeroAbpmContract:ZERO_ABPM}:{}),
   ...(contract?{requestFlowVersion:contract.version,actionContractHash:contract.hash}:{})};},
  async reviewExplicit(raw){
   const js=reviewExplicitPrefix(plan,raw),py=await parser.call({op:'review_explicit',plan,raw});
   assert(stable(js)===stable(py),'SG_JS_PY_EXPLICIT_REVIEW_MISMATCH');return js;
  },
  async next(raw,chooseOption){
   if(raw.explicitProbeContract!==undefined){
    const route=explicitProbeRoute(plan,raw),py=await parser.call({op:'explicit_probe_route',plan,raw});
    assert(stable(route)===stable(py),'SG_JS_PY_EXPLICIT_PROBE_MISMATCH');
    if(route){
     let request=route.request;
     if(route.options.length){
      const selected=typeof chooseOption==='function'?await chooseOption(route.options):route.options[0];
      assert(route.options.some(o=>o.pickIndex===selected?.pickIndex&&o.position===selected?.position),'EXPLICIT_PROBE_POSITION');
      request=explicitProbePick(plan,raw,selected.position);
     }
     explicitProbeIntent(plan,raw,payload(request));
     assert((await parser.call({op:'explicit_probe_intent',plan,raw,payload:payload(request)}))?.validated===true,'SG_REQUEST_MODE');
     return request;
    }
   }
   const js=raw.zeroAbpmContract!==undefined?zeroAbpmNext(plan,raw):raw.automaticFreeContract===AUTOMATIC_FREE_CONTRACT?automaticFreeNext(plan,raw):contract?contract.next(plan,raw):nextRequest(raw);
   const py=await parser.call({op:'next',plan,raw});assert(stable(js)===stable(py),'SG_JS_PY_ROUTE_MISMATCH');
   if(js)assert((await parser.call({op:'intent',plan,raw,payload:payload(js)}))?.validated===true,'SG_REQUEST_MODE');
   return js;},
  async prepare(raw,{attempt,sessionHash}){
   const py=await parser.call({op:'fields',plan,raw});
   const js=raw.zeroAbpmContract!==undefined?zeroAbpmFields(plan,raw,py.typeMappingHash):raw.automaticFreeContract===AUTOMATIC_FREE_CONTRACT?automaticFreeFields(plan,raw,py.typeMappingHash):raw.balanceContract===BALANCE_CONTRACT?heldBalanceFields(plan,raw,py.typeMappingHash):contract?captureCollector(contract.collectorKind).prepareNextgenActionRound(raw,plan):
    captureCollector('nextgen').prepareNextgenRound(raw,{buy:py.buy,bonus:py.bonus,typeMappingHash:py.typeMappingHash});
   assert(stable(js)===stable(py),'SG_JS_PY_FIELDS_MISMATCH');
   const record=await parser.call({op:'record',plan,raw,normalized:js,sequence:sequence(),attempt,
    sessionHash,worker,batchId});
   assert((await parser.call({op:'verify',plan,raw,record}))?.verified===true,'SG_FULL_RECORD_VALIDATION');
   return {record,independentlyVerified:true,endBalanceRaw:py.money.endBalanceRaw};
  },close:()=>parser.close(),
 };
}
