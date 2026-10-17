'use strict';
function createOwn32816OriginalSGMoneyProjection({source,readOwnOriginalUnit}){
 if(!source||typeof source.has!=='function'||typeof source.readEnvelope!=='function'||typeof readOwnOriginalUnit!=='function')throw Error('OWN32816_ORIGINAL_MONEY_AUTHORITY_REQUIRED');
 const rounds=new WeakMap();const need=(v,s)=>{if(!v)throw Error('OWN32816_ORIGINAL_MONEY_'+s)};
 const integer=(v,s)=>{need((typeof v==='string'&&/^\d+$/.test(v))||typeof v==='number'&&Number.isSafeInteger(v),'ACTUAL_INTEGER_'+s);const n=Number(v);need(Number.isSafeInteger(n)&&n>=0,'ACTUAL_SAFE_'+s);return n};
 return function project(ctx){const {frame,sourceInitFrame,game,roundScope,sessionScope}=ctx;
 need(game.gameId==='32816'&&game.dbName==='sg_zeus3_prt'&&game.sg.runtimeGameId===33176&&source.has(frame)&&frame.sessionScope===sessionScope&&frame.game===game&&frame.roundScope===roundScope,'CURRENT_OWN_ORIGINAL_FRAME');
 const e=source.readEnvelope(frame);need(e&&e.type===frame.msgId&&String(e.Header?.gameID)==='20123','ORIGINAL_OWN_ENVELOPE');
 let row=rounds.get(roundScope);if(!row){need(frame.msgId==='Logic','FIRST_ACTUAL_LOGIC');const unit=readOwnOriginalUnit({sourceInitFrame,sessionScope,game});need(unit&&Number.isFinite(unit.factor)&&unit.factor>0&&unit.sourceInitFrame===sourceInitFrame,'OWN_ORIGINAL_UNIT_AUTHORITY');const bet=integer(e.GameResult?.stake,'initial_stake');need(bet>0&&bet===game.sg.betRaw,'ORIGINAL_SELECTED_WAGER');row={startCashRaw:integer(roundScope.startCashRaw,'original_AG_admission_cash'),betRaw:bet,winRaw:undefined,winSourceOrdinal:undefined,factor:unit.factor,frames:[]};rounds.set(roundScope,row)}
 const w=e.GameResult?.GameWinInfo;if(w&&Object.prototype.hasOwnProperty.call(w,'totalWagerWin')){row.winRaw=integer(w.totalWagerWin,'actual_cumulative_wager_win');row.winSourceOrdinal=frame.ordinal}
 const cash=integer(frame.cashRaw,'current_original_cash');need(cash===ctx.currentCashRaw,'ORIGINAL_SOURCE_CASH_ASSOCIATION');
 row.frames.push({msgId:frame.msgId,requestPayload:frame.requestPayload,requestHeaders:frame.requestHeaders,responsePayload:frame.responsePayload,responseHeaders:frame.responseHeaders,httpStatus:frame.httpStatus,sourceOrdinal:frame.ordinal});
 if(ctx.actualNativeEndACK){need(row.winRaw!==undefined,'ACTUAL_CUMULATIVE_WIN_REQUIRED');need(cash===row.startCashRaw-row.betRaw+row.winRaw,'ORIGINAL_CLOSED_BALANCE_EQUATION')}
 const win=row.winRaw===undefined?undefined:row.winRaw/row.factor;
 const out={PlayerBalanceInfo:{preWagerBalance:row.startCashRaw/row.factor,balance:cash/row.factor,wager:row.betRaw/row.factor,...(win===undefined?{}:{resultAmount:win})},capturePlatform:'sg',gameId:33176,runtimeSlug:'zeus3_prt',startBalance:row.startCashRaw/row.factor,endBalance:cash/row.factor,...(win===undefined?{}:{totalWin:win}),SGWireResponse:frame.responsePayload,steps:row.frames.map(x=>({...x})),stepCount:row.frames.length,money:{startBalanceRaw:row.startCashRaw,endBalanceRaw:cash,betRaw:row.betRaw,...(row.winRaw===undefined?{}:{totalWinRaw:row.winRaw,actualWinSourceOrdinal:row.winSourceOrdinal})},SGOwnSDKDecision:{actualNativeEndReturned:ctx.actualNativeEndACK,noDefaultMoney:true,noBonusZeroInserted:true,unitAuthorityProvidedByOriginalOwnSource:true}};
 if(ctx.actualNativeEndACK)rounds.delete(roundScope);return out;
 };
}
module.exports={createOwn32816OriginalSGMoneyProjection};
