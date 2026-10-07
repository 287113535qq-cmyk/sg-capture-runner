import {OWN_TERMINAL,ownTerminalNext,ownTerminalFields} from './sg-own-terminal.mjs';
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
import {AUTOMATIC_TERMINAL,terminalNext,terminalFields} from './sg-automatic-terminal.mjs';
import {reviewExplicitPrefix} from './sg-explicit-review.mjs';
import {EXPLICIT_PROBE,explicitProbeRoute,explicitProbePick,explicitProbeIntent} from './sg-explicit-probe.mjs';
import {EXPLICIT_CONTINUATION,continuationRoute,continuationPick,continuationIntent} from './sg-explicit-continuation.mjs';
import {dragonRoute,dragonIntent} from './sg-explicit-dragon.mjs';
import {DRAGON_END,dragonEndPrevious,dragonEndRoute,dragonEndIntent} from './sg-dragon-end.mjs';
import {DRAGON_FREE,dragonFreePrevious,dragonFreeRoute,dragonFreeIntent} from './sg-dragon-first-free.mjs';
import {CARNIVAL_PICK,carnivalPrevious,carnivalRoute,carnivalPick,carnivalIntent} from './sg-carnival-pick.mjs';
import {ZERO_ABPM,zeroAbpmNext,zeroAbpmFields} from './sg-zero-abpm.mjs';
const require=createRequire(import.meta.url);let registered=false;
function loadCollector(){if(!registered){require('../../../collector/node_modules/ts-node').register({
 project:path.resolve('collector/tsconfig.json'),transpileOnly:true});registered=true;}}
// Original SG JS normalizer plus independent Python protocol/money/hash
// checks, behind the original AG session scheduler. One analyzer per session
// keeps eight concurrent sources independent without concurrent private IPC.
export async function nextgenCodec({plan,session,sequence,worker,batchId,createAnalyzer=analyzer}){
 assert(plan.adapter==='native-nextgen-v1'&&plan.buy===0&&typeof sequence==='function','SG_NEXTGEN_CODEC_SCOPE');
 const parser=createAnalyzer(),contract=actionContract(plan),priorPlan=plan.dragonFreeContract!==undefined?dragonFreePrevious(plan):plan,legacyPlan=plan.carnivalPickContract!==undefined?carnivalPrevious(plan):priorPlan.dragonEndContract!==undefined?dragonEndPrevious(priorPlan):priorPlan;loadCollector();
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
   ...(plan.ownTerminalContract===OWN_TERMINAL?{ownTerminalContract:OWN_TERMINAL}:{}),
   ...(plan.automaticTerminalContract===AUTOMATIC_TERMINAL?{automaticTerminalContract:AUTOMATIC_TERMINAL}:{}),
   ...(plan.explicitProbeContract===EXPLICIT_PROBE?{explicitProbeContract:EXPLICIT_PROBE}:{}),
   ...(plan.explicitContinuationContract!==undefined?{explicitContinuationContract:plan.explicitContinuationContract}:{}),
   ...(plan.explicitDragonContract!==undefined?{explicitDragonContract:plan.explicitDragonContract}:{}),
   ...(plan.dragonEndContract!==undefined?{dragonEndContract:plan.dragonEndContract}:{}),
   ...(plan.dragonFreeContract!==undefined?{dragonFreeContract:plan.dragonFreeContract}:{}),
   ...(plan.carnivalPickContract!==undefined?{carnivalPickContract:plan.carnivalPickContract}:{}),
   ...(plan.zeroAbpmContract===ZERO_ABPM?{zeroAbpmContract:ZERO_ABPM}:{}),
   ...(contract?{requestFlowVersion:contract.version,actionContractHash:contract.hash}:{})};},
  async reviewExplicit(raw){
   const js=reviewExplicitPrefix(legacyPlan,raw),py=await parser.call({op:'review_explicit',plan,raw});
   assert(stable(js)===stable(py),'SG_JS_PY_EXPLICIT_REVIEW_MISMATCH');return js;
  },
  async next(raw,chooseOption){
   if(raw.dragonFreeContract!==undefined){
    const route=dragonFreeRoute(plan,raw),py=await parser.call({op:'dragon_free_route',plan,raw});
    assert(stable(route)===stable(py),'SG_JS_PY_DRAGON_FREE_MISMATCH');
    if(route){
     dragonFreeIntent(plan,raw,payload(route.request));
     assert((await parser.call({op:'dragon_free_intent',plan,raw,payload:payload(route.request)}))?.validated===true,'SG_REQUEST_MODE');
     return route.request;
    }
   }
   if(raw.dragonEndContract!==undefined&&raw.dragonFreeContract===undefined){
    const route=dragonEndRoute(priorPlan,raw),py=await parser.call({op:'dragon_end_route',plan,raw});
    assert(stable(route)===stable(py),'SG_JS_PY_DRAGON_END_MISMATCH');
    if(route){
     dragonEndIntent(priorPlan,raw,payload(route.request));
     assert((await parser.call({op:'dragon_end_intent',plan,raw,payload:payload(route.request)}))?.validated===true,'SG_REQUEST_MODE');
     return route.request;
    }
   }
   if(raw.carnivalPickContract!==undefined){
    const route=carnivalRoute(plan,raw),py=await parser.call({op:'carnival_pick_route',plan,raw});
    assert(stable(route)===stable(py),'SG_JS_PY_CARNIVAL_PICK_MISMATCH');
    if(route){
     let request=route.request;
     if(route.options.length){
      const selected=typeof chooseOption==='function'?await chooseOption(route.options):route.options[0];
      assert(route.options.some(o=>o.pickIndex===selected?.pickIndex&&o.position===selected?.position),'CARNIVAL_PICK_POSITION');
      request=carnivalPick(plan,raw,selected.position);
     }
     carnivalIntent(plan,raw,payload(request));
     assert((await parser.call({op:'carnival_pick_intent',plan,raw,payload:payload(request)}))?.validated===true,'SG_REQUEST_MODE');
     return request;
    }
   }
   if(raw.explicitDragonContract!==undefined&&raw.dragonEndContract===undefined){
    const route=dragonRoute(legacyPlan,raw),py=await parser.call({op:'explicit_dragon_route',plan,raw});
    assert(stable(route)===stable(py),'SG_JS_PY_EXPLICIT_DRAGON_MISMATCH');
    if(route){
     dragonIntent(legacyPlan,raw,payload(route.request));
     assert((await parser.call({op:'explicit_dragon_intent',plan,raw,payload:payload(route.request)}))?.validated===true,'SG_REQUEST_MODE');
     return route.request;
    }
   }
   if(raw.explicitContinuationContract!==undefined&&raw.carnivalPickContract===undefined){
    const route=continuationRoute(legacyPlan,raw),py=await parser.call({op:'explicit_continuation_route',plan,raw});
    assert(stable(route)===stable(py),'SG_JS_PY_EXPLICIT_CONTINUATION_MISMATCH');
    if(route){
     let request=route.request;
     if(route.options.length){
      const selected=typeof chooseOption==='function'?await chooseOption(route.options):route.options[0];
      assert(route.options.some(o=>o.pickIndex===selected?.pickIndex&&o.position===selected?.position),'EXPLICIT_CONTINUATION_POSITION');
      request=continuationPick(legacyPlan,raw,selected.position);
     }
     continuationIntent(legacyPlan,raw,payload(request));
     assert((await parser.call({op:'explicit_continuation_intent',plan,raw,payload:payload(request)}))?.validated===true,'SG_REQUEST_MODE');
     return request;
    }
   }
   if(raw.explicitProbeContract!==undefined&&raw.carnivalPickContract===undefined&&raw.dragonEndContract===undefined){
    const route=explicitProbeRoute(legacyPlan,raw),py=await parser.call({op:'explicit_probe_route',plan,raw});
    assert(stable(route)===stable(py),'SG_JS_PY_EXPLICIT_PROBE_MISMATCH');
    if(route){
     let request=route.request;
     if(route.options.length){
      const selected=typeof chooseOption==='function'?await chooseOption(route.options):route.options[0];
      assert(route.options.some(o=>o.pickIndex===selected?.pickIndex&&o.position===selected?.position),'EXPLICIT_PROBE_POSITION');
      request=explicitProbePick(legacyPlan,raw,selected.position);
     }
     explicitProbeIntent(legacyPlan,raw,payload(request));
     assert((await parser.call({op:'explicit_probe_intent',plan,raw,payload:payload(request)}))?.validated===true,'SG_REQUEST_MODE');
     return request;
    }
   }
   const js=raw.ownTerminalContract!==undefined?ownTerminalNext(plan,raw):raw.automaticTerminalContract!==undefined?terminalNext(plan,raw):raw.zeroAbpmContract!==undefined?zeroAbpmNext(plan,raw):raw.automaticFreeContract===AUTOMATIC_FREE_CONTRACT?automaticFreeNext(plan,raw):contract?contract.next(plan,raw):nextRequest(raw);
   const py=await parser.call({op:'next',plan,raw});assert(stable(js)===stable(py),'SG_JS_PY_ROUTE_MISMATCH');
   if(js)assert((await parser.call({op:'intent',plan,raw,payload:payload(js)}))?.validated===true,'SG_REQUEST_MODE');
   return js;},
  async prepare(raw,{attempt,sessionHash}){
   const py=await parser.call({op:'fields',plan,raw});
   const js=raw.ownTerminalContract!==undefined?ownTerminalFields(plan,raw,py.typeMappingHash):raw.automaticTerminalContract!==undefined?terminalFields(plan,raw,py.typeMappingHash):raw.zeroAbpmContract!==undefined?zeroAbpmFields(plan,raw,py.typeMappingHash):raw.automaticFreeContract===AUTOMATIC_FREE_CONTRACT?automaticFreeFields(plan,raw,py.typeMappingHash):raw.balanceContract===BALANCE_CONTRACT?heldBalanceFields(plan,raw,py.typeMappingHash):contract?captureCollector(contract.collectorKind).prepareNextgenActionRound(raw,plan):
    captureCollector('nextgen').prepareNextgenRound(raw,{buy:py.buy,bonus:py.bonus,typeMappingHash:py.typeMappingHash});
   assert(stable(js)===stable(py),'SG_JS_PY_FIELDS_MISMATCH');
   const record=await parser.call({op:'record',plan,raw,normalized:js,sequence:sequence(),attempt,
    sessionHash,worker,batchId});
   assert((await parser.call({op:'verify',plan,raw,record}))?.verified===true,'SG_FULL_RECORD_VALIDATION');
   return {record,independentlyVerified:true,endBalanceRaw:py.money.endBalanceRaw};
  },close:()=>parser.close(),
 };
}
