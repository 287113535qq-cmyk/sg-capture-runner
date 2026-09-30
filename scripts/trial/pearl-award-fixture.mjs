// Synthetic only; parameterized free-count conservation cases.
import {pearlHeader,attributes} from './pearl-retrigger-fixture.mjs';
import {PEARL_SOURCE} from './pearl-award-protocol.mjs';
export function awardFixture(initial,adds={}){
 let balance=100000,win=0,total=0;
 const raw={fixtureOnly:false,protocol:'wms',sourceKey:PEARL_SOURCE,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:balance,steps:[]};
 for(let i=0;i<=total+1;i++){
  const end=i>total&&i>0,added=end?0:i===0?initial:adds[i]??0;total+=added;const award=!end&&i===3?400:0;win+=award;if(i===0)balance-=200;balance+=award;
  const msg=end?'EndGame':'Logic',requestPayload=`<GameRequest type="${msg}"><Header ${attributes(pearlHeader('synthetic-'+i))}/>${end?'':'<Stake total="200" isBigBet="0"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>'}</GameRequest>`;
  const result=end?'':`<GameResult stake="200" stakePerLine="4" paylineCount="50" totalWin="${award}" betID=""><BGInfo baseGameSpinsRemaining="0" bgWinnings="0" isBigBet="0" isMaxWin="0" totalWagerWin="${win}"/><FSInfo freeSpinNumber="${i}" freeSpinsAwarded="${added}" freeSpinsTotal="${total}" fsWinnings="${win}" isMaxWin="0"/><ReelResults numSpins="5">${Array.from({length:5},(_,j)=>`<ReelSpin bonusAwarded="${added?'Y':'N'}" freeSpin="${i?'Y':'N'}" spinIndex="${j}" reelsetIndex="0" spinWins="${j?0:award}" winCountPL="0" winCountSC="0"><ReelStops>0,0,0,0,0</ReelStops></ReelSpin>`).join('')}</ReelResults></GameResult>`;
  const responsePayload=`<GameResponse type="${msg}"><Header sessionID="synthetic-${i+1}" gameID="20327" versionID="1_0" isRecovering="N" readyForEndGame="${!end&&i===total?'Y':'N'}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances>${result}</GameResponse>`;
  raw.steps.push({msgId:msg,requestPayload,responsePayload,responseXml:responsePayload,responseBalance:balance,elapsedMs:1});if(end)break;
 }return raw;
}
