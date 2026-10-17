/* Explicit offline browser I/O for the selected own native protocol API only. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const HOME=()=>path.dirname(__dirname);
function createOwnNativeAPI(gid,ownRoot,options={}){
 const N=__dirname,read=rel=>JSON.parse(fs.readFileSync(path.join(N,rel))),previous=read('registered-own-native-next-module-DATA-v189/'+gid+'-selected-modules-private.json'),parents=read('own-native-API-parent-DATA-v264/'+gid+'-selected-private.json'),extra=read('own-native-signal-and-DOM-parent-DATA-v266/'+gid+'-selected-private.json'),ownConfig=read('own-native-config-parent-DATA-v292/'+gid+'-selected-private.json');
 const table={...previous.selected,...parents.selected,[extra.DOMParent.moduleId]:extra.DOMParent,[ownConfig.moduleId]:ownConfig},cache={},factories=[],intents=[],assetGETs=[],messages=[],timers=[],frames=[],intervals=[];
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.events=new Map();this.className='';this.id='';}
  appendChild(n){assert(n instanceof Element);if(n.parentNode)n.parentNode.removeChild(n);this.children.push(n);n.parentNode=this;return n;}
  removeChild(n){const i=this.children.indexOf(n);assert(i>=0);this.children.splice(i,1);n.parentNode=null;return n;}
  addEventListener(name,fn){assert.equal(typeof fn,'function');const set=this.events.get(name)||new Set();set.add(fn);this.events.set(name,set);}
  removeEventListener(name,fn){this.events.get(name)?.delete(fn);}
 }
 const head=new Element('head'),body=new Element('body'),html=new Element('html');html.appendChild(head);html.appendChild(body);
 const walk=(node,fn)=>{if(fn(node))return node;for(const n of node.children){const found=walk(n,fn);if(found)return found;}};
 const document={head,body,documentElement:html,createElement:tag=>new Element(tag),getElementById:id=>walk(html,n=>n.id===id)||null,getElementsByTagName:tag=>{const list=[];walk(html,n=>{if(n.tagName===tag.toUpperCase())list.push(n);return false});return list;}};
 const pending=[];
 class LocalOwnAssetXHR{
  open(method,relative){assert.equal(method,'GET');assert.equal(relative,'config/errorlist/en.json');this.relative=relative;this.readyState=1;}
  send(payload){assert.equal(payload,null);const filename=path.resolve(ownRoot,this.relative);assert(filename.startsWith(path.resolve(ownRoot)+path.sep));let raw,status;if(fs.existsSync(filename)){raw=fs.readFileSync(filename);JSON.parse(raw);status=200;}else{assert.equal(gid,'32738');const base=path.join(N,'own32738-errorlist-asset-GET-v273-once'),r=JSON.parse(fs.readFileSync(path.join(base,'result.json')));raw=fs.readFileSync(path.join(base,'response-body-private.bin'));assert.equal(r.gameId,gid);assert.equal(r.HTTPStatus,404);assert.equal(r.requests,1);assert.equal(r.retries,0);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),r.responseSHA256);status=404;}assetGETs.push({relative:this.relative,bytes:raw.length,HTTPStatus:status,localOnly:true,originalNativePresentation404Branch:status===404});pending.push(()=>{this.readyState=4;this.status=status;this.responseText=raw.toString('utf8');this.onreadystatechange?.()});}
 }
 const parent={languageCode:'en',pageXOffset:0,pageYOffset:0,getSize:()=>({w:960,h:540}),scrollTo:()=>{},sendMsgToServer:query=>{assert.equal(typeof query,'string');intents.push(query)},valueChanged:(key,value)=>messages.push({key,value})};
 const window={parent};const context=vm.createContext({window,document,XMLHttpRequest:LocalOwnAssetXHR,console,debug:()=>{},setTimeout:(fn,ms)=>{assert.equal(typeof fn,'function');timers.push({fn,ms});return timers.length},clearTimeout:id=>{if(timers[id-1])timers[id-1].cancelled=true},requestAnimationFrame:fn=>{assert.equal(typeof fn,'function');frames.push(fn);return frames.length},cancelAnimationFrame:id=>{frames[id-1]=null},setInterval:(fn,ms)=>{assert.equal(typeof fn,'function');assert.equal(ms,100);intervals.push(fn);return intervals.length},clearInterval:id=>{intervals[id-1]=null}});
 const signal=new vm.Script('(function('+extra.signal.sourceSymbol+'){'+extra.signal.source+';return '+extra.signal.sourceSymbol+';})').runInContext(context)({});assert.equal(typeof signal.Signal,'function');assert.equal(typeof signal.SignalBinding,'function');
 const symbols=new Proxy(Object.freeze({Signal:signal.Signal,SignalBinding:signal.SignalBinding}),{get(target,key){assert(Object.hasOwn(target,key),'Unbound full-Phaser symbol: '+String(key));return target[key]}});
 const phaserId=gid==='32550'?'6405':'76405';
 function requireOwn(id){
  id=String(id);if(id===phaserId)return symbols;if(cache[id])return cache[id].exports;const row=table[id];assert(row,'Unbound own native module: '+gid+'/'+id);const module={exports:{}};cache[id]=module;const fn=new vm.Script('('+row.source+')',{filename:gid+'-own-cached-module-'+id}).runInContext(context);factories.push(id);fn.call(module.exports,module,module.exports,requireOwn);return module.exports;
 }
 const OwnConfig=requireOwn(ownConfig.moduleId);new OwnConfig();assert(window.config&&window.config.lineBet>0);context.config=window.config;const entryId=gid==='32550'?'6321':'66321',API=requireOwn(entryId);assert.equal(typeof API,'function');const instance=new API();for(const callback of pending.splice(0))callback();for(const timer of timers)if(!timer.cancelled){assert(timer.ms<=100,'Only this constructor presentation timer is admitted');timer.fn();}
 assert.equal(frames.length,1);frames.shift()(0);assert.equal(frames.length,1);assert.equal(intervals.length,1);intervals[0]();const pendingBrowserFrames=frames.length;frames.length=0;intervals.length=0;
 const state=requireOwn(gid==='32550'?'119':'90119'),bus=requireOwn(gid==='32550'?'1575':'21575'),wire=requireOwn(gid==='32550'?'3561':'33561');
 assert(state.onStateChange instanceof signal.Signal);assert.equal(typeof state.set,'function');assert.equal(typeof bus,'function');assert.equal(typeof wire.responses.processServerMsg,'function');assert.equal(typeof instance.endGame,'function');assert.equal(typeof instance.processServerMsg,'function');assert.equal(intents.length,0,'The protocol constructor must not dispatch gameplay');assert(!messages.some(x=>x.key==='ROUND'),'No terminal signal is injected or claimed');

 window.gameAPI=instance;let started=false,consumed=0,closed=false;
 function nextRequest(){assert(!closed);if(intents.length===consumed)return null;const query=intents[consumed],fields=new URLSearchParams(query),message=fields.get('MSGID');assert(['INIT','REELSTRIP'].includes(message),'Initialization-only native port forbids gameplay');assert.equal([...fields.keys()].join('|'),'MSGID');return Object.freeze({ordinal:consumed+1,message,query});}
 function start(){assert(!started&&!closed&&intents.length===0);started=true;instance.requestInit();const r=nextRequest();assert(r&&r.message==='INIT');return r;}
 function acceptValidatedOriginalInitPayload(payload){assert(started&&!closed&&typeof payload==='string');const r=nextRequest();assert(r);const fields=new URLSearchParams(payload);assert.equal(fields.get('MSGID'),r.message,'Native Init-only outstanding type differs');window.processServerMsg(payload);assert.equal(intents[consumed],r.query);consumed++;const next=nextRequest();if(r.message==='INIT')assert(next&&next.message==='REELSTRIP','Own original wire must request its actual Reelstrip');else{assert.equal(next,null);assert(instance.init&&instance.init.message==='INIT','Original API Init was not emitted by actual native Reelstrip handler');}return next;}
 return {gameId:gid,start,nextRequest,acceptValidatedOriginalInitPayload,readNativeInit:()=>instance.init,summary:()=>({gameId:gid,requests:intents.length,responses:consumed,initialized:!!instance.init,sourceRequests:0,DBAccess:0,fullGameLoop:false,productionReady:false}),close:()=>{closed=true;frames.length=0;intervals.length=0;}};
}
module.exports=Object.freeze({createOwnNativeAPI});
