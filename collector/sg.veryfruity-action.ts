/** Independent original XML and money evidence. No gameplay whitelist or source admission. */
import {XMLParser,XMLValidator} from 'fast-xml-parser';
const SOURCE='veryfruity-wms-action-v1',VERSION='veryfruity-action-v1';
const HASH='04afbd9bb13aeb75ad24aa8ff21e5e01323602435e7c097cf13c1c525f8f05fb';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',attributesGroupName:'$',parseTagValue:false,trimValues:false});
const need=(v:any,k:string):void=>{if(!v)throw Error(k);};
const one=(v:any):any=>{need(v!==undefined&&v!==null&&!Array.isArray(v),'VERYFRUITY_STRUCTURE');return v;};
const attrs=(v:any):any=>one(one(v).$);
const eq=(a:any,b:any)=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
const number=(v:any):number=>{need(typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v)&&v.length<=16&&Number.isSafeInteger(Number(v)),'VERYFRUITY_INTEGER');return Number(v);};
const numeric=(v:any):number=>{need(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0,'VERYFRUITY_NUMBER');return v;};
const parse=(s:any):any=>{need(typeof s==='string'&&s.length>0&&s.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s)&&XMLValidator.validate(s)===true,'VERYFRUITY_XML');return parser.parse(s);};
const headerKeys='affiliate ccyCode channel freePlay gameCodeRGI gameID glsID lang promotions userID userType versionID'.split(' ').sort();
function routes(node:any):void{
 if(!node||typeof node!=='object')return;
 for(const [k,v] of Object.entries(node)){
  need(!['Error','Errors','Pick','Gamble','Choice','BonusWin'].includes(k),'VERYFRUITY_UNKNOWN_ROUTE');
  if(k!=='$')if(Array.isArray(v))v.forEach(routes);else routes(v);
 }
}
export function veryFruityActionFields(raw:any,plan:any){
 need(plan.gameId===32812&&plan.runtimeGameId===33172&&plan.sourceKey===SOURCE&&plan.adapter===SOURCE
  &&plan.featureProfile===VERSION&&plan.actionContractHash===HASH&&plan.buy===0&&plan.mode==='demo'&&plan.betRaw===20,'VERYFRUITY_ACTION_PROFILE');
 const h=plan.requestHeader;need(h&&Object.keys(h).sort().join(',')===headerKeys.join(',')&&Object.values(h).every(v=>typeof v==='string'&&v.length<=1024)
  &&h.gameCodeRGI==='veryfruity'&&h.gameID==='20206'&&h.versionID==='1_0'&&h.freePlay==='Y'&&h.promotions==='N','VERYFRUITY_IDENTITY');
 need(raw.fixtureOnly===false&&raw.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.roundFieldsVersion==='sg-round-fields-v1'
  &&raw.requestFlowVersion===VERSION&&raw.actionContractHash===HASH,'VERYFRUITY_ACTION_RAW');
 need(Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=1026,'VERYFRUITY_ACTION_STEPS');
 const start=numeric(raw.startBalanceRaw);need(start>=20,'VERYFRUITY_ACTION_START');
 let following:string|null='Logic',session:string|undefined,total=0,balance=0,free:{current:number;total:number}|undefined;
 for(const s of raw.steps){
  need(following!==null&&s.msgId===following&&s.responsePayload===s.responseXml,'VERYFRUITY_ACTION_SEQUENCE');
  need(numeric(s.elapsedMs)<=300000,'VERYFRUITY_TIMING');
  const qp=parse(s.requestPayload),rp=parse(s.responseXml);need(Object.keys(qp).filter(k=>k!=='?xml').join(',')==='GameRequest'&&Object.keys(rp).filter(k=>k!=='?xml').join(',')==='GameResponse','VERYFRUITY_ROOT');
  const q=one(qp.GameRequest),r=one(rp.GameResponse),qh=attrs(q.Header),rh=attrs(r.Header);
  need(eq(attrs(q),{type:following})&&eq(attrs(r),{type:following}),'VERYFRUITY_ACTION_SEQUENCE');
  need(Object.keys(qh).sort().join(',')===[...headerKeys,'sessionID'].sort().join(',')&&Object.entries(h).every(([k,v])=>qh[k]===v)
   &&['gameID','versionID','ccyCode','lang'].every(k=>rh[k]===h[k])&&rh.isRecovering==='N','VERYFRUITY_IDENTITY');
  need([qh.sessionID,rh.sessionID].every(v=>typeof v==='string'&&v.length>0&&v.length<=1024)&&(session===undefined||session===qh.sessionID),'VERYFRUITY_SESSION');session=rh.sessionID;
  routes(r);const logic=following==='Logic';
  need(Object.keys(q).filter(k=>k!=='$').sort().join(',')===(logic?'AccountData,Header,PaylineCount,Stake':'AccountData,Header'),'VERYFRUITY_REQUEST');
  const account=one(q.AccountData);need(Object.keys(account).join(',')==='CurrencyMultiplier'&&account.CurrencyMultiplier==='1','VERYFRUITY_CURRENCY');
  if(logic){
   need(eq(attrs(q.Stake),{perLine:'1',total:'20'})&&eq(attrs(q.PaylineCount),{count:'20'}),'VERYFRUITY_STAKE');
   const g=one(r.GameResult),ga=attrs(g),bg=attrs(g.BGInfo);
   need(ga.stake==='20'&&ga.stakePerLine==='1'&&ga.paylineCount==='20'&&typeof ga.betID==='string'&&ga.betID.length>0&&ga.betID.length<=256,'VERYFRUITY_STAKE');
   total=numeric(total+number(ga.totalWin));need(number(bg.totalWagerWin)===total&&bg.isMaxWin==='0'&&bg.mysterySymbol==='0','VERYFRUITY_TOTAL');
   // No nested or duplicate FSInfo may silently replace the selected route.
   const fsNodes:any[]=[];const visit=(n:any)=>{if(!n||typeof n!=='object')return;for(const [k,v] of Object.entries(n)){if(k==='FSInfo')fsNodes.push(v);if(k!=='$')Array.isArray(v)?v.forEach(visit):visit(v);}};visit(g);
   need(fsNodes.length<=1&&(fsNodes.length===0||fsNodes[0]===g.FSInfo),'VERYFRUITY_FREE_AMBIGUOUS');
   if(g.FSInfo===undefined){need(free===undefined,'VERYFRUITY_FREE_MISSING');following='EndGame';}
   else{
    const f=one(g.FSInfo);need(Object.keys(f).join(',')==='$','VERYFRUITY_FREE_STRUCTURE');const fa=attrs(f),current=number(fa.freeSpinNumber),count=number(fa.freeSpinsTotal);
    need(count>0&&count<=1026&&current<=count&&(free?current===free.current+1&&count>=free.total:current===0),'VERYFRUITY_FREE_PROGRESS');
    free={current,total:count};following=current===count?'EndGame':'Logic';
   }
  }else{need(r.GameResult===undefined,'VERYFRUITY_ENDGAME');following=null;}
  const balances=one(r.Balances);need(Object.keys(balances).join(',')==='Balance','VERYFRUITY_BALANCE');const cash=one(balances.Balance),ba=attrs(cash);
  need(Object.keys(cash).join(',')==='$'&&Object.keys(ba).sort().join(',')==='name,value'&&ba.name==='CASH_BALANCE','VERYFRUITY_BALANCE');
  balance=number(ba.value);need(balance===start-20+total,'VERYFRUITY_MOVEMENT');
  if(s.responseBalance!==undefined)need(numeric(s.responseBalance)===balance,'VERYFRUITY_RESPONSE_BALANCE');
 }
 need(following===null,'VERYFRUITY_INCOMPLETE');
 return {roundFieldsVersion:'sg-round-evidence-v2',protocol:'wms',sourceKey:SOURCE,bet:0.2,mul:total/20,buy:0,bonus:null,
  primaryBonusKind:null,classificationStatus:'pending',typeMappingHash:HASH,requestFlowVersion:VERSION,
  money:{startBalanceRaw:start,endBalanceRaw:balance,totalWinRaw:total,betRaw:20}};
}
