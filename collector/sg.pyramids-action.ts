// Complete original traffic and reconciled money. Gameplay analysis is separate.
// This evidence version deliberately has no invented legacy bonus category.
import {XMLParser,XMLValidator} from 'fast-xml-parser';
const ACTION_VERSION='pyramids-action-v1',EVIDENCE_VERSION='sg-round-evidence-v2';
const ACTION_CONTRACT_HASH='48b7828e83ef70533f6c04092946c4bcd9a6ade27ed90a3be3f722f7d04d54cd';
const need=(v:unknown,k:string)=>{if(!v)throw Error(k);};
const own=(v:object,k:string)=>Object.prototype.hasOwnProperty.call(v,k);
function fields(text:unknown,separator='&',equals='='):Record<string,string>{
 need(typeof text==='string','ACTION_PARAMETERS');const out:Record<string,string>=Object.create(null);
 for(const part of (text as string).split(separator).filter(Boolean)){
  const at=part.indexOf(equals),key=part.slice(0,at);
  need(at>=0&&!own(out,key)&&(equals!=='~'||part.lastIndexOf(equals)===at),'ACTION_PARAMETERS');
  out[key]=part.slice(at+1);
 }return out;
}
function integer(v:any):number{need((typeof v==='string'&&/^\d+$/.test(v)||typeof v==='number')
 &&Number.isSafeInteger(Number(v))&&Number(v)>=0,'ACTION_NUMBER');return Number(v);}
const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false});
export function prepareNextgenActionRound(raw:any,plan:any){
 need(plan.gameId===32721&&plan.betRaw===20&&plan.sourceKey==='hyperchargedpyramidsofra96-round-one-base-v1'
  &&plan.featureProfile===ACTION_VERSION&&plan.actionContractHash===ACTION_CONTRACT_HASH,'ACTION_PROFILE_REQUIRED');
 need(raw.sourceKey===plan.sourceKey&&raw.protocol==='nextgen'&&raw.fixtureOnly===false
  &&raw.roundFieldsVersion==='sg-round-fields-v1'&&raw.requestFlowVersion===ACTION_VERSION
  &&raw.actionContractHash===ACTION_CONTRACT_HASH,'ACTION_RAW_CONTRACT_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=100,'ACTION_STEPS');
 const start=integer(raw.startBalanceRaw);need(start>=20,'ACTION_STAKE');
 let active=true,pid:string|undefined,priorWin=0;
 for(const [i,s] of raw.steps.entries()){
  need(active,'ACTION_AFTER_TERMINAL');const msg=i?'FREE_GAME':'BET',q=fields(s.requestPayload),p=fields(s.responsePayload);
  need(s.methodName==='processGameMessage'&&s.msgId===msg&&p.MSGID===msg&&p.IFG===String(Number(i>0)),'ACTION_MESSAGE');
  const expected={...plan.requestParams,MSGID:msg};
  need(Object.keys(q).length===Object.keys(expected).length+1&&Object.entries(expected).every(([k,v])=>q[k]===v)
   &&q.PID?.startsWith('gdmgcm')&&q.PID.length>6&&q.PID.length<512&&(pid===undefined||pid===q.PID),'ACTION_REQUEST');pid=q.PID;
  need(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml)
   &&XMLValidator.validate(s.responseXml)===true,'ACTION_XML');
  const root=parser.parse(s.responseXml).GDMRESPONSE;
  need(root&&Object.keys(root).every(k=>['SUCCESS','PAYLOAD','OGS_RC'].includes(k))
   &&typeof root.SUCCESS==='string'&&root.SUCCESS.toLowerCase()==='true'&&root.PAYLOAD===s.responsePayload
   &&(root.OGS_RC===undefined||root.OGS_RC==='0'),'ACTION_XML_EVIDENCE');
  need((p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0'&&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))
   &&!['CFG','ABPM','SB','JPV'].some(k=>own(p,k)),'ACTION_OTHER_PROTOCOL');
  need(integer(s.elapsedMs)<=300000,'ACTION_TIMING');
  const encoded=p.FID??'',ordinary=!encoded&&!['NFG','TFG','CFGG'].some(k=>own(p,k));
  need(!ordinary||i===0,'ACTION_MISSING_STATE');
  need(ordinary||['0','0|','1','1|','0|1','0|1|'].includes(encoded),'ACTION_FEATURE');
  const n=ordinary?0:integer(p.NFG),t=ordinary?0:integer(p.TFG),c=ordinary?0:integer(p.CFGG);
  need(n+c===t&&t<=100,'ACTION_COUNTERS');const g=fields(p.GSD??'','#','~');
  need(Object.keys(g).every(k=>/^[A-Z][A-Z0-9_]*$/.test(k)),'ACTION_GSD_STRUCTURE');
  active=n>0;
  if(encoded.replace(/\|$/,'')==='0|1'){
   const outerN=integer(g.FGRS),outerT=integer(g.FGTS),outerC=integer(g.CFGC);
   need(outerN+outerC===outerT&&outerT<=100,'ACTION_OUTER_COUNTERS');active=active||outerN>0;
  }
  const b=integer(p.B),ab=integer(p.AB),tw=integer(p.TW);
  need(tw>=priorWin&&b===start-20+tw&&ab>=start-20&&ab<=b,'ACTION_MONEY');priorWin=tw;
  if(own(s,'responseBalance'))need(integer(s.responseBalance)===ab,'ACTION_RESPONSE_BALANCE');
 }
 need(!active,'ACTION_INCOMPLETE_ROUND');const p=fields(raw.steps[raw.steps.length-1].responsePayload);
 const end=Number(p.B),win=Number(p.TW);
 if(![start,end,win].every(Number.isSafeInteger)||Number(p.AB)!==end||start-end+win!==20)
  throw Error('ACTION_UNRECONCILED_SETTLEMENT');
 return {roundFieldsVersion:EVIDENCE_VERSION,protocol:'nextgen',sourceKey:raw.sourceKey,
  bet:20/100,mul:win/20,buy:0,bonus:null,primaryBonusKind:null,classificationStatus:'pending',
  typeMappingHash:ACTION_CONTRACT_HASH,requestFlowVersion:ACTION_VERSION,
  money:{startBalanceRaw:start,endBalanceRaw:end,totalWinRaw:win,betRaw:20}};
}
