// Own native pre-audio-load timing branch, using actual own HD sprite metadata.
// Audio end/load/stop callbacks are never synthesized by these DATA bindings.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInContext} from 'node:vm';
const read=name=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const source=read('Medusa-native-sound-core-source-v112/own32727-native-sound-core-private.json');
const manager=read('Medusa-native-sound-manager-duration-source-v111/SoundManager-selected-only-private.json');
const gameSound=read('Medusa-native-GameSound-source-v113/own32727-native-GameSound-private.json');
const short=read('Medusa-native-short-celebration-and-sound-source-v110/own32727-native-short-celebration-and-sound-private.json');
const bases=read('Medusa-native-celebration-base-source-v73/own32727-native-celebration-base-private.json');
const manifest=read('Medusa-own-HD-sound-manifest-v109-GET-once/manifest-private.json');
export function installOwn32727NativeHDSoundAndShortCelebrationDATA123({context,compile,nativeInitModel:init,model,controller,ports}){
 init.assertCurrent();assert(init.gameId==='32727');
 assert(context.NOVA.config===init.nativeConfigRecord.config&&context.NOVA.isHD(),'The actual own HD sound-map scope is required');
 assert(manifest.sprite&&manifest.src&&typeof ports.TimelineMax==='function');
 context.LOG={debug:(...args)=>ports.recordDisplay('native sound log',...args)};
 const Sound=compile(source.source),sound=Reflect.construct(Sound,[]);
 sound.loadConfig(manifest);
 assert.equal(sound.isInitialized(),false,'No fabricated Howl or audio-loaded event');
 // Native Sound has a general missing-sprite duration fallback. It is not
 // allowed to supply an unobserved timing input to a gameplay callback.
 for(const name of ['playSound','loopSound','getSoundDuration','getFullSoundDuration']){
  const original=sound[name];assert.equal(typeof original,'function');
  sound[name]=function(sprite,...args){init.assertCurrent();if(sound.hasSound(sprite))assert(typeof sprite==='string'&&Object.hasOwn(manifest.sprite,sprite)&&Array.isArray(manifest.sprite[sprite])&&Number.isFinite(manifest.sprite[sprite][1])&&manifest.sprite[sprite][1]>0,'Own actually loaded sound sprite timing is required');else ports.recordDisplay('native absent sound branch',name,typeof sprite);return Reflect.apply(original,this,[sprite,...args]);};
 }
 context.NOVA.sound=sound;
 const Manager=compile(manager.source),nativeManager=Reflect.construct(Manager,[]);
 nativeManager.init(context.NOVA.config.sounds.hd,context.NOVA.config.soundsGroup);
 context.SOUND=nativeManager;ports.nativeSoundManager=nativeManager;
 const GameSound=compile(gameSound.source),nativeGameSound=Reflect.construct(GameSound,[model]);
 context.gameSound=nativeGameSound;ports.gameSound=nativeGameSound;
 nativeGameSound.init();
 // Only these two native game methods return timing consumed by celebration.
 for(const name of ['playShortWin','playDiamondShower']){const original=nativeGameSound[name];nativeGameSound[name]=function(...args){const duration=Reflect.apply(original,this,args);assert(Number.isFinite(duration)&&duration>0,'Native celebration requires actual own non-default sound duration');ports.recordDisplay('native celebration sound duration',name,duration);return duration;};}
 function Meter(){ports.NovaContainer.call(this);}
 Meter.prototype=Object.create(ports.NovaContainer.prototype);
 // ShortCelebration's original meterNotify has empty rollup branches, and its
 // meter has no callback argument. The original GSAP timeline owns completion.
 for(const name of ['setValue','snapTo','kill','rollup'])Meter.prototype[name]=function(...args){ports.recordDisplay('short drawing meter '+name,...args);};
 function Button(){ports.NovaContainer.call(this);}
 Button.prototype=Object.create(ports.NovaContainer.prototype);
 Button.prototype.setPosition=function(point){this.x=point.x;this.y=point.y;};
 Button.prototype.enable=function(value){this.enabled=value;};
 Object.assign(context,{NovaMeter:Meter,NovaButton:Button,Linear:{easeNone:{}},TimelineMax:ports.TimelineMax});
 context.CelebrationModule=compile(bases.rows.find(r=>r.name==='CelebrationModule').source);
 context.CelebrationModule.prototype.start=compile(bases.rows.find(r=>r.name==='CelebrationModule-start').source);
 context.ShortCelebration=compile(short.rows.find(r=>r.name==='ShortCelebration').source);
 runInContext(readFileSync(new URL('../Medusa-native-sound-core-source-v112/Short-prototype-private.js',import.meta.url),'utf8')+';',context);
 controller.fadeAmbient=value=>ports.recordDisplay('short drawing fadeAmbient',value);
 context.shortwinCelebration=Reflect.construct(context.ShortCelebration,[]);
 context.shortwinCelebration.init(model.api_notify);
 return Object.freeze({nativeSound:sound,nativeSoundManager:nativeManager,nativeGameSound,nativeShortCelebration:context.shortwinCelebration,sourceRequests:0,DBAccess:0,audioCallbacksSynthesized:false,wholeNextEndReady:false});
}
