'use strict';
function createUnavailableAudioABI(){const b32750UnavailableAudioEvents=[];const b32750HTMLAudioUnavailable=function(){this.readyState=0;this.networkState=0;this.paused=true;this.ended=false;this.muted=false;this.volume=1;this.currentTime=0;this.duration=NaN;this.src='';this.oncanplaythrough=null;this.listeners={}};
b32750HTMLAudioUnavailable.prototype.canPlayType=()=>'';
b32750HTMLAudioUnavailable.prototype.addEventListener=function(type,fn){(this.listeners[type]||(this.listeners[type]=[])).push(fn)};
b32750HTMLAudioUnavailable.prototype.removeEventListener=function(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn)};
b32750HTMLAudioUnavailable.prototype.load=function(){this.networkState=3;this.error={code:4};b32750UnavailableAudioEvents.push('unsupported-codec-load');for(var fn of this.listeners.error||[])fn.call(this,{type:'error',target:this})};
b32750HTMLAudioUnavailable.prototype.play=function(){b32750UnavailableAudioEvents.push('unsupported-codec-play');this.paused=true;var e=new Error('No HTML audio decoder in offline Canvas scope');e.name='NotSupportedError';var p=Promise.reject(e);p.catch(()=>{});return p};
b32750HTMLAudioUnavailable.prototype.pause=function(){this.paused=true};
b32750HTMLAudioUnavailable.prototype.cloneNode=function(){return new b32750HTMLAudioUnavailable()};
return {Audio:b32750HTMLAudioUnavailable,events:b32750UnavailableAudioEvents,audioOutputAvailable:false,neverSynthesizesAudioCompletion:true};}
module.exports={createUnavailableAudioABI};
