"use strict";
const assert=require('node:assert/strict');
exports.createOwn32750ScenePresentation=function({readScene,flushDirty}) {
 assert.equal(typeof readScene,'function');assert.equal(typeof flushDirty,'function');
 let hiddenTicks=0,inputFrames=0;
 function originalScene(){
  const scene=readScene();assert(scene&&typeof scene.getVisible==='function'&&typeof scene.setVisible==='function'&&typeof scene.refresh==='function','OWN32750_ORIGINAL_SCENE_PRESENTATION_API_REQUIRED');
  assert.equal(typeof scene.getVisible(),'boolean');return scene;
 }
 function tickOriginal(tick){
  assert.equal(typeof tick,'function');const scene=originalScene(),visible=scene.getVisible();
  // Original abg2d Scene.refresh still sorts, updates transforms, and flushes.
  // Its native visibility API suppresses only Scene.render's draw traversal.
  scene.setVisible(false);
  try{hiddenTicks++;return tick();}finally{scene.setVisible(visible);}
 }
 function presentForInput(){
  const scene=originalScene();assert.equal(scene.getVisible(),true,'OWN32750_NATIVE_INPUT_SCENE_NOT_VISIBLE');
  // Input sees a complete original rendered frame at the unchanged native clock.
  scene.refresh();flushDirty();inputFrames++;
 }
 return Object.freeze({tickOriginal,presentForInput,summary:()=>({policy:'original-abg2d-scene-visibility-during-native-ticks-and-full-frame-before-input-v1',hiddenTicks,inputFrames,originalSceneRefreshAndTransformsRetained:true,nativeTickOrGSAPOrProviderStateChanges:false})});
};
