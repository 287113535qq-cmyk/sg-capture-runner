import {createHmac} from 'node:crypto';
import {sessionWorkerAllowed} from '../runner-v2/session-layout.mjs';
import {PEARL_SOURCE,parseXml,one,children,need,uint} from './pearl-protocol.mjs';
export const PEARL_ENDPOINT='https://gls.atc.casinarena.com/gls.rgsx';
export const escapeXml=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export function pearlSession(base,plan,worker,run){
 const formal=plan.countAllocation!==undefined;
 need(!formal||(!plan.demoGeneration&&/^[a-f0-9]{64}$/.test(plan.countAllocation)&&/^\d+:1:[a-f0-9-]{36}$/.test(run??'')),'PEARL_FORMAL_SESSION_SCOPE');
 need(plan.gameId===32795&&plan.runtimeGameId===33155&&plan.sourceKey===PEARL_SOURCE&&plan.adapter==='pearl-wms-v1'
  &&plan.trialId==='sg_r1_20260930_32795'&&plan.mode==='demo'&&plan.buy===0&&plan.betRaw===200
  &&/^[a-f0-9]{64}$/.test((formal?plan.countAllocation:plan.demoGeneration)??'')&&sessionWorkerAllowed(plan,worker,'primary'),'PEARL_SESSION_SCOPE');
 need(base.mode==='demo'&&/^Free:/i.test(base.sessionId??'')&&typeof base.operatorId==='string'&&base.operatorId.length>0,'PEARL_DEMO_REQUIRED');
 return base.sessionId.slice(0,5)+createHmac('sha256',base.sessionId+'@'+base.operatorId)
  .update(`sg-pearl-wms-v1:${plan.trialId}:${formal?plan.countAllocation+':'+run:plan.demoGeneration}:${worker}`).digest('hex').slice(0,32);
}
export function pearlPayload(msg,session){
 need(['Init','Logic','EndGame'].includes(msg)&&typeof session==='string'&&session.length>0&&session.length<=1024,'PEARL_REQUEST_SCOPE');
 const header={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'pearlofthecaribbean',gameID:'20327',glsID:'65535',lang:'en_US',promotions:'N',sessionID:session,userID:'null',userType:'C',versionID:'1_0'};
 return `<GameRequest type="${msg}"><Header ${Object.entries(header).map(([k,v])=>`${k}="${escapeXml(v)}"`).join(' ')}/>${msg==='Logic'?'<Stake total="200" isBigBet="0"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}</GameRequest>`;
}
export function pearlResponse(text,msg){
 const root=parseXml(text);need(root.tag==='GameResponse'&&root.a.type===msg,'MESSAGE_ID_MISMATCH');
 const h=one(root,'Header').a;need(h.gameID==='20327'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {session:h.sessionID,balance:uint(one(b,'Balance').a.value),root};
}
export function pearlInit(text){
 const result=pearlResponse(text,'Init'),{root}=result;
 need(!children(root).some(n=>n.tag==='GameResult')&&one(root,'Header').a.readyForEndGame==='N','PEARL_INIT_REQUIRES_REVIEW');
 const all=[];const visit=n=>{all.push(n);children(n).forEach(visit);};visit(root);
 const stakes=all.filter(n=>n.tag==='Stakes');need(stakes.length>0,'PEARL_INIT_REQUIRES_REVIEW');
 const values=stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint);
 need(values.includes(200),'PEARL_INIT_REQUIRES_REVIEW');
 const pages=all.filter(n=>n.tag==='PageInfo');need(pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'PEARL_INIT_REQUIRES_REVIEW');
 return result;
}
