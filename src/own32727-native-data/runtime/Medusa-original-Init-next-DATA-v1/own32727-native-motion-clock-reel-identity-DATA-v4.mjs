// Own bundled GSAP + Modifiers and own NovaReelMotion. No image/font/network bootstrap.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext,Script} from 'node:vm';
const data=JSON.parse(readFileSync(new URL('../Medusa-own-native-motion-and-clock-DATA-v2/own32727-native-motion-and-clock-private.json',import.meta.url),'utf8'));
export function createOwn32727NativeMotionClockReelIdentityDATA4({maxTicks,maxCallbacks,assertCurrent}){
 assert(Number.isSafeInteger(maxTicks)&&maxTicks>0&&Number.isSafeInteger(maxCallbacks)&&maxCallbacks>0&&typeof assertCurrent==='function');
 let elapsed=0,closed=false,ticks=0,callbacks=0,serial=0;const timers=new Map(),motions=new Set();
 const epoch=Date.now();function DrawingDate(...args){return new Date(...(args.length?args:[epoch+elapsed]));}DrawingDate.now=()=>epoch+elapsed;DrawingDate.parse=Date.parse;DrawingDate.UTC=Date.UTC;DrawingDate.prototype=Date.prototype;
 const context={Date:DrawingDate,performance:{now:()=>elapsed},console:{log(){},warn(){},error(){}},navigator:{userAgent:'own32727-native-source-clock'},document:{visibilityState:'visible',createElement(){return{style:{},getContext(){return{};},appendChild(){},removeChild(){}};},addEventListener(){},removeEventListener(){}},
  setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},setInterval(fn,delay){const id=++serial;timers.set(id,{fn,delay});return id;},clearInterval(id){timers.delete(id);},ENUM:{}};
 context.window=context.self=context.global=context;
 const realm=createContext(context);
 new Script(data.clock.moduleDeclarationPrefix+data.clock.source,{filename:'own32727-retained-bundled-GSAP.js'}).runInContext(realm,{timeout:5000});
 new Script(data.clock.pluginSource+data.clock.pluginStatementSuffix,{filename:'own32727-retained-ModifiersPlugin.js'}).runInContext(realm,{timeout:5000});
 assert(typeof context.TweenMax==='function'&&typeof context.TweenLite==='function'&&context.TweenMax!==context.TweenLite,'Own source GSAP absent');
 for(const row of data.enums)context.ENUM[row.name]=runInContext('('+row.source+')',realm,{timeout:1000});
 const Motion=runInContext('('+data.ctor.source+')',realm,{timeout:1000});
 for(const row of data.rows)Motion.prototype[row.name]=runInContext('('+row.source+')',realm,{timeout:1000});
 const current=()=>{assert(!closed,'Own native motion clock closed');assertCurrent();};
 function close(){if(closed)return;closed=true;try{context.TweenMax.killAll(false,true,true,true);}finally{context.TweenLite.ticker.sleep();timers.clear();motions.clear();}}
 return Object.freeze({
  createMotion(reel,motionConfig,{initialize=true,retainReelIdentity=false}={}){current();assert(reel&&Array.isArray(reel.slots)&&typeof reel.notifyReelCallback==='function'&&motionConfig,'Actual native reel/model input required');
   const owned=retainReelIdentity?reel:Object.create(reel);owned.slots=reel.slots;owned.reel=reel.reel;
   const originalNotify=reel.notifyReelCallback;owned.notifyReelCallback=function(...args){current();assert(++callbacks<=maxCallbacks,'Own native motion callback bound reached');return Reflect.apply(originalNotify,this,args);};
   const motion=Reflect.construct(Motion,[owned,motionConfig]);if(initialize)motion.init();motions.add(motion);return motion;
  },
  step(ms){try{current();assert(Number.isSafeInteger(ms)&&ms>0&&ms<=1000,'Own native clock finite step required');assert(++ticks<=maxTicks,'Own native motion tick bound reached');elapsed+=ms;context.TweenLite.ticker.tick();}catch(error){close();throw error;}},
  snapshot(){current();return Object.freeze({elapsedMs:elapsed,ticks,nativeCallbacks:callbacks,motions:motions.size,GSAPVersion:context.TweenMax.version,ModifiersVersion:context.com?.greensock?.plugins?.ModifiersPlugin?.version,assetLoads:0,sourceRequests:0,wholeNextEndReady:false});},
  nativeDate:DrawingDate,nativeTweenMax:context.TweenMax,nativeTimelineMax:context.TimelineMax,close,sourceRequests:0,assetLoads:0,productionAdmission:false
 });
}
