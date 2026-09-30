import {createHmac} from 'node:crypto';
import {parseXml,one,children,need,uint} from './pearl-protocol.mjs';
import {RHINO_SOURCE} from './rhino-protocol.mjs';
export const RHINO_ENDPOINT='https://gls.atc.casinarena.com/gls.rgsx';
const xml=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export function rhinoSession(base,plan,worker,run){
 const formal=plan.countAllocation!==undefined;
 need(!formal||(!plan.demoGeneration&&/^[a-f0-9]{64}$/.test(plan.countAllocation)&&/^\d+:1:[a-f0-9-]{36}$/.test(run??'')),'RHINO_FORMAL_SESSION_SCOPE');
 need(plan.gameId===32799&&plan.runtimeGameId===33159&&plan.sourceKey===RHINO_SOURCE&&plan.adapter==='rhino-wms-v1'
  &&plan.trialId==='sg_r1_20261001_32799'&&plan.mode==='demo'&&plan.buy===0&&plan.betRaw===40
  &&/^[a-f0-9]{64}$/.test((formal?plan.countAllocation:plan.demoGeneration)??'')&&Number.isInteger(worker)&&worker>=0&&worker<20,'RHINO_SESSION_SCOPE');
 need(base.mode==='demo'&&/^Free:/i.test(base.sessionId??'')&&typeof base.operatorId==='string'&&base.operatorId.length>0,'RHINO_DEMO_REQUIRED');
 return base.sessionId.slice(0,5)+createHmac('sha256',base.sessionId+'@'+base.operatorId)
  .update(`sg-rhino-wms-v1:${plan.trialId}:${formal?plan.countAllocation+':'+run:plan.demoGeneration}:${worker}`).digest('hex').slice(0,32);
}
export function rhinoPayload(msg,session){
 need(['Init','Logic','EndGame'].includes(msg)&&typeof session==='string'&&session.length>0&&session.length<=1024,'RHINO_REQUEST_SCOPE');
 const h={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'ragingrhino_prt',gameID:'20124',glsID:'65535',lang:'en_US',promotions:'N',sessionID:session,userID:'null',userType:'C',versionID:'1_0'};
 return `<GameRequest type="${msg}"><Header ${Object.entries(h).map(([k,v])=>`${k}="${xml(v)}"`).join(' ')}/>${msg==='Logic'?'<WagerInfo betMultiplier="1"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}</GameRequest>`;
}
export function rhinoResponse(text,msg){
 const root=parseXml(text);need(root.tag==='GameResponse'&&root.a.type===msg,'RHINO_MESSAGE');
 const h=one(root,'Header').a;need(h.gameID==='20124'&&h.versionID==='1_0'&&h.isRecovering==='N','RHINO_RESPONSE_IDENTITY');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'RHINO_SESSION');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','RHINO_BALANCE');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function rhinoInit(text){
 const result=rhinoResponse(text,'Init'),nodes=[];
 const visit=n=>{nodes.push(n);children(n).forEach(visit);};visit(result.root);
 need(!nodes.some(n=>['GameResult','BaseGameRecoveryInfo','Feature'].includes(n.tag)),'RHINO_INIT_REQUIRES_REVIEW');
 const multipliers=nodes.filter(n=>n.tag==='BetMultipliers'),credits=nodes.filter(n=>n.tag==='CreditBets');
 need(multipliers.length===1&&credits.length===1,'RHINO_INIT_REQUIRES_REVIEW');
 const values=multipliers[0].children.map(n=>n.text??'').join('').split('|').map(uint);
 need(values.length>0&&values.length<=100&&values.includes(1)&&uint(multipliers[0].a.defaultIndex)<values.length
  &&credits[0].children.map(n=>n.text??'').join('')==='40','RHINO_INIT_REQUIRES_REVIEW');
 const pages=nodes.filter(n=>n.tag==='PageInfo');need(pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'RHINO_INIT_REQUIRES_REVIEW');
 return result;
}
