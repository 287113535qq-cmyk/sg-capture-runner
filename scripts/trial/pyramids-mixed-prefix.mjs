// Independent offline review of the observed entry only. No source permission.
import {pyramidsFreeSequence} from './pyramids-free-review.mjs';
import {parseXml,one,children} from './pearl-protocol.mjs';
const check=(v,e)=>{if(!v)throw Error(e);};
function pairs(s,sep='&',eq='='){
 check(typeof s==='string','MIXED_PARAMETERS');const p=Object.create(null);
 for(const part of s.split(sep).filter(Boolean)){const i=part.indexOf(eq),k=part.slice(0,i);
  check(i>0&&!Object.hasOwn(p,k)&&(eq!=='~'||part.lastIndexOf(eq)===i),'MIXED_PARAMETERS');p[k]=part.slice(i+1);
 }return p;
}
function amount(v){check(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(+v),'MIXED_NUMBER');return +v;}
function rows(s){check(typeof s==='string','MIXED_ARRAY');const rs=s.split('|');if(rs.at(-1)==='')rs.pop();
 check(rs.length>0&&rs.length<=100,'MIXED_ARRAY');return rs.map(r=>{const c=r.split(';');if(c.at(-1)==='')c.pop();
 check(c.length>0&&c.length<=100&&c.every(v=>/^-?\d+$/.test(v)&&Number.isSafeInteger(+v)),'MIXED_ARRAY');return c.map(Number);});}
const keys=new Set('BGRS IIFS VA FGRS CFGC FGVABN BGCL CL CLBN FSRS FGTS HCL HVA'.split(' '));
export function reviewMixedPrefix(raw){
 check(raw?.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1'&&Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=0,'MIXED_PROFILE');
 check(Array.isArray(raw.steps)&&raw.steps.length>=2&&raw.steps.length<=11,'MIXED_PREFIX_LENGTH');
 check(pyramidsFreeSequence({...raw,steps:raw.steps.slice(0,-1)},{reviewedMajor:true}).next==='FREE_GAME','MIXED_FREE_PREFIX');
 const tail=raw.steps.at(-1),p=pairs(tail.responsePayload),prior=pairs(raw.steps.at(-2).responsePayload),q=pairs(tail.requestPayload);
 check(tail.msgId===p.MSGID&&p.MSGID===q.MSGID&&q.MSGID==='FREE_GAME'&&p.FID==='0|1|'&&p.IFG==='1','MIXED_TRIGGER');
 check(Object.keys(q).length===5&&q.BPL==='1'&&q.GN==='hyperchargedpyramidsofra96'&&q.LB==='40'&&q.PID===pairs(raw.steps[0].requestPayload).PID,'MIXED_REQUEST');
 check((p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0'&&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))&&!['CFG','ABPM','SB','JPV'].some(k=>Object.hasOwn(p,k)),'MIXED_UNREVIEWED_FEATURE');
 check(amount(p.NFG)===6&&amount(p.TFG)===6&&amount(p.CFGG)===0,'MIXED_INNER_COUNTER');
 const g=pairs(p.GSD,'#','~');check(Object.keys(g).every(k=>keys.has(k))&&['FGRS','CFGC','FGTS','CL','CLBN','HCL','HVA','FGVABN'].every(k=>Object.hasOwn(g,k)),'MIXED_GSD');
 const remaining=amount(g.FGRS),current=amount(g.CFGC),total=amount(g.FGTS);
 check(remaining===amount(prior.NFG)-1&&current===amount(prior.CFGG)+1&&total===amount(prior.TFG)&&total===10&&remaining+current===total,'MIXED_OUTER_COUNTER');
 check(g.CL===g.CLBN&&g.CL===g.HCL,'MIXED_COIN_SNAPSHOT');
 for(const k of ['CL','CLBN','BGCL','HCL'])if(g[k]!==undefined){const occupied=new Set();for(const r of rows(g[k])){
  const [x,y,v]=r,pos=x+','+y;check(r.length===3&&x>=0&&x<3&&y>=0&&y<5&&!occupied.has(pos)&&!/(^|[;|])-0([;|]|$)/.test(g[k])&&[10,20,40,60,80,100,300,400,600,800].includes(v),'MIXED_COIN');occupied.add(pos);}}
 for(const k of ['HVA','FGVABN']){const r=rows(g[k]);check(r.length===5&&r.every(c=>c.length===3&&c.every(v=>v>=0&&v<=15)),'MIXED_GRID');}
 check(g.IIFS===undefined||['0','1'].includes(g.IIFS),'MIXED_FLAG');
 if(g.FSRS!==undefined){const r=g.FSRS.split(';');if(r.at(-1)==='')r.pop();check(r.length===5,'MIXED_STOPS');r.forEach(amount);}
 for(const s of raw.steps){
  const v=pairs(s.responsePayload);['B','AB','TW'].forEach(k=>amount(v[k]));check(raw.startBalanceRaw-amount(v.B)+amount(v.TW)===20,'MIXED_COST');
  check(Number.isSafeInteger(s.elapsedMs)&&s.elapsedMs>=0&&s.elapsedMs<=300000,'MIXED_TIMING');
  const xml=parseXml(s.responseXml),success=one(xml,'SUCCESS'),payload=one(xml,'PAYLOAD');
  check(xml.tag.toUpperCase()==='GDMRESPONSE'&&children(success).length===0&&children(payload).length===0&&success.children.map(c=>c.text??'').join('').toLowerCase()==='true'&&payload.children.map(c=>c.text??'').join('')===s.responsePayload,'MIXED_XML');
 }
 return {complete:false,next:'FREE_GAME',phase:'free-entered-hold',outer:{remaining,current,total},inner:{remaining:6,current:0,total:6},sourceRequests:0,captureAuthorized:false};
}
