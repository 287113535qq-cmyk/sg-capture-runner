import test from 'node:test';import assert from 'node:assert/strict';
import {prepareEmptyCandidate,stagedEmptyCandidatePool} from './demo-empty-candidate.mjs';
import {fixture} from './fixtures/demo-next-game.mjs';import {nextDemoGame,nextDemoScene} from './demo-next-game.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
async function setup(){
 const f=await fixture(),plan=f.args.plans[32835],p=f.args.profile,c=f.docs.get('state/campaign').value;
 for(const k of [...f.docs.keys()])if(k.includes(plan.trialId))f.docs.delete(k);
 c.games.find(g=>g.game_id===32835).status='needs-adapter';Object.assign(c.games.find(g=>g.game_id===32835),{baseline:0,confirmed:0});
 p.emptyCandidate={schema:'sg-empty-demo-candidate-v1',campaignHash:hash(c)};p.completePreserved=0;p.abandonedAttempts=0;
 // Scene cannot contain its own profile hash: use a stable spec hash in state.
 const transport=f.args.transport,original=transport.request;
 transport.request=async(op,v)=>['rounds_scan','scan'].includes(op)?[]:original(op,v);
 return{f,plan,p,c};
}
test('empty candidate stages no credit, then actual retirement/rollover/fresh gives only five per worker',async()=>{
 const {f,plan,p}=await setup();
 // Predict the staged scene without any database mutation.
 const c=structuredClone(f.get('state','campaign').value);
 const fromPlan=f.args.plans[p.fromGameId],fromPool=f.get('state','pool:'+fromPlan.trialId).value;
 p.sceneHash=hash({campaign:c,pool:stagedEmptyCandidatePool(plan,p),fromPool,batches:[],sourceBatches:[f.get('state','batch:'+fromPlan.trialId+':1').value]});
 const originalBoundary=f.args.boundary;
 f.args.boundary=async()=>{assert.equal(hash(f.get('state','campaign').value),hash(c),'closed source campaign must stay unchanged until final rollover');await originalBoundary();};
 await prepareEmptyCandidate({...f.args,plan});assert.equal(f.get('state','pool:'+plan.trialId).value.enabled,false);
 assert.equal(hash(await nextDemoScene(f.args.store,plan,fromPlan)),p.sceneHash);
 const r=await nextDemoGame(f.args);assert.equal(r.completePreserved,0);assert.equal(r.abandonedAttempts,0);assert.equal((await f.admit()).limit,5);
});
test('nonempty state, records, history, changed campaign and failed final journal cannot grant source',async()=>{
 for(const cause of ['state','rounds','journal','campaign','partial']){
  const {f,plan,p}=await setup();
  if(cause==='state')f.docs.set('state/batch:'+plan.trialId+':3',{value:{}});
  if(cause==='rounds'||cause==='journal')f.args.transport.request=async op=>op===(cause==='rounds'?'rounds_scan':'scan')?[{}]:[];
  if(cause==='campaign')p.emptyCandidate.campaignHash='f'.repeat(64);
  if(cause==='partial')f.fail(`empty-demo-candidate:${plan.trialId}:${p.generation}:complete`);
  await assert.rejects(prepareEmptyCandidate({...f.args,plan}));assert(!f.get('state','pool:'+plan.trialId)?.value.enabled);await assert.rejects(f.admit());
 }
});
