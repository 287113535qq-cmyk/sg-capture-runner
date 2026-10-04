import assert from 'node:assert/strict';
import {taskId,quotas} from './ag-core.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createSourceJournal} from './sg-source-journal.mjs';
import {nextgenSession} from './sg-nextgen-source.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
import {fiveSession} from './sg-five-source.mjs';
import {fiveCodec} from './sg-five-codec.mjs';
import {fortunesSession} from './sg-fortunes-source.mjs';
import {fortunesCodec} from './sg-fortunes-codec.mjs';
import {acornSession} from './sg-acorn-source.mjs';
import {acornCodec} from './sg-acorn-codec.mjs';
import {actionbankSession} from './sg-actionbank-source.mjs';
import {actionbankCodec} from './sg-actionbank-codec.mjs';
import {blazingSession} from './sg-blazing-source.mjs';
import {blazingCodec} from './sg-blazing-codec.mjs';
import {arthurSession} from './sg-arthur-source.mjs';
import {arthurCodec} from './sg-arthur-codec.mjs';
import {arthurFeatureCodec} from './sg-arthur-feature-codec.mjs';
import {arthurFeatureSession} from './sg-arthur-feature-source.mjs';
import {eightySession} from './sg-eighty-source.mjs';
import {eightyCodec} from './sg-eighty-codec.mjs';
import {drumsexplosionSession} from './sg-drumsexplosion-source.mjs';
import {drumsexplosionCodec} from './sg-drumsexplosion-codec.mjs';
import {dancingdrumsSession} from './sg-dancingdrums-source.mjs';
import {dancingdrumsCodec} from './sg-dancingdrums-codec.mjs';
import {crystalforestSession} from './sg-crystalforest-source.mjs';
import {crystalforestCodec} from './sg-crystalforest-codec.mjs';
import {cooljewelsSession} from './sg-cooljewels-source.mjs';
import {cooljewelsCodec} from './sg-cooljewels-codec.mjs';
import {cheshireSession} from './sg-cheshire-source.mjs';
import {cheshireCodec} from './sg-cheshire-codec.mjs';
import {celestialSession} from './sg-celestial-source.mjs';
import {celestialCodec} from './sg-celestial-codec.mjs';
import {createStagingStore} from './sg-staging-store.mjs';
import {localSpool} from '../local-spool.mjs';
import {analyzer} from '../analyzer.mjs';
// Compose the SG boundary of one original AG task. No legacy campaign/pool
// selection, no shared count allocator, and no source request at construction.
export function createTaskRuntime({store,transport,game,queueId,kind,index,quota,owner,plan,base,guard,
 resume,createSession,createCodec,spoolFactory=localSpool,createAnalyzer=analyzer}){
 createSession??=plan.adapter==='five-treasures-wms-v1'?fiveSession:plan.adapter==='fortunes-megaways-wms-v1'?fortunesSession:plan.adapter==='acorn-base-wms-v1'?acornSession:plan.adapter==='eighty-fortunes-wms-v1'?eightySession:plan.adapter==='actionbank-base-wms-v1'?actionbankSession:plan.adapter==='blazing-x-wms-v1'?blazingSession:plan.adapter==='arthur-base-wms-v1'?(plan.arthurFeatureContract!==undefined?arthurFeatureSession:arthurSession):plan.adapter==='celestial-base-wms-v1'?celestialSession:plan.adapter==='cheshire-base-wms-v1'?cheshireSession:plan.adapter==='cooljewels-base-wms-v1'?cooljewelsSession:plan.adapter==='crystalforest-base-wms-v1'?crystalforestSession:plan.adapter==='dancingdrums-base-wms-v1'?dancingdrumsSession:plan.adapter==='drumsexplosion-base-wms-v1'?drumsexplosionSession:nextgenSession;
 createCodec??=plan.adapter==='five-treasures-wms-v1'?fiveCodec:plan.adapter==='fortunes-megaways-wms-v1'?fortunesCodec:plan.adapter==='acorn-base-wms-v1'?acornCodec:plan.adapter==='eighty-fortunes-wms-v1'?eightyCodec:plan.adapter==='actionbank-base-wms-v1'?actionbankCodec:plan.adapter==='blazing-x-wms-v1'?blazingCodec:plan.adapter==='arthur-base-wms-v1'?(plan.arthurFeatureContract!==undefined?arthurFeatureCodec:arthurCodec):plan.adapter==='celestial-base-wms-v1'?celestialCodec:plan.adapter==='cheshire-base-wms-v1'?cheshireCodec:plan.adapter==='cooljewels-base-wms-v1'?cooljewelsCodec:plan.adapter==='crystalforest-base-wms-v1'?crystalforestCodec:plan.adapter==='dancingdrums-base-wms-v1'?dancingdrumsCodec:plan.adapter==='drumsexplosion-base-wms-v1'?drumsexplosionCodec:nextgenCodec;
 const id=taskId(kind,index),limits=quotas(game.baseline);
 assert(String(plan.gameId)===game.gameId&&plan.buy===0&&plan.database==='sg_capture_staging_v1'
  &&quota===(kind==='canary'?10:limits[index-1]),'SG_TASK_PLAN_SCOPE');
 let n=0;
 const sequence=()=>{n++;assert(n<=quota+(kind==='canary'?0:7),'SG_TASK_SEQUENCE_BOUND');
  return kind==='canary'?(index-1)*10+n:n<=quota?game.baseline+limits.slice(0,index-1).reduce((a,b)=>a+b,0)+n:
   300000+(index-1)*7+n-quota;};
 const journal=createSourceJournal({store,transport,game,queueId,kind,index,owner,guard});
 const protocol=createProtocolSessions({game,queueId,kind,index,owner,plan,journal,guard,spoolFactory,
  createSession:ctx=>createSession({...ctx,base,plan,guard}),
  createCodec:(p,session)=>createCodec({plan:p,session,sequence,worker:kind==='worker'?index-1:19+index,
   batchId:kind==='worker'?index:20+index,createAnalyzer}),
 });
 let parser,tail=Promise.resolve(),closed=false;
 const verifyRecords=records=>{
  const snapshot=structuredClone(records).sort((a,b)=>a.sequence-b.sequence);
  const result=tail.then(async()=>{
   assert(!closed,'SG_TASK_ANALYZER_CLOSED');parser??=createAnalyzer();return parser.verifyPage(plan,snapshot);
  });tail=result.catch(()=>{});return result;
 };
 const storage=createStagingStore({store,transport,game,queueId,kind,index,quota,owner,guard,
  verifyRecords,resume,onResume:count=>{assert(n===0,'SG_TASK_SEQUENCE_REENTRY');n=count;},
  assertDurable:records=>journal.assertDurable(records),inspectSource:()=>protocol.inspectSource()});
 return {protocol,storage,
  async close(){try{await storage.close();await journal.close();await tail;}finally{closed=true;parser?.close();}},
  status:()=>({taskId:id,completedPrepared:n,storage:storage.status(),sourceJournal:journal.status()}),
 };
}
