'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const canvas=require(process.env.OWN_NOVA_CANVAS_MODULE||'@napi-rs/canvas');
function createOwnNativeEngine(gid,options={}){
 const read=folder=>JSON.parse(fs.readFileSync(path.join(__dirname,folder,gid+'-selected-private.json'))),pixi=read('own-PIXI-parent-DATA-v298'),p2=read('own-p2-parent-DATA-v301'),phaser=read('own-shared-next-dependency-DATA-v212'),pending=[];
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.style={};this.children=[];this.listeners=new Map();this.attributes={};}
  appendChild(child){this.children.push(child);child.parentNode=this;return child;}
  removeChild(child){const i=this.children.indexOf(child);assert(i>=0);this.children.splice(i,1);child.parentNode=null;return child;}
  addEventListener(name,fn){assert.equal(typeof fn,'function');const a=this.listeners.get(name)||new Set();a.add(fn);this.listeners.set(name,a);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  getBoundingClientRect(){return {left:0,top:0,width:960,height:540,right:960,bottom:540};}
 }
 const html=new Element('html'),head=new Element('head'),body=new Element('body');html.appendChild(head);html.appendChild(body);
 const document={documentElement:html,head,body,readyState:'loading',hidden:false,createElement(tag){if(tag==='canvas'){const c=canvas.createCanvas(960,540);c.style={};c.addEventListener=()=>{};c.removeEventListener=()=>{};return c;}return new Element(tag);},addEventListener:(...a)=>html.addEventListener(...a),removeEventListener:(...a)=>html.removeEventListener(...a),getElementsByTagName:tag=>tag==='head'?[head]:tag==='body'?[body]:[],getElementById:id=>{const visit=node=>{if(node.id===id)return node;for(const child of node.children||[]){const found=visit(child);if(found)return found;}return null;};return visit(html);}};
 const navigator={userAgent:'Codex offline native browser I/O',platform:'Win32',maxTouchPoints:0};
 const port={document,navigator,Image:canvas.Image,HTMLCanvasElement:canvas.CanvasElement,CanvasRenderingContext2D:canvas.CanvasRenderingContext2D,console,performance:{now:()=>0},screen:{width:960,height:540},innerWidth:960,innerHeight:540,devicePixelRatio:1,location:{href:'https://offline.invalid/own-native-library-bootstrap'},setTimeout:(fn,ms)=>{pending.push({fn,ms});return pending.length;},clearTimeout:id=>{if(pending[id-1])pending[id-1].cancelled=true;},requestAnimationFrame:fn=>{pending.push({fn,frame:true});return pending.length;},cancelAnimationFrame:id=>{if(pending[id-1])pending[id-1].cancelled=true;},addEventListener:(...a)=>html.addEventListener(...a),removeEventListener:(...a)=>html.removeEventListener(...a)};
 port.window=port;port.self=port;const context=vm.createContext(port),factories=[];
 const engine={context,document,port,pending,Element,summary:{gameId:gid}};options.configureBrowserIO?.(engine);
 function execute(row){const module={exports:{}},fn=new vm.Script('('+row.source+')',{filename:gid+'-own-native-library-'+row.moduleId}).runInContext(context);fn.call(module.exports,module,module.exports);factories.push(String(row.moduleId));return module.exports;}
 context.p2=execute(p2);context.PIXI=execute(pixi);context.Phaser=execute(phaser);
 assert.equal(typeof context.Phaser.Game,'function');assert.equal(typeof context.Phaser.Signal,'function');assert.equal(typeof context.PIXI.DisplayObject,'function');assert.equal(context.Phaser.PIXI,context.PIXI);
 Object.assign(engine,{summary:{gameId:gid,nativePIXIFactoryExecuted:true,nativePhaserFactoryExecuted:true,nativePhaserVersion:context.Phaser.VERSION,executedFactories:factories,actualCanvas2DBackend:'@napi-rs/canvas',nativeGameInstanceCreated:false,nativeMainGameControllerExecuted:false,sourceRequests:0,DBAccess:0,terminalEvents:0,productionReady:false}});return engine;
}
module.exports={createOwnNativeEngine};
