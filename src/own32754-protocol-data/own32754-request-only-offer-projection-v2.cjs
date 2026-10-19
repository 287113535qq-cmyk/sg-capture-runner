'use strict';
// Request-affecting offer state only: no animation/controller/event/callback objects.
function createOwn32754OfferProjection({nativeInitAwards,typedExcalibur,sourceEntry,normalRoutePolicy}){
 const hold=m=>{throw Error('Arthur32754 offer hold: '+m)};
 if(normalRoutePolicy!=='original-private-no-history-no-recovery')hold('normal protocol scope; history n$ remains off');
 if(!Array.isArray(nativeInitAwards)||nativeInitAwards.length<1||!typedExcalibur)hold('actual native Init PB.Wn and current typed QB');
 const enabled=new Array(nativeInitAwards.length+1).fill(true);let A7=false,T9=0,info=typedExcalibur;
 const top=()=>{for(let i=enabled.length-1;i>=0;i--)if(enabled[i])return i;hold('no enabled native offer');};
 function selectNativeIndex(index){if(!Number.isInteger(index)||index<0||index>=nativeInitAwards.length)hold('actual source offer index within current Init ladder');T9=index+1;if(T9===top())A7=true;}
 function nativeH(){if(top()===T9){A7=true;return;}enabled[top()]=false;if(top()===T9)A7=true;}
 if(sourceEntry==='fresh-Wheel'){
  // Source M4a executes three reveals only when 0>=f1. Otherwise a newly created Df retains its source constructor T9=usa(-1+1), the placeholder. Pe is unchanged.
  if(0>=info.e_a)selectNativeIndex(info.index);
 }else if(sourceEntry==='restore'){
  if(!Number.isInteger(info.e_a)||info.e_a<=0)hold('source factory restore requires actual positive picks');
  selectNativeIndex(info.index);
  const n=info.e_a-(info.JG?1:0);
  // c2a compares usa(index), whereas s_(index) selected usa(index+1). Preserve that difference.
  for(let i=0;i<n;i++){if(top()===info.index)break;enabled[top()]=false;}
 }else hold('actual source entry kind');
 // M4a applies h$ once unless A7 was already true; animation durations do not change its state result.
 if(!A7)nativeH();
 function currentPolicy(){return Object.freeze({kind:info.JG?'collect-already-accepted':A7?'forced-collect':'explicit-choice',qza:A7,pickAccepted:info.JG,shouldAccept:info.mza,normalReplayPath:false,nativeOfferIndex:info.index,selectedItem:T9,highestEnabledItem:top(),enabledItems:Object.freeze(enabled.map((v,i)=>v?i:null).filter(v=>v!==null)),actualProviderRequest:false});}
 function afterActualGamble(nextQB){if(!nextQB)hold('actual new typed QB');if(currentPolicy().kind!=='explicit-choice')hold('Gamble forbidden by actual accepted/forced policy');selectNativeIndex(nextQB.index);nativeH();info=nextQB;return currentPolicy();}
 return Object.freeze({currentPolicy,afterActualGamble});
}
module.exports={createOwn32754OfferProjection};
