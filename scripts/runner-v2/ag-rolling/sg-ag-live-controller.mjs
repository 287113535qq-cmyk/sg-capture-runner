import assert from 'node:assert/strict';
import {createSgAgFullControlAdapter} from './sg-ag-full-control-adapter.mjs';
import {createProductionSgIo} from './sg-ag-production-io.mjs';
import {cohortRepos,cohortView,participantKey,inspectParticipant} from './sg-federation.mjs';

// The existing primary controller owns both projections. Each original AG
// invocation sees only its own run, lanes and game assignment.
export function createLiveAgController(context){
 const {profile,store,coordinatorRun,commit,makeContext,sourceClose}=context;
 assert(typeof makeContext==='function'&&typeof sourceClose==='function','SG_AG_LIVE_PORTS');
 const controls=new Map();let inFlight=null,closed=false;
 async function control(repository,cohortRun){
  if(controls.has(cohortRun))return controls.get(cohortRun);
  const view=cohortView(profile,repository),state={version:1,queueId:profile.payload.queueId,
   runId:Number(cohortRun.split(':')[0]),phase:'running',games:view.payload.games.map(g=>({...structuredClone(g),phase:'ready'}))};
  const ports=await makeContext({repository,cohortRun,state});
  if(ports.loadState){const saved=await ports.loadState();if(saved){
   assert(saved.version===1&&saved.runId===state.runId&&saved.queueId===state.queueId
    &&saved.games.length===state.games.length&&saved.games.every((g,i)=>g.gameId===state.games[i].gameId&&g.campaignId===state.games[i].campaignId),'SG_AG_LIVE_SAVED_STATE_IDENTITY');
   Object.assign(state,structuredClone(saved));
  }}
  await ports.acceptCompletedGames?.(state);
  if(ports.flushControl){assert(ports.privateControlPersist('own-control-state',state)?.fullReadback,'SG_AG_LIVE_INITIAL_STATE_READBACK');await ports.flushControl();}
  const io=createProductionSgIo({...ports,profile,store,cohortRun,coordinatorRun,commit,repository});
  const originalJobs=io.readJobs;
  io.readJobs=async(...args)=>{
   const result=await originalJobs.apply(io,args),closed=sourceClose();
   if(repository===cohortRepos.primary&&closed){
    assert(closed.sourceClosed===true&&closed.run===cohortRun&&closed.lane===20,'SG_AG_LIVE_SOURCE_CLOSE_IDENTITY');
    // The hosted job also owns this controller. Only a real child close
    // received over its private IPC can project the source node as ended.
    result.jobs=result.jobs.map(j=>j.name==='AG rolling lane 20'&&j.status!=='completed'
     ?{...j,status:'completed',conclusion:closed.code===0&&closed.signal===null?'success':'failure'}:j);
   }
   return result;
  };
  const api=createSgAgFullControlAdapter({state,cohortRun,commit,queueId:profile.payload.queueId,store,io});
  const value={api,state,ports};controls.set(cohortRun,value);return value;
 }
 async function reconcilePass(){
   let participant;
   if(profile.federation){participant=(await store.get('journal',participantKey(profile)))?.value;
    if(!participant||context.canStart&& !await context.canStart(participant))return profile.payload.games.map(g=>({gameId:g.gameId,status:'ready',count:0}));
    inspectParticipant({profile,receipt:participant,coordinatorRun,commit});
   }
   const cohorts=[[cohortRepos.primary,coordinatorRun],...(participant?[[cohortRepos.secondary,participant.run]]:[])];
   const owned=cohorts.flatMap(([repo])=>cohortView(profile,repo).payload.games.map(g=>g.gameId));
   assert(owned.length===profile.payload.games.length&&new Set(owned).size===owned.length,'SG_AG_LIVE_DISJOINT_GAMES');
   // Each cohort still invokes the unmodified original AG loop. Its parser,
   // business client, game budget and control journal are independently owned.
   // Await both closures on failure; never release a still-running peer.
   const results=await Promise.allSettled(cohorts.map(async([repository,run])=>{
    const value=await control(repository,run);await value.api.reconcile();await value.ports.flushControl?.();
   }));
   const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
   if(participant){const receipt=(await store.get('journal',participantKey(profile)))?.value;
    assert(receipt&&JSON.stringify(receipt)===JSON.stringify(participant),'SG_AG_LIVE_PARTICIPANT_CHANGED');}
   return [...controls.values()].flatMap(c=>c.state.games).map(g=>({gameId:g.gameId,status:g.phase,count:g.phase==='complete'?300000:0}));
 }
 return {
  reconcile(){
   assert(!closed,'SG_AG_LIVE_CLOSED');
   // A second observer tick shares the admitted pass; it cannot construct a
   // second actor or append a duplicate per-cohort journal sequence.
   return inFlight??=(async()=>{try{return await reconcilePass();}finally{inFlight=null;}})();
  },
  async resume(){assert(!closed&&!inFlight,'SG_AG_LIVE_BUSY');for(const value of controls.values())await value.api.resume();},
  async close(){closed=true;if(inFlight)await inFlight.catch(()=>{});
   const results=await Promise.allSettled([...controls.values()].map(value=>value.ports.closeWorkflow?.()));
   const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  }
 };
}
