'use strict';
const assert=require('node:assert/strict');

/* Own32816 UI input DATA only. Never invoke a game event, mediator or FSM API. */
exports.createOwn32816FreeIntroNativeInput=function createOwn32816FreeIntroNativeInput(d) {
  for(const key of ['readHost','assertOriginalOpen','assertActiveOriginalPaidIntent','assertCurrentAcceptedLogic'])
    assert.equal(typeof d[key],'function','OWN32816_FREE_INTRO_DEPENDENCY '+key);
  const attempted=new WeakMap(),nativeResponses=new WeakMap();
  let sealed=false,waits=0,attempts=0,dispatched=0,unknown=0;
  const wait=reason=>{waits++;return Object.freeze({status:'wait',reason});};
  function one(entries,Original,name) {
    assert.equal(typeof Original,'function','OWN32816_FREE_INTRO_ORIGINAL_TYPE '+name);
    const rows=entries.filter(x=>x.instance instanceof Original);
    assert.equal(rows.length,1,'OWN32816_FREE_INTRO_ONE_ORIGINAL_INSTANCE '+name);
    assert.equal(Object.getPrototypeOf(rows[0].instance),Original.prototype,'OWN32816_FREE_INTRO_ORIGINAL_PROTOTYPE '+name);
    return rows[0].instance;
  }
  function method(value,original,name) {
    assert.equal(typeof original,'function','OWN32816_FREE_INTRO_ORIGINAL_METHOD '+name);
    assert.equal(value,original,'OWN32816_FREE_INTRO_METHOD_IDENTITY '+name);
  }
  function ancestorOf(ancestor,node) {
    const seen=new Set();
    while(node){assert(!seen.has(node)&&seen.size<64,'OWN32816_FREE_INTRO_FINITE_PARENT_CHAIN');if(node===ancestor)return true;seen.add(node);node=node.parent;}
    return false;
  }
  return Object.freeze({
    tryMouseDown({paidIntent,delivery}) {
      assert(!sealed,'OWN32816_FREE_INTRO_SEALED');d.assertOriginalOpen();
      assert(paidIntent&&typeof paidIntent==='object'&&delivery&&typeof delivery==='object','OWN32816_FREE_INTRO_ORIGINAL_CAPABILITIES');
      d.assertActiveOriginalPaidIntent(paidIntent);
      d.assertCurrentAcceptedLogic(delivery);
      if(attempted.has(paidIntent))return Object.freeze({status:'already-attempted',outcome:attempted.get(paidIntent).outcome});
      const h=d.readHost(),c=h?.context,g=c?.sgigame,r=c?.rendering,j=c?.createjs,main=h?.outerGame?.main;
      assert(h&&!h.disposed&&g&&r&&j,'OWN32816_FREE_INTRO_ORIGINAL_HOST');
      assert.equal(Object.getPrototypeOf(h.outerGame),c.zeus3_prt?.Game?.prototype,'OWN32816_FREE_INTRO_OWN_WRAPPER');
      assert.equal(Object.getPrototypeOf(main),g.Main?.prototype,'OWN32816_FREE_INTRO_OWN_MAIN');
      assert(Array.isArray(h.pending)&&h.pending.length===0,'OWN32816_FREE_INTRO_NO_PENDING_REQUEST');
      assert(Array.isArray(h.errors)&&h.errors.length===0,'OWN32816_FREE_INTRO_HEALTHY_HOST');
      const entries=main._context?.injector?.singletonMap;assert(Array.isArray(entries),'OWN32816_FREE_INTRO_ORIGINAL_INJECTOR');
      const model=one(entries,g.GameStateModel,'GameStateModel');
      method(model.getCurrentState,g.GameStateModel.prototype.getCurrentState,'getCurrentState');
      method(model.getSubGame,g.GameStateModel.prototype.getSubGame,'getSubGame');
      if(model.getCurrentState()?.stateName!==g.BaseGameStates.BONUS_TRIGGER_STATE||model.getSubGame()!==g.SubGames.BASE_GAME)
        return Object.freeze({status:'not-applicable'});
      const server=one(entries,g.ServerController,'ServerController');
      method(server.getLogicResponse,g.ServerController.prototype.getLogicResponse,'getLogicResponse');
      const response=server.getLogicResponse();
      assert(response instanceof g.GameLogicResponse&&Object.getPrototypeOf(response)===g.GameLogicResponse.prototype,'OWN32816_FREE_INTRO_CURRENT_NATIVE_LOGIC_TYPE');
      if(nativeResponses.has(delivery))assert.equal(nativeResponses.get(delivery),response,'OWN32816_FREE_INTRO_CURRENT_LOGIC_IDENTITY');
      else nativeResponses.set(delivery,response);
      const banners=one(entries,g.BannersLayerModel,'BannersLayerModel'),layer=banners.layer;
      if(!layer)return wait('original-banner-layer-not-created');
      assert(layer instanceof r.DisplayObjectContainer,'OWN32816_FREE_INTRO_ORIGINAL_BANNER_LAYER');
      assert(Array.isArray(layer.children),'OWN32816_FREE_INTRO_ORIGINAL_LAYER_CHILDREN');
      const views=layer.children.filter(x=>x instanceof g.FreeSpinIntroView);
      if(views.length===0)return wait('actual-intro-view-not-mounted');
      assert.equal(views.length,1,'OWN32816_FREE_INTRO_ONE_MOUNTED_VIEW');
      const view=views[0];
      assert.equal(Object.getPrototypeOf(view),g.FreeSpinIntroView.prototype,'OWN32816_FREE_INTRO_ORIGINAL_VIEW_PROTOTYPE');
      assert.equal(view.parent,layer,'OWN32816_FREE_INTRO_ACTUAL_VIEW_PARENT');
      const banner=view.hitBanner;
      if(!banner)return wait('actual-hitBanner-not-created');
      assert(banner instanceof r.Bitmap&&Object.getPrototypeOf(banner)===r.Bitmap.prototype,'OWN32816_FREE_INTRO_ORIGINAL_HIT_BITMAP');
      method(banner.getNativeDisplayObject,r.DisplayObject.prototype.getNativeDisplayObject,'hitBanner.getNativeDisplayObject');
      method(view.getNativeDisplayObject,r.DisplayObject.prototype.getNativeDisplayObject,'view.getNativeDisplayObject');
      method(layer.getNativeDisplayObject,r.DisplayObject.prototype.getNativeDisplayObject,'layer.getNativeDisplayObject');
      method(banner.onDown,r.DisplayObject.prototype.onDown,'original-rendering-onDown');
      assert.equal(banner.parent,view,'OWN32816_FREE_INTRO_ACTUAL_HIT_PARENT');
      if(!view.visible||!banner.visible||view._interactive!==true||banner._interactive!==true||banner._listenersAdded!==true)
        return wait('actual-target-not-visible-interactive-attached');
      const eventIndex=Array.isArray(banner._eventNames)?banner._eventNames.indexOf(r.InputEvent.DOWN):-1;
      if(eventIndex<0)return wait('original-intro-DOWN-listener-not-attached');
      const listeners=banner._listeners?.[eventIndex],contexts=banner._listenerContexts?.[eventIndex];
      assert(Array.isArray(listeners)&&Array.isArray(contexts)&&listeners.length===contexts.length,'OWN32816_FREE_INTRO_ORIGINAL_LISTENER_REGISTRY');
      const bound=listeners.map((listener,index)=>({listener,scope:contexts[index]})).filter(x=>
        x.listener===g.FreeSpinIntroMediator.prototype.onDown&&x.scope instanceof g.FreeSpinIntroMediator&&
        Object.getPrototypeOf(x.scope)===g.FreeSpinIntroMediator.prototype&&x.scope.view===view);
      if(bound.length===0)return wait('original-intro-mediator-not-bound-to-actual-view');
      assert.equal(bound.length,1,'OWN32816_FREE_INTRO_ONE_ORIGINAL_DOWN_LISTENER');
      const native=banner.getNativeDisplayObject(),nativeView=view.getNativeDisplayObject(),nativeLayer=layer.getNativeDisplayObject();
      assert(native instanceof j.Container&&Object.getPrototypeOf(native)===j.Container.prototype,'OWN32816_FREE_INTRO_ORIGINAL_CREATEJS_CONTAINER');
      assert.equal(native.parent,nativeView,'OWN32816_FREE_INTRO_NATIVE_HIT_PARENT');
      assert.equal(nativeView.parent,nativeLayer,'OWN32816_FREE_INTRO_NATIVE_VIEW_PARENT');
      const stageWrapper=banner.stage;
      if(!stageWrapper||stageWrapper!==view.stage||stageWrapper!==layer.stage)return wait('actual-stage-not-attached');
      assert(stageWrapper instanceof r.Stage,'OWN32816_FREE_INTRO_ORIGINAL_RENDERING_STAGE');
      method(stageWrapper.getNativeDisplayObject,r.Stage.prototype.getNativeDisplayObject,'stage.getNativeDisplayObject');
      const stage=stageWrapper.getNativeDisplayObject();
      assert(stage instanceof j.Stage,'OWN32816_FREE_INTRO_ORIGINAL_CREATEJS_STAGE');
      if(!ancestorOf(stage,native))return wait('actual-target-not-on-stage');
      for(let node=native;node;node=node.parent){
        if(node.visible!==true||!Number.isFinite(node.alpha)||node.alpha<=0||node.scaleX===0||node.scaleY===0||node.mouseEnabled===false)
          return wait('actual-target-or-ancestor-not-visible-enabled');
        if(node===stage)break;
      }
      method(native.getBounds,j.Container.prototype.getBounds,'native.getBounds');
      method(native.localToGlobal,j.DisplayObject.prototype.localToGlobal,'native.localToGlobal');
      method(native.hasEventListener,j.EventDispatcher.prototype.hasEventListener,'native.hasEventListener');
      if(!native.hasEventListener('mousedown'))return wait('original-native-mousedown-listener-not-attached');
      const bounds=native.getBounds();
      if(!bounds||![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)||bounds.width<=0||bounds.height<=0)
        return wait('actual-hit-geometry-not-ready');
      const point=native.localToGlobal(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
      method(stage.globalToLocal,j.DisplayObject.prototype.globalToLocal,'stage.globalToLocal');
      method(stage.getObjectUnderPoint,j.Container.prototype.getObjectUnderPoint,'stage.getObjectUnderPoint');
      const position=stage.globalToLocal(point.x,point.y);
      if(![position.x,position.y,stage.canvas?.width,stage.canvas?.height].every(Number.isFinite)||
         position.x<0||position.y<0||position.x>=stage.canvas.width||position.y>=stage.canvas.height)
        return wait('actual-hit-outside-owned-stage');
      const target=stage.getObjectUnderPoint(position.x,position.y,2);
      if(!target||!ancestorOf(native,target))return wait('actual-native-hit-test-does-not-target-hitBanner');
      method(target.dispatchEvent,j.EventDispatcher.prototype.dispatchEvent,'original-createjs-dispatchEvent');
      const event=new j.MouseEvent('mousedown',true,false,position.x,position.y,null,-1,true,position.x,position.y);
      assert.equal(Object.getPrototypeOf(event),j.MouseEvent.prototype,'OWN32816_FREE_INTRO_ORIGINAL_MOUSE_EVENT');
      /* Mark BEFORE input. A throwing input is retained unknown and never retried. */
      const record={outcome:'input-started'};attempted.set(paidIntent,record);attempts++;
      try{target.dispatchEvent(event);record.outcome='native-mousedown-dispatched';dispatched++;}
      catch(error){record.outcome='input-execution-unknown';unknown++;sealed=true;throw error;}
      return Object.freeze({status:'dispatched',eventType:'mousedown',originalCreateJSMouseEvent:true,originalHitTestTarget:true,
        stageX:position.x,stageY:position.y,gameEventDirectDispatch:false,gameStateWrites:false});
    },
    seal(){sealed=true;},
    status(){return {schema:'own32816-free-intro-native-input-v1',sealed,waits,attempts,dispatched,unknown,
      oncePerOriginalPaidIntent:true,gameEventDirectDispatch:false,gameStateWrites:false,productionReady:false};}
  });
};
