// Read-only cursor recovery for a known blocked-game exception suffix.
// This never overwrites journals, repairs a pointer, replays a game, or treats
// an uncommitted state/merge journal as safe to skip.
import assert from 'node:assert/strict';
import {stable} from '../mongo-writer.mjs';
export async function loadExistingControlState({store,key,cohortRun,commit,maxTail=128}){
  const saved=await store.get('state',key);
  if(!saved){
    assert(!await store.get('journal',key+':1'),'SG_AG_CONTROL_ORPHANED_JOURNAL_RETAINED');
    return {state:null,sequence:0};
  }
  const cursor=await readControlAppendCursor({store,key,saved,cohortRun,commit,maxTail});
  return {state:structuredClone(saved.value.state),sequence:cursor.sequence};
}
export async function readControlAppendCursor({store,key,saved,cohortRun,commit,maxTail=128}) {
  assert(/^rolling-ag-control:[a-f0-9]{64}$/.test(key)&&/^\d+:1$/.test(cohortRun)&&/^[a-f0-9]{40}$/.test(commit),
    'SG_AG_CONTROL_CURSOR_IDENTITY');
  assert(Number.isSafeInteger(maxTail)&&maxTail>=1&&maxTail<=1000,'SG_AG_CONTROL_CURSOR_BOUND');
  const value=saved?.value,base=value?.sequence;
  assert(saved?._id==='primary/'+key&&Number.isSafeInteger(saved.version)&&saved.version>=0
    &&value?.cohortRun===cohortRun&&value.commit===commit&&Number.isSafeInteger(base)&&base>0
    &&value.journal===key+':'+base&&Array.isArray(value.state?.games),'SG_AG_CONTROL_CURSOR_POINTER');
  const stateJournal=await store.get('journal',value.journal);
  assert(stateJournal?._id==='primary/'+value.journal&&stateJournal.version===0&&stateJournal.value?.file==='own-control-state'
    &&stateJournal.value.cohortRun===cohortRun&&stateJournal.value.commit===commit
    &&stable(stateJournal.value.value)===stable(value.state),'SG_AG_CONTROL_CURSOR_FULL_STATE');
  const ids=Array.from({length:maxTail+1},(_,i)=>key+':'+(base+i+1)),rows=[];
  for(let offset=0;offset<ids.length;offset+=100){
    const keys=ids.slice(offset,offset+100),batch=await store.getMany('journal',keys);
    assert(Array.isArray(batch)&&batch.length===keys.length&&batch.every((row,i)=>row===null||row?._id==='primary/'+keys[i]),
      'SG_AG_CONTROL_CURSOR_EXACT_KEYS');
    rows.push(...batch);
  }
  let cursor=base,ended=false;
  for(const row of rows){
    if(row===null){ended=true;continue;}
    assert(!ended,'SG_AG_CONTROL_CURSOR_GAP');
    assert(cursor-base<maxTail,'SG_AG_CONTROL_CURSOR_BOUND_EXCEEDED');
    const receipt=row.value;
    assert(row.version===0&&receipt&&Object.keys(receipt).sort().join(',')==='cohortRun,commit,file,value'
      &&receipt.cohortRun===cohortRun&&receipt.commit===commit,'SG_AG_CONTROL_CURSOR_JOURNAL_IDENTITY');
    // A durable new state/evidence with a lagging pointer may represent an
    // interrupted write. Keep it isolated rather than silently applying it.
    assert(receipt.file==='own-exception-state','SG_AG_CONTROL_UNCOMMITTED_JOURNAL_RETAINED');
    const exception=receipt.value;
    assert(exception&&Object.keys(exception).sort().join(',')==='error,gameId'
      &&/^SG_[A-Z0-9_]+$/.test(exception.error),'SG_AG_CONTROL_CURSOR_EXCEPTION');
    const game=value.state.games.find(g=>g.gameId===exception.gameId);
    assert(game?.phase==='blocked'&&game.reason===exception.error,'SG_AG_CONTROL_EXCEPTION_STATE_NOT_DURABLE');
    cursor++;
  }
  const fresh=await store.get('state',key);
  assert(stable(fresh)===stable(saved),'SG_AG_CONTROL_CURSOR_POINTER_CHANGED');
  return {sequence:cursor,retainedExceptionCount:cursor-base,stateSequence:base,sourceRequests:0,writes:0};
}
