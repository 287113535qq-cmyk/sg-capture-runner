'use strict';
const {performance}=require('node:perf_hooks');
// Local browser-I/O execution policy only. Not an AG paid-round/task grant.
function createOwn32750LocalNativeIO({timeoutMs,now=()=>performance.now()}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000||typeof now!=='function')throw Error('OWN32750_LOCAL_IO_ORIGINAL_SG_TIMEOUT_REQUIRED');
 const callbacksPerDrain=128; // Existing V11 drain batch size, now per invocation only.
 return Object.freeze({
  callbacksPerDrain,
  begin(stage){
   const started=now();if(!Number.isFinite(started))throw Error('OWN32750_LOCAL_IO_MONOTONIC_CLOCK');
   let last=started,ticks=0,callbacks=0;
   function checkpoint(){const current=now();if(!Number.isFinite(current)||current<last)throw Error('OWN32750_LOCAL_IO_MONOTONIC_CLOCK');last=current;if(current-started>=timeoutMs)throw Error('OWN32750_LOCAL_NATIVE_WAIT_TIMEOUT_'+stage)}
   return Object.freeze({
    checkpoint,
    accountDrain(executed){if(!Number.isSafeInteger(executed)||executed<0||executed>callbacksPerDrain)throw Error('OWN32750_LOCAL_DRAIN_BATCH_BOUND');callbacks+=executed;checkpoint()},
    accountTick(){ticks++;checkpoint()},
    summary:()=>({stage,timeoutMs,ticks,callbacks,elapsedMs:last-started,scope:'one-native-wait-only',notAGTaskGrant:true})
   });
  }
 });
}
module.exports={createOwn32750LocalNativeIO};
