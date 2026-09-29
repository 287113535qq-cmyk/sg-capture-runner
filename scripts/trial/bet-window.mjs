import assert from 'node:assert/strict';

/** Offline grouping of a validated chronological, single-session stream.
 * Does not issue requests or authorize the next BET. Callers provide reviewed
 * protocol evidence; unknown terminal state never seals a round.
 */
export function groupBetWindows(frames,{validateFrame,sessionOf,isOrdinaryBet,terminal}={}){
  assert(Array.isArray(frames),'INVALID_FRAME_STREAM');
  for(const fn of [validateFrame,sessionOf,isOrdinaryBet,terminal])assert.equal(typeof fn,'function','REVIEWED_BOUNDARY_CALLBACKS_REQUIRED');
  const rounds=[];let pending=[],session=null;
  const complete=(nextBetIndex)=>{
    assert(terminal(pending)===true,'PREVIOUS_ROUND_NOT_SETTLED');
    rounds.push({steps:pending,boundary:nextBetIndex===null?'explicit-terminal':'next-successful-bet',nextBetIndex});
    pending=[];
  };
  frames.forEach((frame,index)=>{
    assert(validateFrame(frame)===true,'UNVALIDATED_FRAME');
    const current=sessionOf(frame);assert(typeof current==='string'&&current.length>0,'SESSION_REQUIRED');
    assert(session===null||session===current,'MIXED_SESSION_STREAM');session=current;
    const bet=isOrdinaryBet(frame);assert(typeof bet==='boolean','BET_CLASSIFICATION_REQUIRED');
    if(bet){if(pending.length)complete(index);}
    else assert(pending.length>0,'ORPHAN_CONTINUATION');
    pending.push(frame);
  });
  if(pending.length&&terminal(pending)===true)complete(null);
  return {rounds,pending};
}
