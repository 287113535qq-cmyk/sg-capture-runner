import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {settledFields, ROUND_FIELDS_VERSION} from './sg.fields';

const SOURCE='pearlofthecaribbean-wms-v1';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',attributesGroupName:'$',parseTagValue:false,trimValues:true});
const check=(ok:any,code:string):void=>{if(!ok)throw new Error(code);};
const integer=(n:any):number=>{check((typeof n==='string'&&/^(0|[1-9]\d*)$/.test(n)||typeof n==='number')&&Number.isSafeInteger(Number(n))&&Number(n)>=0,'SG_PEARL_MONEY');return Number(n);};
function parse(text:any):any {check(typeof text==='string'&&text.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(text)&&XMLValidator.validate(text)===true,'SG_PEARL_XML');return parser.parse(text);}
function one(value:any):any {check(value!==undefined&&value!==null&&!Array.isArray(value),'SG_PEARL_STRUCTURE');return value;}
function attrs(value:any):any {return one(one(value).$);}

/** Independent collector settlement/mapping checks. Runner also validates the
 * full accepted XML schema and Python independently verifies every record. */
export function pearlFields(raw:any,mapping:{buy:number;bonus:number;typeMappingHash:string}) {
 check(raw?.protocol==='wms'&&raw.fixtureOnly===false&&raw.sourceKey===SOURCE&&raw.roundFieldsVersion===ROUND_FIELDS_VERSION,'SG_PEARL_PROFILE');
 check(Array.isArray(raw.steps)&&[2,10].includes(raw.steps.length),'SG_PEARL_INCOMPLETE');
 const free=raw.steps.length===10;
 let balance=integer(raw.startBalanceRaw),win=0,first=0,session:string|undefined;
 let identity:string|undefined;
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i],end=i===raw.steps.length-1,msg=end?'EndGame':'Logic';
  check(s.msgId===msg,'SG_PEARL_SEQUENCE');
  const q=one(parse(s.requestPayload).GameRequest),r=one(parse(s.responsePayload).GameResponse);
  check(JSON.stringify(r)===JSON.stringify(one(parse(s.responseXml).GameResponse)),'SG_PEARL_XML_EVIDENCE');
  check(attrs(q).type===msg&&attrs(r).type===msg,'SG_PEARL_MESSAGE');
  const qh=attrs(q.Header),rh=attrs(r.Header);
  check(qh.gameID==='20327'&&rh.gameID==='20327'&&qh.freePlay==='Y'&&qh.gameCodeRGI==='pearlofthecaribbean'
   &&qh.promotions==='N'&&rh.isRecovering==='N','SG_PEARL_MODE');
  check(typeof qh.sessionID==='string'&&qh.sessionID.length>0&&typeof rh.sessionID==='string'&&rh.sessionID.length>0
   &&(session===undefined||qh.sessionID===session),'SG_PEARL_SESSION');session=rh.sessionID;
  const id=JSON.stringify(Object.entries(qh).filter(([k])=>k!=='sessionID').sort());
  check(identity===undefined||identity===id,'SG_PEARL_IDENTITY');identity=id;
  if(end){check(q.Stake===undefined&&q.AccountData===undefined&&r.GameResult===undefined&&rh.readyForEndGame==='N','SG_PEARL_ENDGAME');}
  else {
   const st=attrs(q.Stake);check(st.total==='200'&&st.isBigBet==='0'&&one(q.AccountData).CurrencyMultiplier==='1','SG_PEARL_STAKE');
   const result=one(r.GameResult),ra=attrs(result),bg=attrs(result.BGInfo);
   check(ra.stake==='200'&&ra.stakePerLine==='4'&&ra.paylineCount==='50','SG_PEARL_STAKE');
   const award=integer(ra.totalWin);if(i===0){balance-=200;first=award;}balance+=award;win+=award;integer(balance);integer(win);
   check(bg.isBigBet==='0'&&bg.isMaxWin==='0'&&bg.baseGameSpinsRemaining==='0','SG_PEARL_FEATURE');
   check(integer(bg.bgWinnings)===first&&integer(bg.totalWagerWin)===win,'SG_PEARL_TOTAL');
   if(free){const fs=attrs(result.FSInfo);check(fs.isMaxWin==='0'&&fs.freeSpinsTotal==='8'&&fs.freeSpinNumber===String(i)
    &&fs.freeSpinsAwarded===(i?'0':'8')&&integer(fs.fsWinnings)===win-first,'SG_PEARL_FREE_COUNTER');}
   else check(result.FSInfo===undefined,'SG_PEARL_FEATURE');
   check(rh.readyForEndGame===(free&&i<8?'N':'Y'),'SG_PEARL_TERMINAL');
   const reels=one(result.ReelResults),spins=reels.ReelSpin;
   check(attrs(reels).numSpins==='5'&&Array.isArray(spins)&&spins.length===5,'SG_PEARL_REELS');
   check(spins.every((n:any)=>attrs(n).freeSpin===(i?'Y':'N'))&&spins.reduce((a:number,n:any)=>a+integer(attrs(n).spinWins),0)===award,'SG_PEARL_REEL_MONEY');
  }
  const b=attrs(one(r.Balances).Balance);check(b.name==='CASH_BALANCE'&&integer(b.value)===balance&&integer(s.responseBalance)===balance,'SG_PEARL_BALANCE');
 }
 check(mapping.buy===0&&mapping.bonus===Number(free)&&/^[a-f0-9]{64}$/.test(mapping.typeMappingHash),'SG_PEARL_MAPPING');
 const fields=settledFields(integer(raw.startBalanceRaw),balance,win,0,Number(free));
 check(fields.money.betRaw===200,'SG_PEARL_WAGER');
 return {...fields,protocol:'wms',sourceKey:SOURCE,primaryBonusKind:free?'freeGame':'none',typeMappingHash:mapping.typeMappingHash};
}
