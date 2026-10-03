// Additional free-game awards are supported by default. This checks only
// counters supplied by a reviewed route; it grants no request or source.
export function advanceFreeGameCounters(prior,current,{added,consumed=1,maximum=1000000}={}){
 const need=(ok,code)=>{if(!ok)throw Error('FREE_COUNTER_'+code);};
 const integer=n=>Number.isSafeInteger(n)&&n>=0&&n<=maximum;
 need(Number.isSafeInteger(maximum)&&maximum>0&&maximum<=1000000&&integer(consumed),'LIMIT');
 for(const row of prior===null?[current]:[prior,current])need(row&&['total','remaining','played'].every(k=>integer(row[k]))&&row.total===row.remaining+row.played,'STATE');
 if(prior===null){need(added===undefined||added===0,'INITIAL_AWARD');return{added:0,remaining:current.remaining};}
 const delta=current.total-prior.total;need(integer(delta)&&prior.remaining>=consumed,'AWARD');
 need(added===undefined||integer(added)&&added===delta,'REPORTED_AWARD');
 need(current.remaining===prior.remaining-consumed+delta&&current.played===prior.played+consumed,'PROGRESSION');
 return{added:delta,remaining:current.remaining};
}
