import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
// SG protocol boundary behind the original AG session class. Source transports
// and game codecs are supplied by the registered queue's SG adapter. They may
// not bypass exchange(): every request intent precedes HTTP, each response is
// fsynced and durably acknowledged before the next feature request.
export function createProtocolSessions({game,queueId,kind,index,owner,plan,createSession,createCodec,
 journal,spoolFactory,guard}){
 assert(typeof createSession==='function'&&typeof createCodec==='function'&&typeof spoolFactory==='function'
  &&typeof guard==='function'&&typeof journal.intent==='function'&&typeof journal.response==='function'
  &&typeof journal.auditSources==='function'&&typeof journal.open==='function'
  &&typeof journal.close==='function'&&Number.isSafeInteger(plan.maxSteps)&&plan.maxSteps>0,'SG_PROTOCOL_DEPENDENCIES');
 const sessions=[];let sourceOrdinal=0;
 const identity={gameId:game.gameId,queueId,kind,index,owner};
 return {
  async open(){
   await guard();const ordinal=++sourceOrdinal;
   // createSession prepares a cookie jar and identity only; its sole source
   // method send() is called inside exchange after the durable intent.
   const session=await createSession({...identity,ordinal});let codec,spool;
   try{codec=await createCodec(plan,session);spool=spoolFactory();
    assert(typeof session?.identity==='string'&&typeof session.send==='function'&&typeof codec.bootstrap==='function'
     &&typeof codec.next==='function'&&typeof codec.prepare==='function'&&typeof codec.createRaw==='function'
     &&typeof codec.payload==='function','SG_PROTOCOL_CODEC');
   }catch(error){await session.close();codec?.close?.();spool?.close();throw error;}
   const state={sessionHash:session.identity,ordinal,requestNo:0,awaiting:null,activeRound:false,protocolFaults:0,
    unknownRequests:0,closed:false,ready:false,balance:null,roundNo:0,
    performance:{source:{count:0,totalMs:0},intent:{count:0,totalMs:0},response:{count:0,totalMs:0},normalize:{count:0,totalMs:0}}};sessions.push(state);
   try{await journal.open({...identity,sessionHash:state.sessionHash,ordinal});}
   catch(error){await session.close();codec.close?.();spool.close();throw error;}
   const exchange=async(msgId,requestPayload)=>{
    assert(!state.awaiting&&!state.closed,'SG_PROTOCOL_UNRESOLVED_INTENT');await guard({stage:'intent',msgId,activeRound:state.activeRound});
    const request={...identity,sessionHash:state.sessionHash,requestNo:++state.requestNo,msgId,requestPayload};
    state.awaiting=request.requestNo;
    let started=performance.now();
    try{const intent=await journal.intent(request);assert(intent?.durable===true,'SG_SOURCE_INTENT_ACK');
     state.performance.intent.count++;state.performance.intent.totalMs+=performance.now()-started;}
    catch(error){throw Object.assign(new Error('JOURNAL_ACK_UNKNOWN'),{code:'JOURNAL_ACK_UNKNOWN',cause:error});}
    let step;
    started=performance.now();try{step=await session.send(requestPayload,msgId);
     state.performance.source.count++;state.performance.source.totalMs+=performance.now()-started;}catch{
     state.unknownRequests++;throw Object.assign(new Error('SOURCE_NETWORK_OUTCOME_UNKNOWN'),{code:'SOURCE_NETWORK_OUTCOME_UNKNOWN'});
    }
    // A source rejection remains a durable response; it never authorizes
    // resending a BET or deleting the failed natural feature prefix.
    step={...step,rollingSource:{sessionHash:state.sessionHash,requestNo:request.requestNo}};spool.append(step);
    started=performance.now();try{const ack=await journal.response({...request,step});assert(ack?.durable===true,'SG_SOURCE_RESPONSE_ACK');
     state.performance.response.count++;state.performance.response.totalMs+=performance.now()-started;}
    catch(error){throw Object.assign(new Error('JOURNAL_ACK_UNKNOWN'),{code:'JOURNAL_ACK_UNKNOWN',cause:error});}
    spool.confirmed();state.awaiting=null;return step;
   };
   return {
    identity:session.identity,
    async captureRound({chooseOption,signal}){
     assert(!state.closed&&!state.activeRound&&!state.awaiting,'SG_PROTOCOL_REENTRY');
     try{
      if(!state.ready){state.balance=await codec.bootstrap(exchange);state.ready=true;}
      if(Number.isSafeInteger(plan.betRaw)&&state.balance<plan.betRaw){
       const previous=state.balance;state.balance=await codec.bootstrap(exchange);
       assert(state.balance>=plan.betRaw&&state.balance>previous,'SG_DEMO_BALANCE_REFRESH');
      }
      // A source stop prevents starting a round; already issued natural
      // continuation is retained/drained by the codec rather than replayed.
      assert(!signal?.aborted,'SG_SOURCE_STOPPED');await guard();
      const attempt=randomUUID(),raw=codec.createRaw({balance:state.balance,attempt});state.activeRound=true;
      assert(raw?.fixtureOnly===false&&Array.isArray(raw.steps)&&raw.steps.length===0,'SG_PROTOCOL_RAW');
      let next=await codec.next(raw,chooseOption);
      while(next){
       assert(raw.steps.length<plan.maxSteps,'SG_ROUND_STEP_LIMIT');
       const step=await exchange(next.MSGID,codec.payload(next));raw.steps.push(step);
       assert(!step.sourceRejected,'SG_SOURCE_RESPONSE_REJECTED');next=await codec.next(raw,chooseOption);
      }
      const started=performance.now(),prepared=await codec.prepare(raw,{attempt,roundNo:++state.roundNo,sessionHash:state.sessionHash});
      state.performance.normalize.count++;state.performance.normalize.totalMs+=performance.now()-started;
      assert(prepared?.independentlyVerified===true&&prepared.record?.fixtureOnly===false&&prepared.record.buy===0
       &&String(prepared.record.gameId)===game.gameId&&Number.isSafeInteger(prepared.endBalanceRaw),'SG_PROTOCOL_FULL_ROUND');
      state.balance=prepared.endBalanceRaw;state.activeRound=false;
      return {bet:prepared.record.bet,mul:prepared.record.mul,balance:state.balance,isFeature:Boolean(prepared.record.bonus),
       optionIndex:prepared.optionIndex??0,data:{complete:true,independentlyVerified:true,unknownRequests:0,
        roundEvents:prepared.roundEvents??[],sgRecord:prepared.record}};
     }catch(error){state.protocolFaults++;
      const code=error.code??error.message;
      state.lastFault=/^[A-Z_]{1,100}$/.test(code??'')?code:'SG_PROTOCOL_STOPPED';throw error;}
    },
    async close(){if(state.closed)return;await session.close();spool.close();
     await codec.close?.();
     await journal.close({...identity,...structuredClone(state),closed:true});state.closed=true;},
   };
  },
  async inspectSource(){
   // Never turn process-local counters into a source closure proof. The
   // registered journal must freshly verify all intent/response pairs and
   // closures for this exact AG task before the staging audit can succeed.
   const result=await journal.auditSources({...identity,sessions:structuredClone(sessions)});
   assert(result?.queueId===queueId&&result.gameId===game.gameId&&result.owner===owner
    &&result.taskId===`${kind}:${index}`,'SG_SOURCE_AUDIT_IDENTITY');return result;
  },
  metrics(){const result={sessions:sessions.length,requests:sessions.reduce((a,s)=>a+s.requestNo,0),byOperation:{}};
   for(const s of sessions)for(const [key,value] of Object.entries(s.performance)){
    result.byOperation[key]??={count:0,totalMs:0};result.byOperation[key].count+=value.count;result.byOperation[key].totalMs+=value.totalMs;
   }return result;},
 };
}
