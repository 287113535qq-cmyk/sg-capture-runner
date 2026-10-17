'use strict';
const assert=require('node:assert/strict');

/* Own 32806 public native control selection only. The caller owns paid intent. */
exports.selectOwn32806AllowedNativeMenu=function selectOwn32806AllowedNativeMenu(host,selection) {
  assert(selection && typeof selection==='object','OWN32806_EXPLICIT_NATIVE_MENU_SELECTION_REQUIRED');
  const {paylineCount,totalStake}=selection;
  assert(Number.isSafeInteger(paylineCount)&&paylineCount>0,'OWN32806_EXPLICIT_PAYLINE_COUNT_REQUIRED');
  assert(typeof totalStake==='number'&&Number.isFinite(totalStake)&&totalStake>0,'OWN32806_EXPLICIT_TOTAL_STAKE_REQUIRED');
  const sdk=host?.context?.sgigame,own=host?.context?.spartacus_prt,main=host?.outerGame?.main;
  assert(sdk&&own&&typeof own.Game==='function'&&typeof sdk.Main==='function','OWN32806_ORIGINAL_NATIVE_CLASSES_REQUIRED');
  assert.equal(Object.getPrototypeOf(host.outerGame),own.Game.prototype,'OWN32806_ORIGINAL_WRAPPER_IDENTITY_REQUIRED');
  assert.equal(Object.getPrototypeOf(main),sdk.Main.prototype,'OWN32806_ORIGINAL_MAIN_IDENTITY_REQUIRED');
  assert.equal(main.startAutoplay,sdk.Main.prototype.startAutoplay,'OWN32806_ORIGINAL_PUBLIC_ACTION_IDENTITY_REQUIRED');
  assert(Array.isArray(host.pending)&&host.pending.length===0,'OWN32806_PENDING_REQUEST_MUST_BE_RETAINED');
  const instances=main?._context?.injector?.singletonMap;
  assert(Array.isArray(instances),'OWN32806_ORIGINAL_INJECTOR_REQUIRED');
  function one(Original,label) {
    assert.equal(typeof Original,'function','OWN32806_ORIGINAL_CLASS_REQUIRED '+label);
    const rows=instances.filter(x=>x.instance instanceof Original);
    assert.equal(rows.length,1,'OWN32806_EXACTLY_ONE_NATIVE_INSTANCE_REQUIRED '+label);
    assert.equal(Object.getPrototypeOf(rows[0].instance),Original.prototype,'OWN32806_ORIGINAL_PROTOTYPE_REQUIRED '+label);
    return rows[0].instance;
  }
  const state=one(sdk.GameStateModel,'GameStateModel');
  const lines=one(sdk.PayLineCountController,'PayLineCountController');
  const bets=one(sdk.BetController,'BetController');
  for(const [instance,Original,names]of [
    [state,sdk.GameStateModel,['getCurrentState','getSubGame']],
    [lines,sdk.PayLineCountController,['getLines','getCurrentLine','setCurrentLineIndex','dispatchLineCountChange']],
    [bets,sdk.BetController,['getBets','getCurrentBet','setBetIndex']]
  ])for(const name of names)assert.equal(instance[name],Original.prototype[name],'OWN32806_ORIGINAL_METHOD_IDENTITY_REQUIRED '+name);
  const originalState=state.getCurrentState(),originalSubGame=state.getSubGame();
  assert.equal(originalState?.stateName,sdk.BaseGameStates.IDLE_STATE,'OWN32806_NATIVE_IDLE_REQUIRED');
  assert.equal(originalSubGame,sdk.SubGames.BASE_GAME,'OWN32806_NATIVE_BASE_GAME_REQUIRED');
  const lineMenu=lines.getLines(),betMenus=bets.getBets();
  assert(Array.isArray(lineMenu)&&Array.isArray(betMenus),'OWN32806_ORIGINAL_INIT_MENUS_REQUIRED');
  const lineIndex=lineMenu.indexOf(paylineCount);
  assert(lineIndex>=0,'OWN32806_PAYLINE_COUNT_NOT_IN_OWN_INIT_MENU');
  const menu=betMenus[lineIndex];
  assert(Array.isArray(menu),'OWN32806_OWN_LINE_BET_MENU_REQUIRED');
  const betIndex=menu.findIndex(b=>b.getTotalBet()===totalStake);
  assert(betIndex>=0,'OWN32806_STAKE_NOT_IN_OWN_INIT_MENU');
  const before={paylineCount:lines.getCurrentLine(),totalStake:bets.getCurrentBet().getTotalBet()};
  /* Exact V7 original-controller call order; no game-state or private-field writes. */
  lines.setCurrentLineIndex(lineIndex);
  bets.setBetIndex(betIndex);
  lines.dispatchLineCountChange();
  assert.equal(lines.getCurrentLine(),paylineCount,'OWN32806_NATIVE_LINE_SELECTION_NOT_APPLIED');
  assert.equal(bets.getCurrentBet().getTotalBet(),totalStake,'OWN32806_NATIVE_BET_SELECTION_NOT_APPLIED');
  assert.equal(state.getCurrentState(),originalState,'OWN32806_MENU_SELECTION_CHANGED_GAME_STATE');
  assert.equal(state.getSubGame(),originalSubGame,'OWN32806_MENU_SELECTION_CHANGED_SUB_GAME');
  assert.equal(host.pending.length,0,'OWN32806_MENU_SELECTION_EMITTED_REQUEST');
  return Object.freeze({gameId:'32806',before,selected:{paylineCount,totalStake},lineIndex,betIndex,
    ownInitAllowed:true,originalControllerMethods:true,gameStateWrites:false,paidActionStarted:false});
};
