// Synthetic protocol fixtures; not official observations.
const a=v=>Object.entries(v).map(([k,v])=>`${k}="${v}"`).join(' ');
export function rhinoFixture(initial,adds={}){const raw={sourceKey:'ragingrhino-wms-v1',protocol:'wms',fixtureOnly:false,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:100000,steps:[]};let total=0;
 for(let i=0;i<=total+1;i++){const end=i>0&&i>total,extra=end?0:i===0?initial:adds[i]??0;total+=extra;const msg=end?'EndGame':'Logic';
 const header={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'ragingrhino_prt',gameID:'20124',glsID:'65535',lang:'en_US',promotions:'N',sessionID:'synthetic-'+i,userID:'null',userType:'C',versionID:'1_0'};
 const requestPayload=`<GameRequest type="${msg}"><Header ${a(header)}/>${end?'':'<WagerInfo betMultiplier="1"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>'}</GameRequest>`;
 const data=i?{extraFreeSpinsAwarded:extra,freeSpinsTriggerWin:0,lastFreeSpin:i===total?'Y':'N',remainingFreeSpins:total-i,totalFreeSpinsTriggered:total}:{freeSpinsTriggerWin:0,lastFreeSpin:'N',totalFreeSpinsTriggered:total};
 const result=end?'':`<GameResult stake="40" totalWin="0" betID="" betMultiplier="1" creditBet="40" waysCount="4096"><GameWinInfo isMaxWin="N" totalBaseGameWin="0" totalFreeSpinsWin="0" totalWagerWin="0"/>${initial?`<Feature index="1" name="FreeSpins"><data ${a(data)}/></Feature>`:""}<ReelResults numSpins="1"><ReelSpin anywayWinCount="0" bonusAwarded="${extra?'Y':'N'}" freeSpin="${i?'Y':'N'}" reelsetIndex="0" scatterWinCount="0" totalScatterWin="0" totalSpinWin="0" totalWayWin="0"><ReelStops>0,0,0,0,0,0</ReelStops></ReelSpin></ReelResults></GameResult>`;
 const responsePayload=`<GameResponse type="${msg}"><Header sessionID="synthetic-${i+1}" gameID="20124" versionID="1_0" isRecovering="N"/><Balances><Balance name="CASH_BALANCE" value="99960"/></Balances>${result}</GameResponse>`;
 raw.steps.push({msgId:msg,requestPayload,responsePayload,responseXml:responsePayload,responseBalance:99960,elapsedMs:1});if(end)break;
 }return raw;}

// Synthetic terminal guarantee: credited once before the separate EndGame acknowledgement.
export function rhinoGuaranteeFixture(initial=8,adds={4:5},guarantee=205){
 const raw=rhinoFixture(initial,adds),terminal=raw.steps.length-2;
 for(let i=terminal;i<raw.steps.length;i++){
  const step=raw.steps[i];let xml=step.responseXml.replace('value="99960"',`value="${99960+guarantee}"`);
  if(i===terminal)xml=xml.replace('totalWin="0"',`totalWin="${guarantee}"`).replace('totalFreeSpinsWin="0"',`totalFreeSpinsWin="${guarantee}"`).replace('totalWagerWin="0"',`totalWagerWin="${guarantee}"`).replace('bonusAwarded="N"','bonusAwarded="Y"').replace('</GameResult>',`<Feature index="3" name="BonusGuarantee"><data bonusAwarded="${guarantee}"/></Feature></GameResult>`);
  step.responseXml=step.responsePayload=xml;step.responseBalance=99960+guarantee;
 }
 return raw;
}
