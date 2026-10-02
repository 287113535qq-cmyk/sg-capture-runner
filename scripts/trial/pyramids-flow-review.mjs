// Action-channel evidence only. Does not normalize, approve, or authorize capture.
import {parseXml,children} from './pearl-protocol.mjs';
import {PYRAMIDS_SOURCE} from './pyramids-hold-review.mjs';
const check=(v,k)=>{if(!v)throw Error(k);};
function pairs(text){
 check(typeof text==='string','FLOW_PARAMETERS');const out=Object.create(null);
 for(const item of text.split('&').filter(Boolean)){
  const at=item.indexOf('='),key=item.slice(0,at);
  check(at>=0&&!Object.hasOwn(out,key),'FLOW_PARAMETERS');out[key]=item.slice(at+1);
 }return out;
}
function amount(v){
 check((typeof v==='string'&&/^\d+$/.test(v)||typeof v==='number')
  &&Number.isSafeInteger(Number(v))&&Number(v)>=0,'FLOW_NUMBER');return Number(v);
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function reviewPyramidsFlow(plan,raw){
 check(plan.gameId===32721&&plan.sourceKey===PYRAMIDS_SOURCE&&plan.betRaw===20,'FLOW_PROFILE');
 check(raw.sourceKey===PYRAMIDS_SOURCE&&raw.protocol==='nextgen'&&raw.fixtureOnly===false
  &&raw.roundFieldsVersion==='sg-round-fields-v1','FLOW_RAW_SCOPE');
 check(Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=100,'FLOW_STEPS');
 const start=amount(raw.startBalanceRaw);check(start>=20,'FLOW_STAKE');
 let previous,player,win=0,n=0,outer=null;
 for(const [index,step]of raw.steps.entries()){
  const msg=index?'FREE_GAME':'BET';
  check(step.methodName==='processGameMessage'&&step.msgId===msg,'FLOW_MESSAGE');
  const q=pairs(step.requestPayload),expected={...plan.requestParams,MSGID:msg};
  check(Object.keys(q).length===Object.keys(expected).length+1
   &&Object.entries(expected).every(([k,v])=>q[k]===v),'FLOW_REQUEST');
  check(typeof q.PID==='string'&&q.PID.startsWith('gdmgcm')&&q.PID.length>6&&q.PID.length<512,'FLOW_SESSION');
  check(player===undefined||player===q.PID,'FLOW_SESSION');player=q.PID;
  const xml=parseXml(step.responseXml),nodes=children(xml),payload=nodes.filter(v=>v.tag==='PAYLOAD'),
   success=nodes.filter(v=>v.tag==='SUCCESS'),rc=nodes.filter(v=>v.tag==='OGS_RC');
  const text=v=>v.children.map(c=>c.text??'').join('');
  check(xml.tag.toUpperCase()==='GDMRESPONSE'&&payload.length===1&&success.length===1&&rc.length<=1
   &&nodes.length===2+rc.length&&nodes.every(v=>children(v).length===0)
   &&text(success[0]).toLowerCase()==='true'&&text(payload[0])===step.responsePayload
   &&rc.every(v=>text(v)==='0'),'FLOW_XML_EVIDENCE');
  const p=pairs(step.responsePayload);
  check(p.MSGID===msg&&p.IFG===String(Number(index>0)),'FLOW_RESPONSE');
  check((p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0','FLOW_FORCED_EXIT');
  check(!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))
   &&!['CFG','ABPM','SB','JPV'].some(k=>Object.hasOwn(p,k)),'FLOW_OTHER_PROTOCOL');
  check(amount(step.elapsedMs)<=300000,'FLOW_TIMING');
  const encoded=p.FID??'',ordinary=!encoded&&!['NFG','TFG','CFGG'].some(k=>Object.hasOwn(p,k));
  check(!ordinary||index===0,'FLOW_MISSING_CONTINUATION_STATE');
  check(ordinary||['0','0|','1','1|','0|1','0|1|'].includes(encoded),'FLOW_FEATURE');
  const fid=ordinary?'base':encoded.replace(/\|$/,'');
  const t=ordinary?0:amount(p.TFG),c=ordinary?0:amount(p.CFGG);n=ordinary?0:amount(p.NFG);
  // Awards may increase the total beyond 100. Progress, rather than a
  // display-counter ceiling, proves the already known continuation route.
  check(n+c===t,'FLOW_COUNTERS');
  const g=Object.create(null);
  for(const segment of (p.GSD??'').split('#').filter(Boolean)){
   const parts=segment.split('~');check(parts.length===2&&/^[A-Z][A-Z0-9_]*$/.test(parts[0])
    &&!Object.hasOwn(g,parts[0]),'FLOW_GSD_STRUCTURE');g[parts[0]]=parts[1];
  }
  outer=null;
  if(fid==='0|1'){
   check(['FGRS','FGTS','CFGC'].every(k=>Object.hasOwn(g,k)),'FLOW_OUTER_REQUIRED');
   outer=['FGRS','FGTS','CFGC'].map(k=>amount(g[k]));
   check(outer[0]+outer[2]===outer[1],'FLOW_OUTER_COUNTERS');
  }
  if(previous===undefined)check(fid!=='0|1'&&c===0,'FLOW_TRIGGER');
  else{
   const [pf,pn,pt,pc,po]=previous;
   check(pn>0||po!==null&&po[0]>0,'FLOW_AFTER_TERMINAL');
   if(fid===pf){
    check(pn>0&&c===pc+1&&t>=pt&&n===pn-1+t-pt,'FLOW_PROGRESS');
    if(outer!==null)check(same(outer,po),'FLOW_OUTER_CHANGED');
   }else if(pf==='1'&&fid==='0|1'){
    check(pn>0&&same(outer,[pn-1,pt,pc+1])&&c===0&&n===t&&n>0,'FLOW_ENTER_HOLD');
   }else if(pf==='0|1'&&fid==='1'){
    check(pn===0&&po[0]>0&&t===po[1]&&c===po[2]+1&&n===po[0]-1,'FLOW_RESUME_FREE');
   }else check(false,'FLOW_TRANSITION_UNPROVEN');
  }
  const b=amount(p.B),ab=amount(p.AB),tw=amount(p.TW);
  check(tw>=win&&b===start-20+tw&&ab>=start-20&&ab<=b,'FLOW_MONEY');
  if(Object.hasOwn(step,'responseBalance'))check(amount(step.responseBalance)===ab,'FLOW_RESPONSE_BALANCE');
  win=tw;previous=[fid,n,t,c,outer];
 }
 const active=n>0||outer!==null&&outer[0]>0;
 return {next:active?{MSGID:'FREE_GAME'}:null,terminalCandidate:!active,complete:false,
  normalizationRequired:true,sourceRequests:0,captureAuthorized:false};
}
