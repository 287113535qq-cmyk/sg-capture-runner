// Collector independently checks cumulative awards and consumed free games.
const assert=require('node:assert/strict');
function advanceFreeGameCounters(prior,current,options={}){
 const limit=options.maximum??1000000,consumed=options.consumed??1,added=options.added;
 const valid=n=>Number.isSafeInteger(n)&&n>=0&&n<=limit;
 assert(Number.isSafeInteger(limit)&&limit>0&&limit<=1000000&&valid(consumed),'FREE_COUNTER_LIMIT');
 for(const row of prior===null?[current]:[prior,current])assert(row&&valid(row.total)&&valid(row.remaining)&&valid(row.played)&&row.total===row.remaining+row.played,'FREE_COUNTER_STATE');
 if(prior===null){assert(added===undefined||added===0,'FREE_COUNTER_INITIAL_AWARD');return{added:0,remaining:current.remaining};}
 const award=current.total-prior.total;
 assert(valid(award)&&prior.remaining>=consumed,'FREE_COUNTER_AWARD');
 if(added!==undefined)assert(valid(added)&&award===added,'FREE_COUNTER_REPORTED_AWARD');
 assert(current.played-prior.played===consumed&&current.remaining-prior.remaining===award-consumed,'FREE_COUNTER_PROGRESSION');
 return{added:award,remaining:current.remaining};
}
module.exports={advanceFreeGameCounters};
