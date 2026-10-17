// Own native Reel/Slot/Manager model and GSAP. Ports cover drawing and audio only.
// Component scope: no provider dispatch, protocol End selector, or whole-round claim.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createOwn32727NativeMotionClockReelIdentityDATA4} from './own32727-native-motion-clock-reel-identity-DATA-v4.mjs';
const read=n=>JSON.parse(readFileSync(new URL('../'+n,import.meta.url),'utf8'));
const data=read('Medusa-own-native-Reel-execution-DATA-v4/own32727-native-Reel-execution-private.json');
const extra=read('Medusa-own-native-Reel-execution-DATA-v5/own32727-native-Reel-additional-private.json');
const notify=read('Medusa-own-native-Reel-completion-callback-DATA-v3/own32727-native-Reel-notify-private.json');
const modelCallbacks=read('Medusa-own-native-Reel-completion-callback-DATA-v3/own32727-native-Manager-and-model-inline-private.json');
const handlers=read('Medusa-own-native-Reel-completion-callback-DATA-v3/own32727-native-game-reel-handler-and-resets-private.json');
const gateInitializer=read('Medusa-own-native-Reel-completion-callback-DATA-v3/own32727-reel-gate-initializer-private.json');
const producer=read('Medusa-own-native-feature-producers-DATA-v2/own32727-native-feature-producers-private.json');
const motion=read('Medusa-own-native-motion-and-clock-DATA-v2/own32727-native-motion-and-clock-private.json');
export function createOwn32727NativeReelCompletionDATA18({nativeInitModel:init,nativeReelstripData:stripData,nativeSlotGameModel:model,actualDrawingPorts:ports,assertCurrent,maxTicks,maxCallbacks}){
 assert(init.gameId==='32727'&&stripData.gameId==='32727'&&stripData.originalSessionScope===init.originalSessionScope,'Same own Init/Reelstrip scope required');
 assert(model.account===init.nativeInitAccount.account&&typeof model.fireEvent==='function'&&typeof model.api_notify==='function'&&typeof model.getCurrentState==='function');
 assert(typeof assertCurrent==='function'&&typeof ports.NovaContainer==='function'&&typeof ports.NovaGraphics==='function'&&typeof ports.recordDisplay==='function');
 let closed=false;const events=[],containers=new Map();
 const current=()=>{assert(!closed,'Own Reel completion DATA closed');init.assertCurrent();stripData.assertCurrent();assertCurrent();};
 const clock=createOwn32727NativeMotionClockReelIdentityDATA4({maxTicks,maxCallbacks,assertCurrent:current});
 const BaseDisplay=ports.NovaContainer;
 function Display(){BaseDisplay.call(this);this.position={set:(x,y)=>{this.x=x;this.y=y;}};}
 Display.prototype=Object.create(BaseDisplay.prototype);
 Display.prototype.addChildAt=function(value,index){this.children.splice(index,0,value);value.parent=this;return value;};
 Display.prototype.stopAnimation_api=function(...args){ports.recordDisplay('symbol drawing stopAnimation_api',...args);};
 // Renderer object operations do not decide any protocol state, symbol options, or ACK.
 Display.prototype.on??=function(){return this;};
 Display.prototype.setPosition??=function(p){this.x=p.x;this.y=p.y;};
 const nova={config:init.nativeConfigRecord.config,isWebGL:false,isSD:ports.isSD,getSprite(...args){const sprite=ports.getSprite(...args);sprite.position??={set:(x,y)=>{sprite.x=x;sprite.y=y;}};return sprite;},
  addContainer(name,parent){const value=new Display();parent.addChild(value);containers.set(name,value);},
  getContainer(name){assert(containers.has(name));return containers.get(name);},
  addToContainer(name,value){assert(containers.has(name));containers.get(name).addChild(value);},
  addToZContainer(name,value,index){assert(containers.has(name));return containers.get(name).addChildAt(value,index);},removeFromContainer(name,value){assert(containers.has(name));return containers.get(name).removeChild(value);},addToStage:value=>ports.recordDisplay('addToStage',value)};
 const env={NOVA:nova,ENUM:{},NovaDisplayObject:Display,NovaContainer:Display,NovaGraphics:ports.NovaGraphics,TweenMax:clock.nativeTweenMax,
  SOUND:{play:(...args)=>{current();ports.recordSound(...args);if(args[0]!=='windup')return;assert(ports.nativeSoundManager&&typeof ports.nativeSoundManager.play==='function','Own native SoundManager must be bound before Reel sound');const handler=ports.nativeSoundManager.play(...args);if(args[0]==='windup'){assert(handler&&Number.isFinite(handler.duration)&&handler.duration>0,'Native SRS requires an actual own sound duration');ports.recordDisplay('native SRS actual sound duration',handler.duration);}return handler;}},
  setDisplayObjectDepth:(...args)=>ports.recordDisplay('setDisplayObjectDepth',...args),
  generateShadedSymbolTextures:(...args)=>ports.recordDisplay('generateShadedSymbolTextures',...args),
  NovaFilters:{ColorMatrixFilter:function(){}},console:{warn(...args){throw Error('Own native Reel model warning: '+args.join(' '));}}};
 const realm=createContext(env),compile=source=>runInContext('('+source+')',realm,{timeout:1000});
 for(const r of [...data.enums,...motion.enums])env.ENUM[r.name]=compile(r.source);
 for(const r of extra.rows.filter(r=>r.kind==='enum'))env.ENUM[r.selector]=compile(r.source);
 const types={};for(const r of data.rows.filter(r=>r.kind==='ctor')){types[r.selector]=compile(r.source);env[r.selector]=types[r.selector];}
 for(const C of Object.values(types))C.prototype=Object.create(Display.prototype);
 for(const r of [...data.rows,...extra.rows].filter(r=>r.selector?.includes('.prototype.'))){const [owner,name]=r.selector.split('.prototype.');types[owner].prototype[name]=compile(r.source);}
 for(const r of read('Medusa-paid-reel-state-continuation-v28/own32727-paid-reel-state-selected-private.json').rows.filter(r=>r.selector.startsWith('ReelManager.prototype.'))){const name=r.selector.split('.prototype.')[1];types.ReelManager.prototype[name]=compile(r.source);}for(const r of read('Medusa-paid-reel-dependent-methods-v29/own32727-native-paid-reel-callees-private.json').rows)types[r.owner].prototype[r.name]=compile(r.source);types.ReelManager.prototype.getSymbolID=compile(read('Medusa-cascade-symbol-identity-v65/own-ReelManager-getSymbolID.json').source);types.NovaReel.prototype.getSymbolID=compile(read('Medusa-cascade-native-slot-identity-v66/own-NovaReel-getSymbolID.json').source);types.NovaReel.prototype.notifyReelCallback=compile(notify.source);types.NovaReel.prototype.setNumVisibleSymbols=compile(read('Medusa-own-native-Reel-execution-DATA-v5/own32727-native-Reel-setNumVisibleSymbols-private.json').source);
 for(const r of [...read('Medusa-native-WinManager-reel-callees-v74/own32727-native-WinManager-reel-callees-private.json').rows,...read('Medusa-native-WinManager-reel-transitive-v76/own32727-native-WinManager-reel-transitive-private.json').rows])types[r.owner].prototype[r.name]=compile(r.source);
 for(const r of read('Medusa-native-WinManager-slot-transitive-v80/own32727-native-WinManager-slot-transitive-private.json').rows)types[r.owner].prototype[r.name]=compile(r.source);
 // The real ModuleFactory assigns native options/id/name; builders allocate drawing shells.
 function createDrawingSymbol(){const symbol=Reflect.construct(types.SymbolModule,[]);assert(symbol.children[0],'Own native SymbolModule display container required');symbol.children[0].addChild(new Display());return symbol;}
 for(const name of [...new Set(types.ModuleFactory.toString().match(/build[A-Za-z0-9]+Symbol[A-Za-z0-9]*/g))])env[name]=createDrawingSymbol;
 // This own type39 leaf changes visual targets only. Its tween callbacks never feed game state.
 const growSource=read('Medusa-own-playGrow-display-leaf-v64/native-playGrow-display-only-source.json');
 env.buildMegawaysFrameAnimatedLayeredDynamicSymbol=()=>{
  const symbol=createDrawingSymbol();
  const realm=createContext({fadeMC:{visible:false,alpha:0},frames:{},myMC:{},ghostContainer:{visible:false,alpha:0},TweenMax:{
   to:(target,seconds,options)=>ports.recordDisplay('original-playGrow-to',{seconds}),
   from:(target,seconds,options)=>ports.recordDisplay('original-playGrow-from',{seconds})
  }});
  symbol.playGrow=runInContext('('+growSource.playGrow+')',realm,{timeout:1000});
  symbol.stopGrow=runInContext('('+growSource.stopGrow+')',realm,{timeout:1000});
  return symbol;
 };
 env.SymbolEffectsLayerManager=compile(read('Medusa-native-effect-manager-source-v82/own32727-native-effect-manager-private.json').source);
 env.NovaReelMotion=function(reel,cfg){return clock.createMotion(reel,cfg,{initialize:false,retainReelIdentity:true});};
 env.NovaReelMotionNudge=compile(read('Medusa-own-native-Reel-execution-DATA-v5/own32727-native-Nudge-ctor-private.json').source);
 // These lexical names mirror the original model callback scope. No amount is defaulted.
 Object.assign(env,{self:model,quickStopFired:false,lastWin:undefined});
 const allStopped=compile(modelCallbacks.rows.find(r=>r.selector==='this.allReelsStopped').source);
 const priorAllStopped=model.allReelsStopped;model.allReelsStopped=function(...args){current();return Reflect.apply(allStopped,this,args);};
 env.EventGate=compile(producer.rows.find(r=>r.name==='EventGate').source);
 runInContext('var '+gateInitializer.source+';',realm);
 const nativeNotify=compile(handlers.rows.find(r=>r.selector==='this.reelManNotify').source);
 const callback=function(...args){current();events.push(args);return Reflect.apply(nativeNotify,this,args);};
 const manager=Reflect.construct(types.ReelManager,[callback,'']);
 manager.createOverlapEffectsMask=(...args)=>ports.recordDisplay('createOverlapEffectsMask',...args);
 manager.generateSlotMap=(...args)=>ports.recordDisplay('generateSlotMap',...args);
 const factory=Reflect.construct(types.ModuleFactory,[]);try{manager.init(factory,nova.config.game);}catch(error){clock.close();model.allReelsStopped=priorAllStopped;closed=true;throw error;}
 assert(manager.reelsArray.length===nova.config.game.reels.reels&&manager.reelCfg.enableSRS===true,'Actual configured own reels/SRS required');
 assert(stripData.nativeReelstripSets.length>0);manager.reelStrips=stripData.nativeReelstripSets;manager.setReelstrips(0);manager.setStops=compile(read('Medusa-own-native-Reel-execution-DATA-v5/own32727-native-initial-setStops-private.json').source);assert(Array.isArray(nova.config.game.defaultStops));manager.setStops(nova.config.game.defaultStops);
 assert(manager.reelsArray.every(r=>r.motion.reelReference===r&&Array.isArray(r.reelStrip)&&r.slots.length===r.totalSlots),'Original native Reel identity or strip lost');
 let started=false,stopped=false;
 function close(){if(closed)return;closed=true;clock.close();model.allReelsStopped=priorAllStopped;}
 return Object.freeze({
  nativeManager:manager,nativeTweenMax:clock.nativeTweenMax,nativeTimelineMax:clock.nativeTimelineMax,nativeDate:clock.nativeDate,
  start(){try{current();assert(!started);started=true;manager.startSpin();}catch(e){close();throw e;}},
  stopFromCurrentResponse(response){try{current();assert(started&&!stopped&&model.serverResponse===response&&response.stops.length===manager.reelsArray.length,'Current own response stops required');stopped=true;manager.setNumVisibleSymbols(response.gsd.fieldValues.DPR);manager.stopReels(response.stops);}catch(e){close();throw e;}},
  step(ms){try{current();clock.step(ms);}catch(e){close();throw e;}},
  snapshot(){current();return Object.freeze({nativeEvents:events.slice(),reels:manager.reelsArray.map(r=>({id:r.id,isStopped:r.isStopped,motionState:r.motion.state,reelSymbolPass:r.reelSymbolPass})),SRSConfigured:manager.reelCfg.enableSRS,SRSSelected:manager.srsTriggered,clock:clock.snapshot(),wholeNextEndReady:false,sourceRequests:0,DBAccess:0});},close
 });
}
