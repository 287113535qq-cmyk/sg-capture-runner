'use strict';

/* Disabled own 32816 host DATA. No network transport or source/DB owner is created. */
exports.createOwn32816NativeProducer = function createOwn32816NativeProducer(d) {
  const {vm, fs, path, Canvas, DOM} = d;
  for (const k of ['getSessionID', 'getContextID', 'getPlayerID']) {
    if (typeof d.sessionData?.[k] !== 'function') throw Error('OWN32816_SESSION_HOST_REQUIRED');
  }
  if (!vm?.Script || !DOM?.DOMParser || !Canvas?.Image || !Canvas?.createCanvas) {
    throw Error('OWN32816_ORIGINAL_HOST_DEPENDENCIES_REQUIRED');
  }
  const originalFontBinding=require('./own32816-real-declared-Arial-v880.cjs').bindDeclaredOriginalArial({Canvas,profile:d.originalDeclaredFontProfile});
  const viewport = d.viewport;
  if (!viewport || !Number.isFinite(viewport.width) || viewport.width <= 0 ||
      !Number.isFinite(viewport.height) || viewport.height <= 0) {
    throw Error('OWN32816_EXPLICIT_VIEWPORT_REQUIRED');
  }
  const root = fs.realpathSync(d.sourceRoot);
  const binding = d.ownResourceCacheBinding;
  const expectedResourcePrefix = 'https://d10ml311dd14ci.cloudfront.net/5.0.4.1-1787670669/resource-service/content/zeus3_prt/';
  if (!binding || String(binding.gameId) !== '32816' ||
      binding.version !== '5.0.4.1-1787670669' || binding.urlPrefix !== expectedResourcePrefix) {
    throw Error('OWN32816_EXACT_OWN_RESOURCE_BINDING_REQUIRED');
  }
  const resourceRoot = fs.realpathSync(binding.cacheRoot);
  const resourceURL = new URL(expectedResourcePrefix);
  const z = {
    phase: 'host-created', files: [], logs: [], errors: [], partnerEvents: [],
    staticAttempts: [], staticReads: [], imageEvents: [], pending: [],
    timers: new Map(), serial: 0, now: 0, epoch: d.epoch,
    originalFontBinding, sourceRoot: root, physicalPOSTs: 0, disposed: false, bootCalled: false
  };
  if (!Number.isFinite(z.epoch)) throw Error('OWN32816_EXPLICIT_CLOCK_REQUIRED');

  z.timer = function(fn, delay, args, repeat, raf) {
    const id = ++z.serial, ms = Math.max(0, Number(delay) || 0);
    z.timers.set(id, {id, fn, delay: ms, due: z.now + ms, args, repeat, raf});
    return id;
  };
  z.runDue = function() {
    if (z.disposed) throw Error('OWN32816_DISPOSED');
    const all = Array.from(z.timers.values()).sort((a,b) => a.due-b.due || a.id-b.id);
    if (!all.length) return false;
    const due = all[0].due;
    z.now = due;
    for (const t of all.filter(t => t.due <= due)) {
      if (z.timers.get(t.id) !== t) continue;
      if (t.repeat) t.due = due + Math.max(1, t.delay);
      else z.timers.delete(t.id);
      if (typeof t.fn === 'function') t.fn.apply(z.context, t.raf ? [z.now] : t.args);
      else new vm.Script(String(t.fn), {filename:'own32816-original-string-timer.js'})
        .runInContext(z.context, {timeout:10000});
    }
    return true;
  };
  z.ownFile = function(url) {
    const u = new URL(url, 'https://offline.invalid/');
    const marker = '/content/zeus3_prt/', at = u.pathname.indexOf(marker);
    if (at < 0) throw Error('OWN32816_UNBOUND_CACHE_URL');
    const file = path.resolve(root, decodeURIComponent(u.pathname.slice(at + marker.length)));
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('OWN32816_CACHE_ESCAPE');
    const real = fs.realpathSync(file), realRelative = path.relative(root, real);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw Error('OWN32816_REAL_CACHE_ESCAPE');
    return real;
  };
  z.resourceFile = function(url) {
    const u = new URL(url);
    if (u.origin !== resourceURL.origin || u.username || u.password ||
        u.search || u.hash || !u.pathname.startsWith(resourceURL.pathname)) {
      throw Error('OWN32816_RESOURCE_ORIGIN_VERSION_GAME_MISMATCH');
    }
    const suffix = decodeURIComponent(u.pathname.slice(resourceURL.pathname.length));
    const file = path.resolve(resourceRoot, suffix), relative = path.relative(resourceRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw Error('OWN32816_RESOURCE_CACHE_ESCAPE');
    }
    const real = fs.realpathSync(file), realRelative = path.relative(resourceRoot, real);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw Error('OWN32816_REAL_RESOURCE_CACHE_ESCAPE');
    }
    return real;
  };
  z.readStatic = function(url) {
    z.staticAttempts.push({url:String(url), localOnly:true});
    if (/^data:/.test(url)) {
      const m = /^data:([^,]*),(.*)$/s.exec(url);
      if (!m) throw Error('OWN32816_MALFORMED_DATA_URI');
      return /;base64(?:;|$)/.test(m[1])
        ? Buffer.from(m[2], 'base64') : Buffer.from(decodeURIComponent(m[2]), 'utf8');
    }
    const file = z.resourceFile(url), bytes = fs.readFileSync(file);
    z.staticReads.push({url:String(url), file, bytes:bytes.length});
    return bytes;
  };

  z.doc = new DOM.DOMParser().parseFromString('<html><head></head><body></body></html>', 'text/xml');
  const baseCreate = z.doc.createElement.bind(z.doc);
  function decorate(el) {
    if (el.__own32816Host) return el;
    el.__own32816Host = true;
    el.style = {
      transform:'', opacity:'1', position:'', perspective:'', transformOrigin:'',
      backfaceVisibility:'',
      setProperty(k,v) {this[k] = String(v);},
      removeProperty(k) {delete this[k];},
      getPropertyValue(k) {return this[k] || '';}
    };
    const elementChildren=()=>Array.from(el.childNodes||[]).filter(node=>node.nodeType===1);
    const childCollection=new Proxy({},{
      get(target,key){
        if(key==='length')return elementChildren().length;
        if(key==='item')return index=>elementChildren()[Number(index)]||null;
        if(key==='namedItem')return name=>elementChildren().find(node=>node.getAttribute('id')===String(name)||node.getAttribute('name')===String(name))||null;
        if(key===Symbol.iterator)return function*(){for(let i=0;i<childCollection.length;i++)yield childCollection[i];};
        if(key===Symbol.toStringTag)return 'HTMLCollection';
        if(typeof key==='string'&&/^(0|[1-9][0-9]*)$/.test(key))return elementChildren()[Number(key)];
        if(typeof key==='string')return elementChildren().find(node=>node.getAttribute('id')===key||node.getAttribute('name')===key);
      },
      set(){return false;},
      ownKeys(){return elementChildren().map((_,index)=>String(index));},
      getOwnPropertyDescriptor(target,key){if(typeof key==='string'&&/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<elementChildren().length)return {configurable:true,enumerable:true,value:elementChildren()[Number(key)],writable:false};}
    });
    Object.defineProperty(el,'children',{configurable:true,enumerable:true,get:()=>childCollection});
    el.__events = {};
    el.addEventListener = function(n,fn) {(this.__events[n] || (this.__events[n]=[])).push(fn);};
    el.removeEventListener = function(n,fn) {
      const a=this.__events[n], i=a?.indexOf(fn); if (i >= 0) a.splice(i,1);
    };
    el.dispatchEvent = function(e) {
      for (const fn of (this.__events[e.type] || []).slice()) fn.call(this,e);
    };
    for (const [key,attr] of [['id','id'],['className','class']]) {
      Object.defineProperty(el,key,{
        configurable:true, get() {return this.getAttribute(attr) || '';},
        set(v) {this.setAttribute(attr,String(v));}
      });
    }
    el.getElementsByClassName = function(name) {
      const names = String(name).split(/\s+/).filter(Boolean);
      return Array.from(this.getElementsByTagName('*')).filter(n =>
        names.every(x => String(n.getAttribute('class') || '').split(/\s+/).includes(x)));
    };
    if (String(el.nodeName).toLowerCase() === 'canvas') {
      const cpu = Canvas.createCanvas(300,150), contexts = new Map();
      el.__cpuCanvas = cpu;
      el.getContext = function(type) {
        if (type !== '2d') return null;
        if (!contexts.has(type)) {
          const ctx=cpu.getContext(type), draw=ctx.drawImage.bind(ctx), pattern=ctx.createPattern.bind(ctx);
          ctx.drawImage=(s,...a)=>draw(s?.__cpuCanvas || s?.__cpuImage || s,...a);
          ctx.createPattern=(s,...a)=>pattern(s?.__cpuCanvas || s?.__cpuImage || s,...a);
          contexts.set(type,ctx);
        }
        return contexts.get(type);
      };
      for (const k of ['width','height']) Object.defineProperty(el,k,{
        configurable:true, get:()=>cpu[k], set:v=>{cpu[k]=Number(v);}
      });
      el.toDataURL=(...a)=>cpu.toDataURL(...a);
    }
    const size = axis => {
      const text=String(el.style[axis] || '');
      if (text.endsWith('%')) {
        const key=axis==='width'?'clientWidth':'clientHeight';
        const base=el.parentNode && typeof el.parentNode[key]==='number'
          ? el.parentNode[key] : viewport[axis];
        return parseFloat(text)/100*base;
      }
      if (text!=='' && Number.isFinite(parseFloat(text))) return parseFloat(text);
      const raw=Number(el[axis]);
      return Number.isFinite(raw) ? raw : viewport[axis];
    };
    for (const [key,axis] of [
      ['clientWidth','width'],['clientHeight','height'],['offsetWidth','width'],['offsetHeight','height']
    ]) Object.defineProperty(el,key,{configurable:true,get:()=>size(axis)});
    el.getBoundingClientRect=()=>({
      left:0,top:0,width:size('width'),height:size('height'),right:size('width'),bottom:size('height')
    });
    return el;
  }
  function ImageHost() {
    const el=decorate(baseCreate('img')), cpu=new Canvas.Image();
    Object.setPrototypeOf(el,ImageHost.prototype);
    el.__cpuImage=cpu;
    let url='', complete=false;
    for (const k of ['width','height','naturalWidth','naturalHeight']) {
      Object.defineProperty(el,k,{
        configurable:true,
        get:()=>cpu[k==='naturalWidth'?'width':k==='naturalHeight'?'height':k],
        set:v=>{if(k==='width'||k==='height')cpu[k]=Number(v);}
      });
    }
    Object.defineProperty(el,'complete',{get:()=>complete});
    Object.defineProperty(el,'src',{
      get:()=>url,
      set:v=>{url=String(v);complete=false;cpu.src=z.readStatic(url);}
    });
    /* Native Image callbacks have a void return ABI. Do not return the timer id. */
    cpu.onload=function() {
      z.timer(function() {
        complete=true;
        z.imageEvents.push({type:'load',width:cpu.width,height:cpu.height});
        const e={type:'load',target:el,currentTarget:el};
        if(typeof el.onload==='function') el.onload(e);
        el.dispatchEvent(e);
      },0,[],false,false);
    };
    cpu.onerror=function(err) {
      z.timer(function() {
        z.imageEvents.push({type:'error',message:String(err)});
        const e={type:'error',target:el,currentTarget:el,error:err};
        if(typeof el.onerror==='function') el.onerror(e);
        el.dispatchEvent(e);
      },0,[],false,false);
    };
    return el;
  }
  if(typeof d.createOwn32816DecodedAudioPort!=='function' ||
     typeof d.getOwnQualifiedAudioInput!=='function' ||
     typeof d.decodeCompleteOwnVorbis!=='function' || typeof d.actualWallNow!=='function') {
    throw Error('OWN32816_QUALIFIED_AUDIO_HOST_REQUIRED');
  }
  z.audioPort=d.createOwn32816DecodedAudioPort({
    createOwnedAudioNode:()=>decorate(baseCreate('audio')),
    schedule:(fn,stamp)=>{z.timer(fn,Math.max(0,stamp.virtualDueAt-z.now),[],false,false);},
    readOwnBytes:url=>z.readStatic(url),
    assertOwnResourceURL:url=>z.resourceFile(url),
    getOwnQualifiedInput:d.getOwnQualifiedAudioInput,
    decodeCompleteOwnVorbis:d.decodeCompleteOwnVorbis,
    isDisposed:()=>z.disposed,virtualNow:()=>z.now,wallNow:d.actualWallNow
  });
  z.doc.createElement=n=>String(n).toLowerCase()==='audio'?new z.audioPort.AudioElement():String(n).toLowerCase()==='img'?new ImageHost():decorate(baseCreate(n));
  z.doc.head=decorate(z.doc.getElementsByTagName('head')[0]);
  z.doc.body=decorate(z.doc.getElementsByTagName('body')[0]);
  decorate(z.doc.documentElement);
  z.doc.getElementById=id=>Array.from(z.doc.getElementsByTagName('*'))
    .find(n=>n.getAttribute('id')===id) || null;
  z.doc.addEventListener=function(){};
  z.doc.removeEventListener=function(){};
  z.doc.readyState='complete'; z.doc.compatMode='CSS1Compat'; z.doc.styleSheets=[];
  z.container=z.doc.createElement('div'); z.container.id='game-container';
  z.progressModal=z.doc.createElement('div'); z.progressModal.id='progress-bar-modal';
  for (const el of [z.container,z.progressModal]) {
    el.style.width=viewport.width+'px'; el.style.height=viewport.height+'px'; z.doc.body.appendChild(el);
  }

  function LocalXHR() {this.headers={};this.readyState=0;this.status=0;this.responseType='';this.__events={};}
  LocalXHR.prototype.open=function(method,url,async) {
    this.method=method;this.url=url;this.async=async;this.readyState=1;
  };
  LocalXHR.prototype.setRequestHeader=function(k,v) {this.headers[String(k)]=String(v);};
  LocalXHR.prototype.addEventListener=function(n,fn) {(this.__events[n]||(this.__events[n]=[])).push(fn);};
  LocalXHR.prototype.removeEventListener=function(n,fn) {
    const a=this.__events[n],i=a?.indexOf(fn);if(i>=0)a.splice(i,1);
  };
  LocalXHR.prototype.overrideMimeType=function(v) {this.mimeType=v;};
  LocalXHR.prototype.getResponseHeader=function() {return null;};
  LocalXHR.prototype.getAllResponseHeaders=function() {return '';};
  LocalXHR.prototype._emit=function(type) {
    const e={type,target:this,currentTarget:this};
    if(typeof this['on'+type]==='function')this['on'+type](e);
    for(const fn of this.__events[type]||[])fn.call(this,e);
  };
  LocalXHR.prototype.send=function(body) {
    if(this.sent)throw Error('OWN32816_NATIVE_REQUEST_REPLAY');
    this.sent=true;this.body=body;
    if(this.method==='POST') {
      if(this.url!=='https://gls.atc.casinarena.com/gls.rgsx')throw Error('OWN32816_UNBOUND_POST_URL');
      if(typeof body!=='string')throw Error('OWN32816_FULL_NATIVE_XML_REQUIRED');
      const xml=new DOM.DOMParser().parseFromString(body,'text/xml');
      this.event=xml.documentElement.getAttribute('type');
      if(z.pending.length)throw Error('OWN32816_ONE_NATIVE_PENDING_REQUIRED');
      z.pending.push(this);
      return;
    }
    if(this.method!=='GET')throw Error('OWN32816_UNBOUND_METHOD');
    const bytes=z.readStatic(this.url), x=this;
    z.timer(function() {
      if(x.aborted)return;
      x.status=200; x.readyState=4; x.responseText=bytes.toString('utf8');
      x.response=x.responseType==='arraybuffer'
        ? bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)
        : x.responseType==='json'?JSON.parse(x.responseText):x.responseText;
      x._emit('readystatechange'); x._emit('load'); x._emit('loadend');
    },0,[],false,false);
  };
  LocalXHR.prototype.abort=function() {this.aborted=true;this._emit('abort');};

  function UnavailableAudio() {
    this.readyState=0;this.networkState=0;this.paused=true;this.ended=false;
    this.muted=false;this.volume=1;this.currentTime=0;this.duration=NaN;this.src='';this.listeners={};
  }
  UnavailableAudio.prototype.canPlayType=function(){return '';};
  UnavailableAudio.prototype.addEventListener=function(n,fn){(this.listeners[n]||(this.listeners[n]=[])).push(fn);};
  UnavailableAudio.prototype.removeEventListener=function(n,fn){
    const a=this.listeners[n],i=a?.indexOf(fn);if(i>=0)a.splice(i,1);
  };
  UnavailableAudio.prototype.load=function(){};
  UnavailableAudio.prototype.pause=function(){this.paused=true;};
  UnavailableAudio.prototype.play=function(){throw Error('OWN32816_AUDIO_PLAYBACK_UNAVAILABLE');};

  function VirtualDate(...args) {return new Date(...(args.length?args:[z.epoch+z.now]));}
  VirtualDate.now=()=>z.epoch+z.now; VirtualDate.parse=Date.parse; VirtualDate.UTC=Date.UTC;
  const windowEvents={};
  z.window={
    document:z.doc,DOMParser:DOM.DOMParser,XMLSerializer:DOM.XMLSerializer,
    console:{log:(...a)=>{z.logs.push(a);},warn:(...a)=>{z.logs.push(a);},error:(...a)=>{z.logs.push(a);}},
    Promise,Map,Set,WeakMap,WeakSet,Symbol,URL,URLSearchParams,ArrayBuffer,DataView,
    Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int32Array,Float32Array,Float64Array,
    Date:VirtualDate,performance:{now:()=>z.now},
    navigator:{
      userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
      platform:'Win32',language:'en-US',appVersion:'5.0',onLine:false
    },
    location:{href:'https://offline.invalid/content/zeus3_prt/',search:'',protocol:'https:',hostname:'offline.invalid'},
    screen:{width:viewport.width,height:viewport.height},
    innerWidth:viewport.width,innerHeight:viewport.height,devicePixelRatio:1,
    getComputedStyle:el=>el.style,Audio:z.audioPort.AudioElement,HTMLAudioElement:z.audioPort.AudioElement,
    Image:ImageHost,HTMLImageElement:ImageHost,XMLHttpRequest:LocalXHR,
    addEventListener(n,fn){(windowEvents[n]||(windowEvents[n]=[])).push(fn);},
    removeEventListener(n,fn){const a=windowEvents[n],i=a?.indexOf(fn);if(i>=0)a.splice(i,1);},
    setTimeout:(fn,delay,...a)=>z.timer(fn,delay,a,false,false),
    clearTimeout:id=>{z.timers.delete(id);},
    setInterval:(fn,delay,...a)=>z.timer(fn,delay,a,true,false),
    clearInterval:id=>{z.timers.delete(id);},
    requestAnimationFrame:fn=>z.timer(fn,16,[],false,true),
    cancelAnimationFrame:id=>{z.timers.delete(id);},
    fetch(){throw Error('OWN32816_PHYSICAL_FETCH_DISABLED');}
  };
  for(const key of ['window','self','parent','top'])z.window[key]=z.window;
  z.doc.defaultView=z.window;

  z.partner={
    logics:{platform:{},get pageNavigator(){
      const Original=z.context?.util?.URLParamPageNavigator;
      if(typeof Original!=='function')throw Error('OWN32816_ORIGINAL_PAGE_NAVIGATOR_NOT_LOADED');
      if(!z.originalPageNavigator)z.originalPageNavigator=new Original();
      if(Object.getPrototypeOf(z.originalPageNavigator)!==Original.prototype)
        throw Error('OWN32816_ORIGINAL_PAGE_NAVIGATOR_IDENTITY_CHANGED');
      return z.originalPageNavigator;
    }},getSessionData:()=>d.sessionData,getGameDomElement:()=>z.container,
    get partnerAutoplayManager(){
      const Original=z.context?.util?.AutoplayManager;
      if(typeof Original!=='function')throw Error('OWN32816_ORIGINAL_AUTOPLAY_MANAGER_NOT_LOADED');
      if(!z.originalAutoplayManager)z.originalAutoplayManager=new Original();
      if(Object.getPrototypeOf(z.originalAutoplayManager)!==Original.prototype)
        throw Error('OWN32816_ORIGINAL_AUTOPLAY_MANAGER_IDENTITY_CHANGED');
      return z.originalAutoplayManager;
    },
    setMenuHandler(type,fn){
      z.partnerEvents.push({event:'menu',type});
      return value=>{z.partnerEvents.push({event:'menu-update',type,value});};
    },
    showProgressBar(...a){z.partnerEvents.push({event:'show-progress',args:a});},
    hideProgressBar(){z.partnerEvents.push({event:'hide-progress'});},
    updatedLoadingProgress(...a){z.partnerEvents.push({event:'loading',args:a});},
    startedPlay(){z.partnerEvents.push({event:'startedPlay'});},
    finishedPlay(){z.partnerEvents.push({event:'finishedPlay'});},
    finishedPostGameAnimations(){z.partnerEvents.push({event:'finishedPostGameAnimations'});},
    receivedGameLogicResponse(response){
      z.partnerEvents.push({event:'receivedGameLogicResponse',status:response.status});
    },
    updateBet(bet){z.partnerEvents.push({event:'updateBet',bet});},
    showError(h,m){z.errors.push(String(m));throw Error('OWN32816_NATIVE_SHOW_ERROR '+m);},
    reload(){throw Error('OWN32816_NATIVE_RELOAD_REQUESTED');},
    goHome(){throw Error('OWN32816_NATIVE_GOHOME_REQUESTED');},
    formatCurrency(...a){
      if(typeof d.originalFormatCurrency!=='function')
        throw Error('OWN32816_ORIGINAL_PARTNER_CURRENCY_FORMATTER_NOT_BOUND');
      return d.originalFormatCurrency(...a);
    }
  };
  z.context=vm.createContext(z.window);
  z.boot=function() {
    if(z.disposed||z.bootCalled)throw Error('OWN32816_START_ONCE');
    z.bootCalled=true; z.phase='native-bootstrap-running';
    const run=(source,name)=>new vm.Script(source,{filename:name}).runInContext(z.context,{timeout:10000});
    run(d.entry.requireJS,'own32816/unchanged/require.js');
    z.context.requirejs.load=function(context,moduleName,url) {
      const file=z.ownFile(url),source=d.readSource(file);
      z.files.push({moduleName,url,file,bytes:Buffer.byteLength(source)});
      run(source,file);
      context.completeLoad(moduleName);
    };
    run(d.entry.metadata,'own32816/unchanged/zeus3_prt.metadatabundle.js');
    run(d.entry.wrapper,'own32816/unchanged/zeus3_prt.game.js');
    z.outerGame=new z.context.zeus3_prt.Game();
    z.outerGame.setPartnerAdapter(z.partner);
  };
  z.disposeBeforeProviderRequest=function() {
    if(z.pending.length)throw Error('OWN32816_PENDING_OWNER_MUST_BE_RETAINED');
    z.timers.clear();z.disposed=true;z.phase='disposed-before-provider-request';
  };
  return z;
};
