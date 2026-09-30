import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixtures/demo-next-game.mjs';import {formalSourceFixture} from './fixtures/formal-source.mjs';
import {prepareEmptyCandidate,stagedEmptyCandidatePool} from './demo-empty-candidate.mjs';import {nextDemoGame,nextDemoScene} from './demo-next-game.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
async function setup(){
 const f=await fixture(),src=formalSourceFixture(),plan=f.args.plans[32835],p=f.args.profile;
 for(const k of [...f.docs.keys()])if(k.includes(plan.trialId))f.docs.delete(k);
 for(const [k,value]of src.docs)f.docs.set(k,{value:structuredClone(value)});
 const c=f.docs.get('state/campaign').value;c.enabled=true;c.formalCount={activation:src.args.plan.countAllocation};c.games.push({game_id:32835,status:'needs-adapter',baseline:0,confirmed:0});
 Object.assign(p,{sourceFormal:{...src.args.profile.sourceFormal,plan:src.args.plan,campaignHash:hash(c)},fromGameId:32795,sourceCommit:src.args.profile.sourceFormal.commit,sourceRunKey:'capture-run:77:1',sourcePlanHash:hash(src.args.plan),completePreserved:0,abandonedAttempts:0,emptyCandidate:{schema:'sg-empty-demo-candidate-v1',campaignHash:hash(c)}});f.args.plans[32795]=src.args.plan;
 const transport=f.args.transport,original=transport.request;transport.request=async(op,v)=>['rounds_scan','scan'].includes(op)?[]:original(op,v);
 p.sceneHash=hash({campaign:c,pool:stagedEmptyCandidatePool(plan,p),fromPool:src.args.scene.fromPool,batches:[],sourceBatches:src.args.scene.sourceBatches});
 return {f,plan,p,src};
}
test('3000-batch fully audited formal game hands off through real empty/retire/rollover/fresh without losing completion',async()=>{
 const {f,plan,p,src}=await setup();await prepareEmptyCandidate({...f.args,plan});
 assert.equal(hash(await nextDemoScene(f.args.store,plan,src.args.plan)),p.sceneHash);
 const result=await nextDemoGame(f.args);assert.equal(result.newBetAllowance,100);assert.equal(result.completePreserved,0);assert.equal((await f.admit()).limit,5);
 const c=f.get('state','campaign').value;assert.equal(c.games.find(g=>g.game_id===32795).status,'complete');assert.equal(c.formalCount,undefined);
 assert.equal(f.get('state','pool:'+src.args.plan.trialId).value.confirmed,300000);
});
test('missing source audit or incomplete final transition cannot authorize next game source',async()=>{
 for(const mode of ['audit','partial']){
  const {f,plan,src}=await setup();await prepareEmptyCandidate({...f.args,plan});
  if(mode==='audit')f.docs.delete('journal/game-audit:'+src.args.plan.trialId);else f.fail(f.key+':complete');
  await assert.rejects(nextDemoGame(f.args));await assert.rejects(f.admit());
 }
});
