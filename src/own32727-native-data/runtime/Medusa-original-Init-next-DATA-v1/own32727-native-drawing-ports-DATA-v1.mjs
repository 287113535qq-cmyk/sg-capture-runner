import assert from 'node:assert/strict';
function drawing(){
 const timers=[];let now=0,ordinal=0;const sounds=[],symbols=[],grid=new Map(),layers=new Map();
 function Container(){this.children=[];this.x=0;this.y=0;this.width=10;this.height=10;this.scaleX=this.scaleY=1;this.anchor={set(){}};this.scale={set(){}};}
 Container.prototype.addChild=function(value){this.children.push(value);value.parent=this;return value;};
 Container.prototype.removeChild=function(value){this.children=this.children.filter(v=>v!==value);};
 Container.prototype.setPositionXY=function(x,y){this.x=x;this.y=y;};
 Container.prototype.setSize=function(value){this.size=value;};Container.prototype.getSize=function(){return this.size;};
 Container.prototype.setAlpha=Container.prototype.setAlphaSmooth=function(value){this.alpha=value;};
 Container.prototype.animate_api=function(){};
 Container.prototype.destroy=function(){if(this.parent)this.parent.removeChild(this);this.destroyed=true;};
 Container.prototype.gotoAndPlay=Container.prototype.gotoAndStop=function(frame){this.currentFrame=frame;};
 function Graphics(){Container.call(this);}Graphics.prototype=Object.create(Container.prototype);
 Graphics.prototype.beginFill=Graphics.prototype.endFill=function(){};
 Graphics.prototype.drawRect=function(x,y,w,h){Object.assign(this,{x,y,width:w,height:h});};
 const later=(delay,callback,args=[],scope)=>{assert(Number.isFinite(delay)&&delay>=0&&typeof callback==='function');timers.push({at:now+delay,callback,args:args??[],scope,ordinal:ordinal++});};
 function animate(target,delay,properties){const tween={target};later(delay+(properties.delay??0),()=>{for(const[k,v]of Object.entries(properties)){if(!['onComplete','onCompleteParams','onCompleteScope','ease','delay','yoyo','repeat','repeatDelay'].includes(k))target[k]=v;}if(properties.onComplete)Reflect.apply(properties.onComplete,properties.onCompleteScope,(properties.onCompleteParams??[]).map(v=>v==='{self}'?tween:v));});return tween;}
 const sprite=()=>new Container();
 const getContainer=name=>{if(!layers.has(name))layers.set(name,new Container());return layers.get(name);};
 const ease={easeIn:{},easeOut:{},easeInOut:{}};
 function Spine(){Container.call(this);this.skeleton={setToSetupPose(){},update(){}};this.state={setAnimation(){}};}Spine.prototype=Object.create(Container.prototype);
 function Emitter(){this.update=function(){};this.destroy=function(){};}
 const ports={addToContainer(name,value){getContainer(name).addChild(value);},NovaContainer:Container,NovaGraphics:Graphics,Back:ease,Power2:ease,Power3:ease,Power4:ease,
 TweenMax:{delayedCall:later,to:animate,fromTo(target,delay,from,to){Object.assign(target,from);return animate(target,delay,to);},killTweensOf(){}},
 backgroundAnims:{setFreeGameBackground(){},applyDarkTint(){}},introPanel:{},gameSound:{playSymbol(){},playSpin(){},stopSpin(){},fadeAmbientOut(){},fadeAmbientIn(){}},getTexture:name=>({drawingOnlyTextureName:name}),getSprite:sprite,getContainer,isHD:()=>true,isSD:()=>false,
 recordDisplay(){},fgMeters:{updateRightCounter(){}},summaryPanel:{show(){}},recordSound:(...args)=>sounds.push(args),utility:{getMC:sprite,Random:{Range:(a,b)=>(a+b)/2},shakeAnim:()=>({play(){}})},
 PIXI:{BLEND_MODES:{ADD:1},spine:{Spine},particles:{Emitter}},NovaLoader:{resources:{eyes_glow_anim:{spineData:{drawingOnly:true}}}}};
 return {ports,symbols,grid,sounds,symbol(options){assert(options&&typeof options==='object');const view=new Container();view.options=options;view.id=options.id;const child=new Container();child.children.push(new Container());view.children.push(child);symbols.push(view);return view;},
 advance(){for(let i=0;timers.length;i++){assert(i<512,'Finite native rendering callback budget');timers.sort((a,b)=>a.at-b.at||a.ordinal-b.ordinal);const task=timers.shift();now=task.at;Reflect.apply(task.callback,task.scope,task.args);}},get now(){return now;}};
}
export {drawing as createOwn32727DrawingPortsDATA};
