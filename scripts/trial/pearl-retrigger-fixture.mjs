// Entirely synthetic WMS traffic; never a source credential or live session.
import {PEARL_SOURCE} from './pearl-retrigger-protocol.mjs';
export const pearlHeader=session=>({affiliate:'offline',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'pearlofthecaribbean',gameID:'20327',glsID:'offline',lang:'en_US',promotions:'N',sessionID:session,userID:'offline',userType:'C',versionID:'1_0'});
export const attributes=values=>Object.entries(values).map(([k,v])=>`${k}="${v}"`).join(' ');
export function retriggerFixture(free=true){
 let balance=100000,total=0;
 const raw={fixtureOnly:false,protocol:'wms',sourceKey:PEARL_SOURCE,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:balance,steps:[]};
 for(let i=0;i<(free?18:2);i++){
  const end=i===(free?17:1),msg=end?'EndGame':'Logic',award=end?0:free?(i===3?400:0):400;
  if(i===0)balance-=200;balance+=award;total+=award;
  const requestPayload=`<GameRequest type="${msg}"><Header ${attributes(pearlHeader('synthetic-'+i))}/>${end?'':'<Stake total="200" isBigBet="0"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>'}</GameRequest>`;
  const result=end?'':`<GameResult stake="200" stakePerLine="4" paylineCount="50" totalWin="${award}" betID=""><BGInfo baseGameSpinsRemaining="0" bgWinnings="${free?0:400}" isBigBet="0" isMaxWin="0" totalWagerWin="${total}"/>${free?`<FSInfo freeSpinNumber="${i}" freeSpinsAwarded="${i===0||i===7?8:0}" freeSpinsTotal="${i<7?8:16}" fsWinnings="${total}" isMaxWin="0"/>`:''}<ReelResults numSpins="5">${Array.from({length:5},(_,j)=>`<ReelSpin bonusAwarded="${free&&(i===0||i===7)?'Y':'N'}" freeSpin="${i?'Y':'N'}" spinIndex="${j}" reelsetIndex="0" spinWins="${j?0:award}" winCountPL="0" winCountSC="0"><ReelStops>0,0,0,0,0</ReelStops></ReelSpin>`).join('')}</ReelResults></GameResult>`;
  const responsePayload=`<GameResponse type="${msg}"><Header sessionID="synthetic-${i+1}" gameID="20327" versionID="1_0" isRecovering="N" readyForEndGame="${end?'N':free&&i<16?'N':'Y'}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances>${result}</GameResponse>`;
  raw.steps.push({msgId:msg,requestPayload,responsePayload,responseXml:responsePayload,responseBalance:balance,elapsedMs:1});
 }
 return raw;
}
