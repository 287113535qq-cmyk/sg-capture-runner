import {createHmac} from 'node:crypto';
import {parseXml,children,one,need,uint} from './pearl-protocol.mjs';
import {VERYFRUITY_SOURCE,ACTION_VERSION,ACTION_CONTRACT_HASH} from './veryfruity-action-protocol.mjs';
export const VERYFRUITY_ENDPOINT='https://gls.atc.casinarena.com/gls.rgsx';
// Selected Very Fruity platform metadata a2823e... and fixed static GLS identity
// cc7a6c... independently bind this endpoint and game; no Pearl identity is used.
const escape=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export function veryFruitySession(base,plan,worker,run){
 need(plan.gameId===32812&&plan.runtimeGameId===33172&&plan.sourceKey===VERYFRUITY_SOURCE&&plan.adapter===VERYFRUITY_SOURCE
  &&plan.featureProfile===ACTION_VERSION&&plan.actionContractHash===ACTION_CONTRACT_HASH&&plan.buy===0&&plan.mode==='demo'
  &&/^[a-f0-9]{64}$/.test(plan.demoGeneration??'')&&plan.countAllocation===undefined
  &&plan.runnerGroup==='secondary'&&Number.isSafeInteger(worker)&&worker>=20&&worker<40
  &&/^\d+:1$/.test(run??''),'VERYFRUITY_SESSION_SCOPE');
 need(base.mode==='demo'&&/^Free:/i.test(base.sessionId??'')&&typeof base.operatorId==='string'&&base.operatorId.length>0,'VERYFRUITY_DEMO_REQUIRED');
 return base.sessionId.slice(0,5)+createHmac('sha256',base.sessionId+'@'+base.operatorId)
  .update(`sg-veryfruity-action-v1:${plan.trialId}:${plan.demoGeneration}:${run}:${worker}`).digest('hex').slice(0,32);
}
export function veryFruityPayload(plan,msg,session){
 need(['Init','Logic','EndGame'].includes(msg)&&typeof session==='string'&&session.length>0&&session.length<=1024,'VERYFRUITY_REQUEST_SCOPE');
 const h=plan.requestHeader;need(h?.gameCodeRGI==='veryfruity'&&h.gameID==='20206'&&h.versionID==='1_0'&&h.freePlay==='Y'&&h.promotions==='N','VERYFRUITY_REQUEST_SCOPE');
 return `<GameRequest type="${msg}"><Header ${Object.entries({...h,sessionID:session}).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')}/>${msg!=='Init'?'<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}${msg==='Logic'?'<Stake perLine="1" total="20"/><PaylineCount count="20"/>':''}</GameRequest>`;
}
export function veryFruityResponse(plan,text,msg){
 const root=parseXml(text);need(root.tag==='GameResponse'&&root.a.type===msg,'VERYFRUITY_RESPONSE_MESSAGE');
 const h=one(root,'Header').a;need(['gameID','versionID','ccyCode','lang'].every(k=>h[k]===plan.requestHeader[k])&&h.isRecovering==='N','VERYFRUITY_RESPONSE_IDENTITY');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'VERYFRUITY_RESPONSE_SESSION');
 const b=one(root,'Balances'),cash=one(b,'Balance');need(children(b).length===1&&cash.a.name==='CASH_BALANCE','VERYFRUITY_RESPONSE_BALANCE');
 return {root,session:h.sessionID,balance:uint(cash.a.value)};
}
export function veryFruityInit(plan,text){
 const result=veryFruityResponse(plan,text,'Init'),{root}=result;
 const nodes=[];const visit=n=>{nodes.push(n);children(n).forEach(visit);};visit(root);
 need(!nodes.some(n=>['GameResult','Error','Errors','Recovery','Pick','Gamble'].includes(n.tag)),'VERYFRUITY_INIT_REVIEW');
 const stakes=nodes.filter(n=>n.tag==='Stakes');need(stakes.length===1,'VERYFRUITY_INIT_STAKES');
 const textOf=n=>n.children.map(c=>c.text??'').join('');const values=textOf(stakes[0]).split('|');if(values.at(-1)==='')values.pop();
 need(values.length>0&&values.length<=100&&values.map(uint).includes(1),'VERYFRUITY_INIT_STAKES');
 const currencies=nodes.filter(n=>n.tag==='CurrencyMultiplier');need(currencies.length===1&&textOf(currencies[0])==='1','VERYFRUITY_INIT_CURRENCY');
 const lines=nodes.filter(n=>n.tag==='PaylineInfo');need(lines.length===1&&children(lines[0]).filter(n=>n.tag==='Payline').length===20,'VERYFRUITY_INIT_LINES');
 const pages=nodes.filter(n=>n.tag==='PageInfo');need(pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'VERYFRUITY_INIT_PAGES');
 return result;
}
