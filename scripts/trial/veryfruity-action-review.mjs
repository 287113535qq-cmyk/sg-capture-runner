// Offline routing review for the fixed Very Fruity client. No mapping, transport
// or capture permission. Display-field interpretation is a separate operation.
import {parseXml,children,one,need} from './pearl-protocol.mjs';
export const VERYFRUITY_CLIENT_SHA='73d7979bc75f7d7c15748ce85bb02866592d61051bbf2b42a569be91fda02ab2';
const integer=value=>{
 need(typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value)&&value.length<=16&&Number.isSafeInteger(Number(value)),'VERYFRUITY_ACTION_COUNTER');
 return Number(value);
};
const session=value=>{need(typeof value==='string'&&value.length>0&&value.length<=1024,'VERYFRUITY_ACTION_SESSION');return value;};
const walk=node=>[node,...children(node).flatMap(walk)];
export function reviewVeryFruityActions(raw,{expectedHeader,maxSteps=1026}){
 need(expectedHeader&&expectedHeader.freePlay==='Y'&&expectedHeader.promotions==='N'
  &&['gameID','versionID','ccyCode','lang'].every(k=>typeof expectedHeader[k]==='string'),'VERYFRUITY_ACTION_IDENTITY');
 need(Number.isSafeInteger(maxSteps)&&maxSteps>0&&maxSteps<=1026&&Array.isArray(raw?.steps)
  &&raw.steps.length>0&&raw.steps.length<=maxSteps,'VERYFRUITY_ACTION_BUDGET');
 let next='Logic',previousSession,free;
 for(const step of raw.steps){
  need(next!==null&&step.msgId===next&&step.responsePayload===step.responseXml,'VERYFRUITY_ACTION_SEQUENCE');
  const request=parseXml(step.requestPayload),response=parseXml(step.responseXml);
  need(request.tag==='GameRequest'&&request.a.type===next&&response.tag==='GameResponse'&&response.a.type===next,'VERYFRUITY_ACTION_SEQUENCE');
  const q=one(request,'Header'),r=one(response,'Header');
  need(!children(q).length&&!children(r).length&&Object.entries(expectedHeader).every(([k,v])=>q.a[k]===v)
   &&['gameID','versionID','ccyCode','lang'].every(k=>r.a[k]===expectedHeader[k])&&r.a.isRecovering==='N','VERYFRUITY_ACTION_IDENTITY');
  session(q.a.sessionID);need(previousSession===undefined||previousSession===q.a.sessionID,'VERYFRUITY_ACTION_SESSION');
  previousSession=session(r.a.sessionID);
  // These are routes not selected by the fixed client, not display extensions.
  need(!walk(response).some(n=>['Error','Errors','Pick','Gamble','Choice','BonusWin'].includes(n.tag)),'VERYFRUITY_ACTION_UNREVIEWED_ROUTE');
  const results=children(response).filter(n=>n.tag==='GameResult');
  if(next==='EndGame'){
   need(results.length===0,'VERYFRUITY_ACTION_ENDGAME');next=null;continue;
  }
  need(results.length===1,'VERYFRUITY_ACTION_RESULT');
  const result=results[0],all=walk(result),fields=all.filter(n=>n.tag==='FSInfo');
  need(fields.length<=1&&fields.every(n=>children(result).includes(n)),'VERYFRUITY_ACTION_AMBIGUOUS_FREE');
  const bg=one(result,'BGInfo');
  need(bg.a.isMaxWin==='0'&&bg.a.mysterySymbol==='0','VERYFRUITY_ACTION_UNREVIEWED_EXIT');
  if(!fields.length){need(free===undefined,'VERYFRUITY_ACTION_MISSING_FREE');next='EndGame';continue;}
  const f=fields[0],current=integer(f.a.freeSpinNumber),total=integer(f.a.freeSpinsTotal);
  need(total>0&&total<=maxSteps&&current<=total&&!children(f).length,'VERYFRUITY_ACTION_COUNTER');
  if(free)need(current===free.current+1&&total>=free.total,'VERYFRUITY_ACTION_PROGRESS');
  else need(current===0,'VERYFRUITY_ACTION_TRIGGER');
  free={current,total};next=current===total?'EndGame':'Logic';
 }
 return {nextRequestHypothesis:next,endGameAcknowledged:next===null,
  complete:false,moneyVerified:false,captureAuthorization:false,
  ...(free?{freeProgress:free}:{}),clientSha256:VERYFRUITY_CLIENT_SHA};
}
