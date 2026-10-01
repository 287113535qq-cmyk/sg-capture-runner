import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {amendZeroSourceCountRuntime} from './count-zero-source-runtime.mjs';
import {loadCountPermission} from './complete-count.mjs';import {RunnerPool} from './state-store.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {nextgenCountGame} from '../trial/nextgen-count-session.mjs';import {gameForShard} from '../trial/demo-sessions.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
function fixture(){
 const profile=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-coins-20261001.json','utf8'));
 const plan=applyFormalCount(JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),profile)[32721];
 const base={id:32721,runtimeSlug:plan.runtimeSlug,mode:'demo',serverAddress:'ogs-gdm-usnj.nyxop.net/nextgen',sessionId:'Free:synthetic',operatorId:'synthetic'};
 const old=gameForShard(base,20,plan.trialId,plan),oldHash=hash(old.sessionId+'@'+old.operatorId);
 const docs=new Map(),put=(c,k,value)=>docs.set(c+'/'+k,{value:structuredClone(value)}),batches=[];
 for(let id=1;id<=17;id++){
  const count=id===17?58:100,b={id,worker:20,start:(id-1)*100+1,end:id*100,sessionHash:oldHash,
   journaled:(id-1)*100+count,checkpoint:(id-1)*100+count,pending:null,leaseUntil:0};
  put('state',`batch:${plan.trialId}:${id}`,b);batches.push({...b,closed:true,complete:count,evidenceHash:hash(b)});
 }
 const fromCommit='ef8f1a0185fb99f5e1d53cf2bcc2c72a6ad9e366',commit='b'.repeat(40);
 const spec={schema:'sg-complete-count-v1',activation:plan.countAllocation,commit:fromCommit,planHash:hash(plan),profileHash:hash(profile),
  trialId:plan.trialId,gameId:32721,target:299850,maxSequence:600000,baselineBatchCount:17,baselineHash:hash(batches),firstSequence:1701,sessionRotation:'closed-batches-v1'};
 const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;put('journal',key,spec);
 put('journal',key+':complete',{schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit:fromCommit});
 const pool={planHash:hash(plan),enabled:true,confirmed:1658,nextBatchId:18,nextSequence:1701,workers:{},countAllocation:{specHash:hash(spec),reserved:0,batches:Object.fromEntries(batches.map(b=>[b.id,b]))}};
 const campaign={group:'secondary',enabled:true,activeGame:32721,formalCount:{activation:plan.countAllocation}};
 put('state','pool:'+plan.trialId,pool);put('state','campaign',campaign);
 const permit={schema:'sg-count-run-v1',activation:plan.countAllocation,profileHash:hash(profile),commit:fromCommit,run:'36788992387:1',poolHash:hash(pool),completeBefore:1658};
 put('journal',`count-run:${plan.trialId}:36788992387:1`,permit);
 const revision={schema:'sg-count-zero-source-runtime-v1',activation:plan.countAllocation,profileHash:hash(profile),planHash:hash(plan),
  sourceRun:permit.run,sourcePermitHash:hash(permit),fromCommit,poolHash:hash(pool),campaignHash:hash(campaign),createdAt:1,expiresAt:1000};
 const ended={id:36788992387,run_attempt:1,status:'completed',conclusion:'cancelled',head_sha:fromCommit,repository:{full_name:'287113535qq-cmyk/sg-capture-runner'},path:'.github/workflows/trial-300k.yml'};
 const jobs={total_count:21,jobs:[{name:'pyramids-formal-admit',status:'completed',conclusion:'success'},...Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'completed',conclusion:'cancelled'}))]};
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),getMany:async(c,ks)=>ks.map(k=>structuredClone(docs.get(c+'/'+k))),
  create:async(c,k,v,o)=>{assert(o.immutable&&!docs.has(c+'/'+k));put(c,k,v);},update:async(c,k,fn)=>{const v=await fn(structuredClone(docs.get(c+'/'+k).value));if(v)put(c,k,v);}};
 return {docs,pool,base,oldHash,put,args:{store,plan,profile,revision,ended,jobs,commit,run:'999:1',boundary:async()=>{},now:()=>100}};
}
test('zero-registration amendment adds only immutable runtime proof; real session path rejects old identity then registers fresh owner',async()=>{
 const f=fixture(),a=f.args,before=new Map([...f.docs].map(([k,v])=>[k,hash(v)]));
 await assert.rejects(loadCountPermission({...a,pool:f.pool}),/COUNT_AUTHORIZATION/);
 const result=await amendZeroSourceCountRuntime(a);assert.equal(result.newBetAllowance,0);assert.equal(result.remainingComplete,298192);
 assert.equal(f.docs.size,before.size+1);for(const[k,h]of before)assert.equal(hash(f.docs.get(k)),h);
 await loadCountPermission({...a,pool:f.pool});
 const pool=new RunnerPool({...a,group:'secondary'}),owner='999:1:capture:00000000-0000-0000-0000-000000000001';
 await assert.rejects(pool.register(20,{owner,sessionHash:f.oldHash}),/COUNT_SESSION_REUSED/);
 const game=nextgenCountGame(f.base,a.plan,20,owner),sessionHash=hash(game.sessionId+'@'+game.operatorId);
 assert.notEqual(sessionHash,f.oldHash);assert.equal(game.sessionId,nextgenCountGame(f.base,a.plan,20,owner).sessionId);
 assert.notEqual(game.sessionId,nextgenCountGame(f.base,a.plan,20,owner.replace('999:','998:')).sessionId);
 const lease=await pool.register(20,{owner,sessionHash});const batch=await pool.take(lease);
 assert.equal(batch.start,1701);assert.equal(batch.worker,20);
 await assert.rejects(pool.register(20,{owner:owner.replace('001','002'),sessionHash:hash('another')}));
});
for(const bad of ['worker','sequence','batch','permit','missing','pending','live','expired','duplicate-job','wrong-run'])test('zero-registration amendment rejects '+bad,async()=>{
 const f=fixture(),a=f.args;
 if(bad==='worker')f.docs.get('state/pool:'+a.plan.trialId).value.workers[20]={leaseUntil:0};
 if(bad==='sequence')f.docs.get('state/pool:'+a.plan.trialId).value.nextSequence++;
 if(bad==='batch')f.docs.get('state/batch:'+a.plan.trialId+':1').value.changed=true;
 if(bad==='permit')a.revision.sourcePermitHash='0'.repeat(64);
 if(bad==='missing')f.docs.delete('state/batch:'+a.plan.trialId+':1');
 if(bad==='pending')f.docs.get('state/batch:'+a.plan.trialId+':1').value.pending={};
 if(bad==='live')a.ended.status='in_progress';
 if(bad==='expired')a.now=()=>1001;
 if(bad==='duplicate-job')a.jobs.jobs[1].name='capture-1';
 if(bad==='wrong-run')a.revision.sourceRun='1:1';
 const before=hash([...f.docs]);await assert.rejects(amendZeroSourceCountRuntime(a));assert.equal(hash([...f.docs]),before);
});
test('formal session cannot be enabled by demo or unrelated game identity',()=>{
 const f=fixture(),owner='999:1:capture:00000000-0000-0000-0000-000000000001';
 for(const p of [{...f.args.plan,countAllocation:undefined},{...f.args.plan,demoGeneration:'a'.repeat(64)},{...f.args.plan,gameId:32720}])assert.throws(()=>nextgenCountGame(f.base,p,20,owner));
 assert.throws(()=>nextgenCountGame(f.base,f.args.plan,0,owner));assert.throws(()=>nextgenCountGame(f.base,f.args.plan,20,'retry'));
});
