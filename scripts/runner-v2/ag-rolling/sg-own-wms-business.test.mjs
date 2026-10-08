import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {WMS_FIVE_PINS,ORIGINAL_BUSINESS_IDS,ownWmsBusinessPlan,assertOwnWmsBinding,assertBusinessGameScope,ordinaryBusinessAdapter,verifyOwnWmsBusinessPage} from './sg-own-wms-business.mjs';
import {assertOrdinaryPrivileges} from './sg-ag-ordinary-admission.mjs';
import {inspectExistingGameBinding} from './sg-ag-existing-workflow.mjs';
import {verifyOrdinaryNativePage,deliverOrdinaryBusiness} from './sg-ag-ordinary-business.mjs';
const registry=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')),bindings=JSON.parse(fs.readFileSync('config/ag-business-bindings.json')).bindings;
const original=ORIGINAL_BUSINESS_IDS.map(gameId=>({gameId})),five=Object.keys(WMS_FIVE_PINS),games=[...original,...five.map(gameId=>({gameId}))];
function privileges(ids){return [...ids.map(g=>({resource:{db:'sg_'+registry.plans[g.gameId].runtimeSlug,collection:'simulate'},actions:['find','insert','update']})),...Object.entries({capture_state_v2:['find'],capture_journal_v2:['find'],official_rounds:['find'],business_delivery_v1:['find','insert']}).map(([collection,actions])=>({resource:{db:'sg_capture_staging_v1',collection},actions}))];}
const auth=p=>({authInfo:{authenticatedUsers:[{user:'sg_simulate_delivery_v1',db:'admin'}],authenticatedUserPrivileges:p}});
test('exact original81 remains accepted; only own five can extend scope to86 and90 resources',()=>{
 for(const ids of [original,games])assertOrdinaryPrivileges(auth(privileges(ids)),{profile:{payload:{games:ids}},plans:registry.plans,binding:bindings[ids[0].gameId]});
 for(const bad of [games.slice(1),[...games,games[0]],[...original,{gameId:'32750'},...games.slice(82)],original.slice(1)])assert.throws(()=>assertBusinessGameScope(bad,registry.plans));
 for(const mutate of [p=>p[0].actions.push('remove'),p=>p.push(p[0]),p=>p[0].resource={db:'admin',collection:''},p=>p.pop()]){const p=privileges(games);mutate(p);assert.throws(()=>assertOrdinaryPrivileges(auth(p),{profile:{payload:{games}},plans:registry.plans,binding:bindings['32752']}));}
});
for(const id of five){
 test('own WMS '+id+' requires exact reviewed plan/binding and unchanged database/runtime/RTP',()=>{
  const plan=registry.plans[id],binding=bindings[id];assert(ownWmsBusinessPlan(plan));assert(ordinaryBusinessAdapter(plan));assertOwnWmsBinding(plan,binding);
  inspectExistingGameBinding({binding,game:{gameId:id,dbName:'sg_'+id},profile:{payload:{queueId:binding.queueId}},plan});
  for(const change of [p=>p.betRaw++,p=>p.runtimeGameId++,p=>p.trialId+='x',p=>p.sourceKey+='x',p=>p.buy=1]){const p=structuredClone(plan);change(p);assert(!ownWmsBusinessPlan(p));}
  for(const change of [b=>b.database+='x',b=>b.rtp[0]++,b=>b.queueId+='x',b=>b.runtimeGameId++]){const b=structuredClone(binding);change(b);assert.throws(()=>assertOwnWmsBinding(plan,b));}
 });
 test('own WMS '+id+' preexisting pool or unsupported record stops before guard or writes',async()=>{
  let guards=0;const plan=registry.plans[id],b=bindings[id];
  await assert.rejects(()=>deliverOrdinaryBusiness({plan,binding:b,expectedProof:{queueId:b.queueId},expectedOriginalCount:1,owner:'test',evidenceMode:'existing-immutable-audit',guard:()=>{guards++;}}),/EXISTING_TARGET_REQUIRES_OWN_REVIEW/);assert.equal(guards,0);
  await assert.rejects(()=>verifyOrdinaryNativePage({records:[{_id:'a',sequence:1,gameId:0}],plan,parser:{verifyPage(){throw Error('must not reach Python');}}}),/NATIVE_SCOPE/);
 });
}
test('unreviewed WMS games and plan drift cannot use own five delivery route',async()=>{
 assert(!ordinaryBusinessAdapter(registry.plans['32750']));
 await assert.rejects(()=>verifyOwnWmsBusinessPage({plan:registry.plans['32750'],records:[],parser:null}),/OWN_PLAN/);
 const plans=structuredClone(registry.plans);plans['32752'].betRaw++;assert.throws(()=>assertBusinessGameScope(games,plans),/OWN_PLAN/);
});
