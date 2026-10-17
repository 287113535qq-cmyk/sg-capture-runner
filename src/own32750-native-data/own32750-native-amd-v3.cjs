'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function createOwn32750Native(options){
  if(!options||!options.root||!options.DOM) throw Error('OWN32750_ROOT_AND_DOM_REQUIRED');
  const root=options.root.replace(/\\/g,'/').replace(/\/$/,'');
  const hbDOM=options.DOM;
  const createHTML=(function(){var doc=new hbDOM.DOMParser().parseFromString('<html><head/><body/></html>','text/xml'),create=doc.createElement.bind(doc),createNS=doc.createElementNS.bind(doc);var wrap=function(el){if(el.__renderWrapped)return el;el.__renderWrapped=true;var css={transform:'',opacity:'1',perspective:'',transformOrigin:'',backfaceVisibility:'',position:''};css.setProperty=(n,v)=>{css[n]=String(v)};css.removeProperty=n=>{delete css[n]};css.getPropertyValue=n=>css[n]||'';Object.defineProperty(css,'cssText',{get(){return Object.keys(css).filter(k=>typeof css[k]==='string').map(k=>k+':'+css[k]).join(';')},set(text){for(var pair of String(text).split(';')){var at=pair.indexOf(':');if(at>=0){var key=pair.slice(0,at).trim(),v=pair.slice(at+1).trim();css[key]=/^\.?\d+(\.\d+)?$/.test(v)?String(Number(v)):v}}}});el.style=css;el.addEventListener=function(){};el.removeEventListener=function(){};el.getBoundingClientRect=()=>({left:0,top:0,right:0,bottom:0,width:0,height:0});el.getContext=function(){return null};el.canPlayType=()=>'';Object.defineProperty(el,'innerHTML',{configurable:true,get(){return Array.from(el.childNodes).map(n=>new hbDOM.XMLSerializer().serializeToString(n)).join('')},set(value){while(el.firstChild)el.removeChild(el.firstChild);var parsed=new hbDOM.DOMParser().parseFromString('<scope>'+String(value)+'</scope>','text/xml');for(var child of Array.from(parsed.documentElement.childNodes)){var clone=function(n){if(n.nodeType===3)return doc.createTextNode(n.nodeValue||n.data||'');if(n.nodeType!==1)return null;var out=doc.createElement(n.tagName||n.nodeName);for(var a of Array.from(n.attributes||[]))out.setAttribute(a.name||a.nodeName,a.value||a.nodeValue||'');for(var c of Array.from(n.childNodes||[])){var copy=clone(c);if(copy)out.appendChild(copy)}return out};var node=clone(child);if(!node)continue;if(node.nodeType===1){wrap(node);node.style.cssText=node.getAttribute('style')||''}el.appendChild(node)}}});return el};doc.createElement=tag=>wrap(create(tag));doc.createElementNS=(ns,tag)=>wrap(createNS(ns,tag));wrap(doc.documentElement);doc.body=wrap(doc.getElementsByTagName('body')[0]);doc.head=wrap(doc.getElementsByTagName('head')[0]);doc.readyState='loading';doc.addEventListener=function(){};doc.removeEventListener=function(){};doc.styleSheets=[];doc.compatMode='CSS1Compat';return doc});
  const document=createHTML();
  const io={timers:[],raf:[],images:[],networkAttempts:[]};
  const glob={Promise,Map,Set,WeakMap,WeakSet,Symbol,ArrayBuffer,DataView,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float32Array,Float64Array,Math,Date:options.Date||Date,URL,URLSearchParams,
    performance:{now:()=>options.elapsedMs?options.elapsedMs():0},console:{log(){},warn(){},error(){},debug(){},info(){},trace(){}},
    navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1.15',onLine:false,language:'en-US',platform:'iPhone',appVersion:'5.0'},
    location:{search:'',href:'https://offline.invalid/own32750-native-module',protocol:'https:',hostname:'offline.invalid'},
    document,DOMParser:hbDOM.DOMParser,XMLSerializer:hbDOM.XMLSerializer,getComputedStyle:el=>el.style,
    matchMedia:()=>({matches:true,addListener(){},removeListener(){}}),innerWidth:390,innerHeight:844,devicePixelRatio:1,
    XMLHttpRequest:function(){io.networkAttempts.push('XHR');throw Error('OWN32750_NETWORK_NOT_BOUND')},
    Image:function(){this.width=this.height=0;Object.defineProperty(this,'src',{set:v=>io.images.push(v)})},
    Audio:options.Audio,
    addEventListener(){},removeEventListener(){},
    setTimeout:fn=>(io.timers.push(fn),io.timers.length),clearTimeout(){},setInterval:fn=>(io.timers.push(fn),io.timers.length),clearInterval(){},
    requestAnimationFrame:fn=>(io.raf.push(fn),io.raf.length),cancelAnimationFrame(){}
  };
  glob.window=glob;glob.self=glob;document.defaultView=glob;
  const context=vm.createContext(glob),definitions=new Map(),exportsCache=new Map(),loading=[],files=[];
  const permitted=new Set(["eightyeightfortunes","abg2d/abg2d","gsap/TweenLite","gsap/TweenMax","asset/asset","http-connection/http-connection","events/events","util/util","howler/howler","big-win/big-win","game/game","gsap/TimelineMax","game-data/game-data","gls-comms/gls-comms","input/input","locale/locale","particle-effect/particle-effect","reels/reels","gsap/TimelineLite","standard-reels/standard-reels"]);
  const aliases={TweenLite:'gsap/TweenLite',TweenMax:'gsap/TweenMax',TimelineLite:'gsap/TimelineLite',TimelineMax:'gsap/TimelineMax'};
  function resolve(id,parent){if(aliases[id])return aliases[id];return id.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(parent||''),id)):id}
  function define(...args){const name=typeof args[0]==='string'?args.shift():loading.at(-1),deps=Array.isArray(args[0])?args.shift():[],value=args.shift();definitions.set(name,{deps,factory:typeof value==='function'?value:()=>value})}
  define.amd={};context.define=define;
  function load(input,parent=''){
    const id=resolve(input,parent);if(!permitted.has(id))throw Error('OWN32750_AMD_MODULE_UNBOUND '+id);
    if(exportsCache.has(id))return exportsCache.get(id);
    if(!definitions.has(id)){
      const filename=id==='eightyeightfortunes'?root+'/app/eightyeightfortunes.js':root+'/lib/'+id+'.js';
      const source=options.readSource?options.readSource(filename):fs.readFileSync(filename,'utf8');
      loading.push(id);files.push({id,path:filename,bytes:Buffer.byteLength(source)});
      try{new vm.Script(source,{filename}).runInContext(context,{timeout:10000})}finally{loading.pop()}
    }
    const def=definitions.get(id);if(!def){const value=context[id.split('/').at(-1)];if(value!==undefined){exportsCache.set(id,value);return value}throw Error('OWN32750_AMD_DEFINITION_UNBOUND '+id)}
    const exp={},module={exports:exp};exportsCache.set(id,exp);
    function req(ids,done){if(typeof ids==='string')return load(ids,id);const values=ids.map(n=>load(n,id));if(done)done(...values);return values}
    req.toUrl=s=>root+'/lib/'+resolve(s,id);
    const args=def.deps.map(d=>d==='require'?req:d==='exports'?exp:d==='module'?module:load(d,id)),result=def.factory(...args),value=result===undefined?module.exports:result;
    exportsCache.set(id,value);return value;
  }
  return{native:load('eightyeightfortunes'),context,io,exports:exportsCache,files,load};
}
module.exports={createOwn32750Native};
