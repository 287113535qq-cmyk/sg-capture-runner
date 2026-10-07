import test from 'node:test';
import assert from 'node:assert/strict';
import {readControlAppendCursor,loadExistingControlState} from './sg-ag-control-journal-cursor.mjs';
const clone=structuredClone;
function fixture({base=356,run='37526015944:1',gameId='32733'}={}){
 const key='rolling-ag-control:'+'a'.repeat(64),cohortRun=run,commit='b'.repeat(40);
 const state={games:[{gameId,phase:'blocked',reason:'SG_AG_GAME_BUDGET_EXHAUSTED'}]};
 const saved={_id:'primary/'+key,version:67,value:{cohortRun,commit,state,sequence:base,journal:key+':'+base}};
 const doc=(n,file,value)=>({_id:'primary/'+key+':'+n,version:0,value:{file,value,cohortRun,commit}});
 const docs=new Map([[key+':'+base,doc(base,'own-control-state',clone(state))],
  [key+':'+(base+1),doc(base+1,'own-exception-state',{gameId,error:'SG_AG_GAME_BUDGET_EXHAUSTED'})]]);
 const reads=[],store={get:async(c,k)=>{reads.push([c,k]);return clone(c==='state'?saved:docs.get(k)??null);},
  getMany:async(c,keys)=>{reads.push([c,...keys]);return keys.map(k=>clone(docs.get(k)??null));}};
 return {key,cohortRun,commit,saved,docs,doc,store,reads};
}
test('real 356 state plus 357 durable exception resumes at 358 without replacing either proof',async()=>{
 const f=fixture(),before=clone([...f.docs]);
 const create=(n,value)=>{assert(!f.docs.has(f.key+':'+n),'JOURNAL_CONTENT_CONFLICT');f.docs.set(f.key+':'+n,value);};
 assert.throws(()=>create(f.saved.value.sequence+1,{}),/JOURNAL_CONTENT_CONFLICT/);
 const result=await readControlAppendCursor({...f,maxTail:4});
 assert.equal(result.sequence,357);assert.equal(result.retainedExceptionCount,1);assert.equal(result.writes,0);
 assert.deepEqual([...f.docs],before);
 create(result.sequence+1,f.doc(358,'own-control-state',f.saved.value.state));
 assert.deepEqual([...f.docs].slice(0,2),before);assert.equal(f.docs.size,3);
});
for(const config of [{base:356,run:'37526015944:1',gameId:'32733'},
 {base:432,run:'37529554895:1',gameId:'32744'}])test(`production loader retains ${config.base}/${config.base+1} and selects ${config.base+2}`,async()=>{
 const f=fixture(config),before=clone([...f.docs]),pointer=clone(f.saved);
 const loaded=await loadExistingControlState({...f,maxTail:4});
 assert.equal(loaded.sequence,config.base+1);assert.deepEqual(loaded.state,f.saved.value.state);
 assert.deepEqual(f.saved,pointer);assert.deepEqual([...f.docs],before);
 loaded.state.games[0].reason='caller mutation';assert.deepEqual(f.saved,pointer);
 assert(f.reads.filter(row=>row[0]==='journal').every(row=>row.length<=101));
});
test('production loader creates a fresh cursor only if neither state nor first journal exists',async()=>{
 const store={get:async()=>null};assert.deepEqual(await loadExistingControlState({store,key:'rolling-ag-control:'+'a'.repeat(64),cohortRun:'1:1',commit:'b'.repeat(40)}),{state:null,sequence:0});
 store.get=async(c)=>c==='state'?null:{value:{retained:true}};
 await assert.rejects(loadExistingControlState({store,key:'rolling-ag-control:'+'a'.repeat(64),cohortRun:'1:1',commit:'b'.repeat(40)}),/ORPHANED_JOURNAL_RETAINED/);
});
test('no suffix preserves state cursor; missing state journal or exact response corruption blocks',async()=>{
 const f=fixture();f.docs.delete(f.key+':357');assert.equal((await readControlAppendCursor({...f,maxTail:4})).sequence,356);
 f.docs.delete(f.key+':356');await assert.rejects(readControlAppendCursor({...f,maxTail:4}),/FULL_STATE/);
 const g=fixture();g.store.getMany=async()=>[null];await assert.rejects(readControlAppendCursor({...g,maxTail:4}),/EXACT_KEYS/);
});
test('uncommitted state, merge evidence, unrelated exceptions and identity changes stay retained',async()=>{
 for(const mutate of [f=>f.docs.get(f.key+':357').value.file='own-control-state',
  f=>f.docs.get(f.key+':357').value.file='private-control-evidence/merge.json',
  f=>f.docs.get(f.key+':357').value.commit='c'.repeat(40),
  f=>f.docs.get(f.key+':357').version=1,
  f=>f.docs.get(f.key+':357').value.value.extra='not a known exception',
  f=>f.docs.get(f.key+':357').value.value.error='arbitrary message',
  f=>f.docs.get(f.key+':357').value.value.gameId='32744',
  f=>f.saved.value.state.games[0].phase='ready']){
  const f=fixture();mutate(f);await assert.rejects(readControlAppendCursor({...f,maxTail:4}));
 }
});
test('several matched blocked exception journals advance only the append cursor',async()=>{
 const f=fixture();f.docs.set(f.key+':358',f.doc(358,'own-exception-state',{gameId:'32733',error:'SG_AG_GAME_BUDGET_EXHAUSTED'}));
 const loaded=await loadExistingControlState({...f,maxTail:4});assert.equal(loaded.sequence,358);assert.equal(f.saved.value.sequence,356);
});
test('holes, excessive tail and a concurrent pointer change fail closed with no writes',async()=>{
 const f=fixture();f.docs.set(f.key+':359',f.doc(359,'own-exception-state',{gameId:'32733',error:'SG_AG_GAME_BUDGET_EXHAUSTED'}));
 await assert.rejects(readControlAppendCursor({...f,maxTail:4}),/GAP/);
 const g=fixture();g.docs.set(g.key+':358',g.doc(358,'own-exception-state',{gameId:'32733',error:'SG_AG_GAME_BUDGET_EXHAUSTED'}));
 await assert.rejects(readControlAppendCursor({...g,maxTail:1}),/BOUND_EXCEEDED/);
 const h=fixture(),get=h.store.get;h.store.get=async(c,k)=>{const v=await get(c,k);if(c==='state')v.version++;return v;};
 await assert.rejects(readControlAppendCursor({...h,maxTail:4}),/POINTER_CHANGED/);
});
