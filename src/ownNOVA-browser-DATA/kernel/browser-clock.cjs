'use strict';
/* Native browser I/O timers only; this owns no capture jobs or source calls. */
const assert=require('node:assert/strict');
function createNativeBrowserClock(c,{maximumSteps=2400,exceptions=[]}={}){let now=Date.now(),closed=false,steps=0,id=0,peak=0,callbacks=0;const initial=now,active=new Map();
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 c.Date=ClockDate;c.performance.now=()=>now-initial;
 function add(fn,ms,fields={}){assert.equal(typeof fn,'function');const timer={id:++id,fn,due:now+Number(ms),...fields};active.set(timer.id,timer);peak=Math.max(peak,active.size);return timer.id;}
 c.setTimeout=(fn,ms=0)=>add(fn,ms);c.clearTimeout=value=>active.delete(value);c.requestAnimationFrame=fn=>add(fn,1000/60,{frame:true});c.cancelAnimationFrame=c.clearTimeout;c.setInterval=(fn,ms=0)=>add(fn,ms,{repeat:true,interval:Number(ms)});c.clearInterval=c.clearTimeout;
 async function step(ms=1000/60){assert(!closed);steps++;if(maximumSteps!==null)assert(steps<=maximumSteps,'Finite offline browser tick budget exhausted');now+=ms;for(const timer of [...active.values()])if(active.get(timer.id)===timer&&timer.due<=now){if(timer.repeat)timer.due=now+timer.interval;else active.delete(timer.id);try{callbacks++;timer.fn(timer.frame?now-initial:undefined);}catch(error){exceptions.push({name:error.name,message:error.message,stack:error.stack,scope:'uncaught-browser-task-preserved'});}}await new Promise(resolve=>setImmediate(resolve));}
 return {step,close(){closed=true;active.clear();},summary:()=>({browserSteps:steps,activeBrowserTimers:active.size,peakActiveBrowserTimers:peak,timerRegistrations:id,executedBrowserCallbacks:callbacks})};
}
module.exports={createNativeBrowserClock};
