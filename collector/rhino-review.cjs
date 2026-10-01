// Independent full settlement check; source admission is separate.
const {XMLParser,XMLValidator}=require('fast-xml-parser');
const assert=require('node:assert/strict');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',attributesGroupName:'$',parseTagValue:false,trimValues:true});
const uint=v=>{assert(/^(0|[1-9]\d*)$/.test(String(v))&&Number.isSafeInteger(Number(v)),'INTEGER');return Number(v);};
const one=v=>{assert(v!==undefined&&v!==null&&!Array.isArray(v),'STRUCTURE');return v;};
const a=v=>one(one(v).$),list=v=>v===undefined?[]:Array.isArray(v)?v:[v];
function xml(s){assert(typeof s==='string'&&s.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s)&&XMLValidator.validate(s)===true,'XML');return parser.parse(s);}
function review(raw,{legacy=false}={}){
 assert(raw.sourceKey==='ragingrhino-wms-v1'&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','PROFILE');
 assert(raw.steps.length>=2&&raw.steps.length<=1026,'STEP_LIMIT');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,first=0,total=0,free=false,retriggers=0,session,identity,base;
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i],end=i===raw.steps.length-1,msg=end?'EndGame':'Logic';assert.equal(s.msgId,msg,'SEQUENCE');
  const q=one(xml(s.requestPayload).GameRequest),r=one(xml(s.responseXml).GameResponse);assert.deepEqual(r,one(xml(s.responsePayload).GameResponse),'XML_EVIDENCE');assert.equal(a(q).type,msg);assert.equal(a(r).type,msg);
  const qh=a(q.Header),rh=a(r.Header);assert(qh.freePlay==='Y'&&qh.gameID==='20124'&&qh.gameCodeRGI==='ragingrhino_prt'&&qh.versionID==='1_0'&&qh.promotions==='N'&&qh.lang==='en_US'&&qh.userType==='C'&&qh.channel==='I','MODE');
  assert(rh.gameID==='20124'&&rh.versionID==='1_0'&&rh.isRecovering==='N'&&typeof rh.sessionID==='string'&&rh.sessionID.length>0&&rh.sessionID.length<=1024,'RESPONSE_IDENTITY');
  assert(typeof qh.sessionID==='string'&&qh.sessionID.length>0&&qh.sessionID.length<=1024&&(!session||session===qh.sessionID),'SESSION');session=rh.sessionID;
  const id=JSON.stringify(Object.entries(qh).filter(([k])=>k!=='sessionID').sort());assert(!identity||id===identity,'IDENTITY');identity=id;
  if(end){assert(q.WagerInfo===undefined&&q.AccountData===undefined&&r.GameResult===undefined,'END');assert(!free||i===total+1,'INCOMPLETE');}
  else{
   if(!(legacy&&i>0&&q.WagerInfo===undefined)){assert.deepEqual(a(q.WagerInfo),{betMultiplier:'1'});assert(legacy&&q.AccountData===''||one(q.AccountData).CurrencyMultiplier==='1','CURRENCY');}
   const g=one(r.GameResult),ga=a(g),info=a(g.GameWinInfo);assert(ga.stake==='40'&&ga.creditBet==='40'&&ga.betMultiplier==='1'&&ga.waysCount==='4096','STAKE');
   if(!i)base={$:ga,ReelResults:g.ReelResults};
   if(g.BaseGameRecoveryInfo!==undefined){assert(i>0,'BASE_RECOVERY');const b=one(g.BaseGameRecoveryInfo);assert.deepEqual(Object.keys(b),['GameResult'],'BASE_RECOVERY');assert.deepEqual(one(b.GameResult),base,'BASE_RECOVERY');}
   const award=uint(ga.totalWin);if(i===0){balance-=40;first=award;}balance+=award;win+=award;uint(balance);uint(win);
   assert(info.isMaxWin==='N'&&uint(info.totalBaseGameWin)===first&&uint(info.totalFreeSpinsWin)===win-first&&uint(info.totalWagerWin)===win,'TOTAL');
   let awarded=0,guarantee=0;const features=list(g.Feature);assert(new Set(features.map(f=>a(f).index)).size===features.length,'FEATURE_DUPLICATE');const fs=features.filter(f=>a(f).index==='1');
   if(i===0)free=fs.length===1;
   for(const f of features){if(a(f).index==='1')assert(a(f).name==='FreeSpins');else if(a(f).index==='3'){assert.deepEqual(a(f),{index:'3',name:'BonusGuarantee'});assert.deepEqual(Object.keys(f).sort(),['$','data']);const d=a(f.data);assert.deepEqual(Object.keys(f.data),['$']);assert(i>0&&free&&Object.keys(d).join()==='bonusAwarded','GUARANTEE_SHAPE');guarantee=uint(d.bonusAwarded);assert(guarantee>0,'GUARANTEE_AMOUNT');}else{assert.deepEqual(a(f),{index:'2',name:'WildInfo'});const d=a(f.data);assert(i>0&&free&&Object.keys(d).join()==='multiplier');const m=d.multiplier.split(',');assert(m.every(v=>/^(0|[1-9]\d*)\|[23]$/.test(v)&&Number(v.split('|')[0])<24)&&new Set(m.map(v=>v.split('|')[0])).size===m.length,'WILD');}}
   if(free){assert.equal(fs.length,1);const d=a(fs[0].data),keys=Object.keys(d).sort().join();assert.equal(keys,i?'extraFreeSpinsAwarded,freeSpinsTriggerWin,lastFreeSpin,remainingFreeSpins,totalFreeSpinsTriggered':'freeSpinsTriggerWin,lastFreeSpin,totalFreeSpinsTriggered');
    const extra=i?uint(d.extraFreeSpinsAwarded):uint(d.totalFreeSpinsTriggered);awarded=extra;uint(d.freeSpinsTriggerWin);assert(!i||i<=total,'AFTER_TERMINAL');assert((i>0||extra>0)&&extra<=1024,'AWARD');if(i&&extra)retriggers++;total+=extra;assert(total<=1024&&uint(d.totalFreeSpinsTriggered)===total&&(!i||uint(d.remainingFreeSpins)===total-i),'COUNTERS');assert.equal(d.lastFreeSpin,i<total?'N':'Y','TERMINAL');
   }else assert(i===0&&features.length===0,'FEATURE');
   assert(!guarantee||free&&i>0&&i===total&&awarded===0,'GUARANTEE_TERMINAL');
   const reels=one(g.ReelResults),spin=one(reels.ReelSpin),sa=a(spin);assert(a(reels).numSpins==='1'&&sa.freeSpin===(i?'Y':'N')&&sa.bonusAwarded===(awarded||guarantee?'Y':'N'),'REELS');
   assert(uint(sa.totalSpinWin)+guarantee===award&&uint(sa.totalScatterWin)+uint(sa.totalWayWin)+guarantee===award,'REEL_MONEY');
   for(const [tag,count,money]of[['AnywayWin','anywayWinCount','totalWayWin'],['ScatterWin','scatterWinCount','totalScatterWin']]){const wins=list(spin[tag]);assert(wins.length===uint(sa[count])&&wins.reduce((s,n)=>s+uint(a(n).winVal),0)===uint(sa[money]),'WIN_MONEY');}
  }
  const ba=a(one(r.Balances).Balance);assert.deepEqual(ba,{name:'CASH_BALANCE',value:String(balance)});assert.equal(uint(s.responseBalance),balance,'BALANCE');
 }
 return {next:null,start,end:balance,win,betRaw:40,bonus:Number(free),retriggers};
}
module.exports={review};
