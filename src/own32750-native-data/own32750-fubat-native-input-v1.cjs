'use strict';
const assert=require('node:assert/strict');
// Own 32750 native UI input DATA only. No result sequence, money, request or terminal authority.
exports.createOwn32750FuBatNativeInput=function({host,emitOriginalMouse}){
 assert(host&&typeof emitOriginalMouse==='function','OWN32750_FUBAT_OWNED_HOST_REQUIRED');
 let inputs=0,lastCoin=null;
 function number(v){return typeof v==='number'&&Number.isFinite(v);}
 function bounds(region){
  for(const k of ['getX','getY','getWidth','getHeight'])if(typeof region?.[k]!=='function')return null;
  const r={x:region.getX(),y:region.getY(),width:region.getWidth(),height:region.getHeight()};
  if(!Object.values(r).every(number)||r.width<=0||r.height<=0)return null;
  return r;
 }
 function pump(){
  const v=host.main?.uiController?.fubatjackpotview;
  if(!v||v.isHistoryReplay!==false||v.isfubatAllowed!==true||v.twoClickFlag!==false)return false;
  if(v.pickedLen===0)return false;
  assert(Number.isSafeInteger(v.pickedLen)&&v.pickedLen>0,'OWN32750_FUBAT_NATIVE_PICK_STATE');
  assert(Array.isArray(v.coinIcons)&&v.coinIcons.length>0&&v.coinIcons.length<=64&&v.pickedLen<=v.coinIcons.length,'OWN32750_FUBAT_ORIGINAL_COINS');
  for(const k of ['coinClicked','coinAnimClicked'])assert(Array.isArray(v[k]),'OWN32750_FUBAT_ORIGINAL_PICK_FLAGS');
  const index=v.coinIcons.findIndex((a,i)=>v.coinClicked[i]===false&&v.coinAnimClicked[i]===false);
  assert(index>=0,'OWN32750_FUBAT_UNPICKED_NATIVE_COIN_REQUIRED');
  const actor=v.coinIcons[index],image=actor?.getImage?.(),Rect=host.scope?.exports?.get('abg2d/abg2d')?.Rect;
  assert(image&&typeof image.getDrawBounds==='function'&&typeof Rect==='function','OWN32750_FUBAT_NATIVE_DISPLAY_OBJECT');
  const draw=new Rect();image.getDrawBounds(draw);
  assert([draw.x,draw.y,draw.width,draw.height].every(number)&&draw.width>0&&draw.height>0,'OWN32750_FUBAT_NATIVE_DISPLAY_BOUNDS');
  const ih=v.inputHandler,canvas=host.main.scene.getCanvas().getCanvas();
  assert(ih?.canvas===canvas&&Array.isArray(ih.resolvers)&&ih.resolvers.length<=256,'OWN32750_FUBAT_ORIGINAL_INPUT_HANDLER');
  const matches=[];
  for(const resolver of ih.resolvers){
   if(!resolver.active)continue;
   assert(Array.isArray(resolver.inputRegions)&&resolver.inputRegions.length<=128,'OWN32750_FUBAT_ORIGINAL_INPUT_REGIONS');
   for(const region of resolver.inputRegions){
    const r=bounds(region);
    if(r&&r.x===draw.x&&r.y===draw.y&&r.width===draw.width&&r.height===draw.height){
     assert(typeof region.isActive==='function'&&region.isActive()===true,'OWN32750_FUBAT_ORIGINAL_REGION_INACTIVE');
     assert(typeof resolver.checkResolverBounds==='function'&&resolver.checkResolverBounds(r.x+r.width/2,r.y+r.height/2),'OWN32750_FUBAT_RESOLVER_BOUNDS_MISMATCH');
     matches.push(r);
    }
   }
  }
  assert(matches.length===1,'OWN32750_FUBAT_UNIQUE_ORIGINAL_HIT_REGION_REQUIRED');
  const sx=ih.coordinateScalarX,sy=ih.coordinateScalarY,css=canvas.getBoundingClientRect();
  assert(number(sx)&&sx>0&&number(sy)&&sy>0&&number(css?.left)&&number(css?.top),'OWN32750_FUBAT_REAL_POINTER_COORDINATES_REQUIRED');
  const r=matches[0],client={x:css.left+r.x/sx,y:css.top+r.y/sy,width:r.width/sx,height:r.height/sy};
  // Original InputHandler maps (client - canvas.left/top) * coordinateScalar.
  // coinIcons are deliberately hidden by original SDK; do not gate their hit area by visibility.
  emitOriginalMouse(client);
  assert(host.main.uiController.fubatjackpotview===v&&
   (v.coinAnimClicked[index]===true||v.coinClicked[index]===true),
   'OWN32750_FUBAT_ORIGINAL_POINTER_NOT_ACCEPTED');
  inputs++;lastCoin=index;return true;
 }
 return Object.freeze({pump,summary:()=>({policy:'own32750-original-FuBat-hit-region-native-pointer-v1',inputs,lastCoin,resultSequenceRead:false,privateGameMethodsCalled:false})});
};
