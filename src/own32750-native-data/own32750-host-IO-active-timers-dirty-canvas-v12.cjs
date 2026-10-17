'use strict';
// Own WMS browser I/O only. A's certified active Map algorithm; original 25ms/GSAP order retained.
function createOwn32750HostIO({clock,errors}){
 const active=new Map(),dirty=new Set(),drawing=new Set(['clearRect','fillRect','strokeRect','fill','stroke','fillText','strokeText','drawImage','drawCanvas','putImageData','reset']);
 let id=0,peak=0,callbacks=0,flushes=0,flushPasses=0;
 function setTimeout(fn,delay){if(typeof fn!=='function')throw Error('OWN32750_TIMER_CALLBACK_REQUIRED');const timer={id:++id,fn,due:clock.elapsedMs+(Number(delay)||0)};active.set(timer.id,timer);peak=Math.max(peak,active.size);return timer.id}
 function clearTimeout(value){active.delete(value)}
 function trackCanvas(cpu,context){
  if(typeof cpu.data!=='function')throw Error('OWN32750_REAL_CANVAS_PRESENTATION_REQUIRED');
  const ref=new WeakRef(cpu);
  for(const name of drawing){const value=context[name];if(typeof value!=='function')continue;context[name]=function(...args){const result=Reflect.apply(value,context,args);dirty.add(ref);return result}}
  return context;
 }
 function flushDirty(){flushPasses++;for(const ref of dirty){const cpu=ref.deref();if(!cpu){dirty.delete(ref);continue}cpu.data();dirty.delete(ref);flushes++}}
 function tick(ticker){
  clock.elapsedMs+=25;clock.ticks++;ticker.tick();
  for(const timer of [...active.values()])if(active.get(timer.id)===timer&&timer.due<=clock.elapsedMs){active.delete(timer.id);try{callbacks++;timer.fn()}catch(error){errors.push({phase:'uncaught-native-timer-task-preserved',name:error?.name||'Error',message:String(error?.message||error),stack:String(error?.stack||error)})}}
  if(clock.ticks%20===0)flushDirty();
 }
 return{setTimeout,clearTimeout,trackCanvas,tick,flushDirty,readActiveTimers:()=>Array.from(active.values(),t=>({...t,cancelled:false})),summary:()=>({timerRegistrations:id,activeTimers:active.size,peakActiveTimers:peak,executedTimerCallbacks:callbacks,retainedHistoricalTimerRecords:0,dirtyCanvasSurfaces:dirty.size,nativePresentationFlushes:flushes,presentationPasses:flushPasses,presentationEveryNativeTicks:20,nativeTickMilliseconds:25})};
}
module.exports={createOwn32750HostIO};
