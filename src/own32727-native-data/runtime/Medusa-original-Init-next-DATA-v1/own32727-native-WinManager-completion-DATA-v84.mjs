// The original own WinManager, Payway and BitmapCelebration run their callbacks.
// Drawing shells emit no gameplay callbacks and cannot choose any protocol End.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const read = name => JSON.parse(readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const manager = read('Medusa-own-native-WinManager-DATA-v31/own32727-native-WinManager-private.json');
const dependencies = read('Medusa-own-native-WinManager-dependencies-DATA-v32/own32727-native-WinManager-dependencies-private.json');
const callbacks = read('Medusa-own-native-Win-callbacks-DATA-v33/own32727-native-Win-callbacks-private.json');
const bases = read('Medusa-native-celebration-base-source-v73/own32727-native-celebration-base-private.json');
const bitmap = read('Medusa-own-native-win-completion-dependency-v71/own32727-BitmapCelebration-private.json');
const producer = read('Medusa-own-native-feature-producers-DATA-v2/own32727-native-feature-producers-private.json');

export function createOwn32727NativeWinManagerCompletionDATA84({nativeInitModel:init,nativeSlotGameModel:model,actualDrawingPorts:ports}) {
 init.assertCurrent();
 assert(init.gameId==='32727'&&model.account===init.nativeInitAccount.account);
 assert(typeof ports.TweenMax?.to==='function'&&typeof ports.TimelineMax==='function','The same own native GSAP clock is required');
 const display=(...args)=>ports.recordDisplay(...args);
 function Meter(){ports.NovaContainer.call(this);}
 Meter.prototype=Object.create(ports.NovaContainer.prototype);
 for(const name of ['setValue','snapTo','show','hide'])Meter.prototype[name]=function(...args){display('Bitmap drawing meter '+name,...args);};
 // A meter callback may not be forged by this drawing shell.
 Meter.prototype.rollup=function(){throw Error('Own native meter rollup callback path remains unmapped');};
 const controller={slotGame:model,playSound:(...args)=>ports.recordSound(...args),resetSymbolsAlpha:()=>display('Bitmap resetSymbolsAlpha')};
 const context=createContext({NOVA:{config:init.nativeConfigRecord.config,addToContainer:ports.addToContainer,getSprite:ports.getSprite,getTexture:ports.getTexture,getRenderer:()=>({generateTexture:value=>{display('Bitmap generateTexture');return {drawingOnly:true};}}),isLandscape:()=>true},
  ENUM:{},game:controller,window:{},NovaContainer:ports.NovaContainer,NovaMeter:Meter,
  NovaTextBox:ports.NovaContainer,NovaFancyText:ports.NovaContainer,NovaSprite:ports.NovaContainer,
  TweenMax:ports.TweenMax,TimelineMax:ports.TimelineMax,Back:ports.Back,
  Linear:{easeNone:{}},Expo:{easeOut:{}},Power1:{easeOut:{}},
  SOUND:{getDuration(){throw Error('Own original selected sound duration input remains unmapped');}},
  console:{log:(...args)=>display('originalWinSequence.log',...args),warn(...args){throw Error('Own WinManager warning: '+args.join(' '));}}});
 const compile=source=>runInContext('('+source+')',context,{timeout:1000});
 for(const row of producer.enums)context.ENUM[row.name]=compile(row.source);
 context.CelebrationModule=compile(bases.rows.find(r=>r.name==='CelebrationModule').source);
 context.CelebrationModule.prototype.start=compile(bases.rows.find(r=>r.name==='CelebrationModule-start').source);
 context.BigWinCelebration=compile(bases.rows.find(r=>r.name==='BigWinCelebration').source);
 runInContext(bases.rows.find(r=>r.name==='BigWin-prototype').source+';',context);
 context.BitmapCelebration=compile(bitmap.row.source);
 context.window.BitmapCelebration=context.BitmapCelebration;
 assert(init.nativeConfigRecord.config.game.winLevels.every(level=>!level.celebration||level.celebration==='BitmapCelebration'),'Unmapped own celebration constructor');
 context.CelebrationManager=compile(dependencies.rows.find(r=>r.name==='CelebrationManager').source);
 context.WinShower=compile(dependencies.rows.find(r=>r.name==='WinShower').source);
 context.WinSequencePayway=compile(callbacks.rows.find(r=>r.name==='WinSequencePayway').source);
 context.WinSequence=compile(dependencies.rows.find(r=>r.name==='WinSequence').source);
 for(const row of callbacks.rows.filter(r=>r.name.startsWith('WinSequence.prototype.')))
  context.WinSequence.prototype[row.name.split('.').at(-1)]=compile(row.source);
 assert.equal(init.nativeConfigRecord.config.game.type,context.ENUM.winSequence.PAYWAY,'Own configured native payway type required');
 context.self=model;context.wrapperAPI=()=>{throw Error('Own wrapper event before source-bound native core remains unmapped');};
 model.winManNotify=compile(callbacks.rows.find(r=>r.name==='this.winManNotify').source);
 const NativeManager=compile(manager.source);
 const native=Reflect.construct(NativeManager,[model.reelManager,model.messageBar,
  (...args)=>{init.assertCurrent();assert(typeof model.winManNotify==='function','Original native winManNotify must be bound');return model.winManNotify(...args);},
  model.account,init.nativeConfigRecord.config.game,init.nativeConfigRecord.config.lines]);
 native.init();
 return native;
}
