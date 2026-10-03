import {HUFF_SOURCE,ACTION_VERSION,ACTION_CONTRACT_HASH} from './huff-action-contract.mjs';
export {HUFF_SOURCE,ACTION_VERSION,ACTION_CONTRACT,ACTION_CONTRACT_HASH} from './huff-action-contract.mjs';
import {parseXml,one,children} from './pearl-protocol.mjs';
import {checkFeatureWallet,reviewFeatureValues} from './feature-state.mjs';

const need=(value,code)=>{if(!value)throw Object.assign(Error('HUFF_ACTION_'+code),{code:'HUFF_ACTION_'+code});};
const uint=value=>{need(/^\d+$/.test(String(value))&&Number.isSafeInteger(Number(value)),'NUMBER');return Number(value);};
function pairs(value,separator='&',delimiter='='){
  need(typeof value==='string','PAYLOAD');const result={};
  for(const part of value.split(separator).filter(Boolean)){
    const at=part.indexOf(delimiter),key=part.slice(0,at);
    need(at>0&&!Object.hasOwn(result,key),'AMBIGUOUS_PAYLOAD');result[key]=part.slice(at+1);
  }return result;
}
function slots(value,maximum=100){
  if(value===undefined||value==='')return [];
  need(/^\d+(?:\|\d+)*\|?$/.test(value),'FEATURE_ID');
  const result=value.replace(/\|$/,'').split('|').map(uint);
  need(result.length<=maximum&&result.every(n=>n<=4),'UNREVIEWED_ROUTE');return result;
}
function scope(plan,raw){
  need(plan?.gameId===32714&&plan.runtimeGameId===33114&&plan.sourceKey===HUFF_SOURCE&&plan.betRaw===500
    &&plan.buy===0&&plan.featureProfile===ACTION_VERSION&&plan.actionContractHash===ACTION_CONTRACT_HASH
    &&plan.maxSteps===100&&JSON.stringify(Object.entries(plan.requestParams??{}).sort())===
      JSON.stringify(Object.entries({AP:'false',BPR:'25',GN:'huffnpuffmoneymansionhighlimit96',RB:'5'}).sort()),'PROFILE');
  need(raw?.fixtureOnly===false&&raw.protocol==='nextgen'&&raw.sourceKey===HUFF_SOURCE
    &&raw.roundFieldsVersion==='sg-round-fields-v1'&&raw.requestFlowVersion===ACTION_VERSION
    &&raw.actionContractHash===ACTION_CONTRACT_HASH,'RAW_CONTRACT');
}
// Official Y9 selects FREE_GAME from NFG, independently of the displayed FID.
// The Mansion intro/outro and frame/combined exits remain explicit boundaries.
// Cosmetic GSD keys never select a request or assign a gameplay category.
export function reviewHuffAction(plan,raw){
  scope(plan,raw);need(Array.isArray(raw.steps)&&raw.steps.length<=100,'STEPS');
  const start=uint(raw.startBalanceRaw);need(start>=500,'START');
  let next='BET',player,previous,priorWin=0;
  for(const [i,s] of raw.steps.entries()){
    need(next!==null&&s.msgId===next,'SEQUENCE');
    const q=pairs(s.requestPayload),p=pairs(s.responsePayload),g=pairs(p.GSD??'','#','~');
    need(Object.keys(q).sort().join(',')==='AP,BPR,GN,MSGID,PID,RB'&&q.MSGID===next
      &&Object.entries(plan.requestParams).every(([k,v])=>q[k]===v),'REQUEST');
    need(/^gdmgcm.{1,505}$/.test(q.PID??'')&&(player===undefined||player===q.PID),'SESSION');player=q.PID;
    need(s.methodName==='processGameMessage'&&p.MSGID===next&&p.IFG===String(Number(i>0)),'MESSAGE');
    need(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml),'XML');
    const root=parseXml(s.responseXml),text=n=>n.children.map(c=>c.text??'').join('');
    need(root.tag==='GDMRESPONSE'&&!Object.keys(root.a).length
      &&children(root).every(n=>['SUCCESS','PAYLOAD','OGS_RC'].includes(n.tag)&&!Object.keys(n.a).length&&!children(n).length)
      &&text(one(root,'SUCCESS')).toLowerCase()==='true'&&text(one(root,'PAYLOAD'))===s.responsePayload,'XML');
    const rc=children(root).filter(n=>n.tag==='OGS_RC');need(rc.length<=1&&(!rc.length||text(rc[0])==='0'),'XML');
    need(uint(s.elapsedMs)<=300000,'TIMING');
    need((p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0'
      &&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k))
      &&!['CFG','ABPM','SB','FRTR','FRTW','BUY_IN'].some(k=>Object.hasOwn(p,k)),'UNREVIEWED_ROUTE');
    const f=slots(p.FID,2);need(new Set(f).size===f.length,'FEATURE_ID');slots(g.PCFID);
    need([undefined,'MMANSION','HARDHAT','PAINT','HOMEIMP','MANSION'].includes(g.FEAT),'UNREVIEWED_ROUTE');
    need([undefined,'0','1'].includes(g.MMBG),'MANSION_FLAG');
    const ordinary=i===0&&!f.length&&!['NFG','TFG','CFGG'].some(k=>Object.hasOwn(p,k));
    const n=ordinary?0:uint(p.NFG),t=ordinary?0:uint(p.TFG),c=ordinary?0:uint(p.CFGG);
    need(n+c===t&&t<=100,'COUNTERS');
    if(previous){
      const same=JSON.stringify(f)===JSON.stringify(previous.f);
      if(same)need(previous.n>0&&c===previous.c+1&&t>=previous.t&&n===previous.n-1+t-previous.t,'PROGRESS');
      else need(previous.f.length===1&&previous.f[0]===0&&previous.intro&&f.length===1&&f[0]>0
        &&g.FEAT==='MMANSION'&&!!g.MMW&&n===6&&t===6&&c===0,'UNREVIEWED_TRANSITION');
    }else need(c===0,'TRIGGER');
    const intro=f[0]===0&&g.MMBG==='1'&&!g.MMW;
    next=n>0||intro?'FREE_GAME':null;
    const b=uint(p.B),ab=uint(p.AB),win=uint(p.TW);need(win>=priorWin,'WIN_REGRESSION');priorWin=win;
    checkFeatureWallet(start,500,b,ab,win,{settled:next===null,
      responseBalance:s.responseBalance===undefined?undefined:uint(s.responseBalance)});
    if(next===null){
      need(f.length<=1,'UNREVIEWED_EXIT');
      // These official exits can start another feature even at NFG=0. Without
      // a verified transition they are a game-local gap, never a false terminal.
      if(g.FRAMEWINS!==undefined){
        const wins=reviewFeatureValues(g.FRAMEWINS,{size:f[0]===3?20:15,
          displaySentinels:[-1,-2,-3,-4,-5],continuationSentinels:[-100]});
        need(!wins.requiresFeatureContinuation,'UNREVIEWED_EXIT');
      }
      if(g.VA){const board=g.VA.split(',').map(uint);
        need(!(board.filter(v=>v===13).length>=3&&board.filter(v=>v===14).length>=6),'UNREVIEWED_EXIT');}
    }
    previous={f,n,t,c,intro};
  }
  return {next:next?{MSGID:next}:null,terminal:next===null};
}
export const huffActionNext=(plan,raw)=>reviewHuffAction(plan,raw).next;

// Compatibility entry for the original base-profile evidence. The raw record
// is never rewritten; all action/money checks run on a temporary view.
export const hasHuffHomeImprovement=raw=>raw?.sourceKey===HUFF_SOURCE&&Array.isArray(raw.steps)
  &&raw.steps.some(s=>(pairs(s.responsePayload).FID??'').replace(/\|$/,'').split('|').includes('3'));
export function legacyHuffActionRaw(raw){
  need(raw.requestFlowVersion===undefined&&raw.actionContractHash===undefined,'LEGACY_CONTRACT');
  return {...raw,requestFlowVersion:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH};
}
export const legacyHuffActionScope={gameId:32714,runtimeGameId:33114,sourceKey:HUFF_SOURCE,betRaw:500,
  buy:0,maxSteps:100,featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH,
  requestParams:{AP:'false',BPR:'25',GN:'huffnpuffmoneymansionhighlimit96',RB:'5'}};
export const legacyHuffActionNext=raw=>huffActionNext(legacyHuffActionScope,legacyHuffActionRaw(raw));
