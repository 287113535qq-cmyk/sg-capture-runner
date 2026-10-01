// Offline review only. Natural isolated HoldNSpin chains; no source permission.
import {parseXml,one,children} from './pearl-protocol.mjs';
export const PYRAMIDS_SOURCE='hyperchargedpyramidsofra96-round-one-base-v1';
const need=(v,e)=>{if(!v)throw Error(e);};
function uint(v){need(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(+v),'PYRAMIDS_NUMBER');return +v;}
function pairs(s,sep='&',eq='='){
 need(typeof s==='string','PYRAMIDS_PARAMETERS');const p=Object.create(null);
 for(const part of s.split(sep).filter(Boolean)){const i=part.indexOf(eq),k=part.slice(0,i);
  need(i>0&&!Object.hasOwn(p,k)&&(eq!=='~'||part.lastIndexOf(eq)===i),'PYRAMIDS_PARAMETERS');p[k]=part.slice(i+1);
 }return p;
}
function rows(text){
 const groups=text.split('|');if(groups.at(-1)==='')groups.pop();need(groups.length>0&&groups.length<=100,'PYRAMIDS_ARRAY');
 return groups.map(g=>{const cells=g.split(';');if(cells.at(-1)==='')cells.pop();need(cells.length>0&&cells.length<=100&&cells.every(v=>/^-?\d+$/.test(v)&&Number.isSafeInteger(+v)),'PYRAMIDS_ARRAY');return cells.map(Number);});
}
const keys=new Set('BGCL BGRS CL CS FTTCV HCL HCLBT HNS HNSID HNSRIDS HNSTW HPCL HRS HRSBT HVA HVABT NCCP PHRS PSTRS PVA STRS VA SHNST'.split(' '));
function gsd(p){
 const g=pairs(p.GSD??'','#','~');need(Object.keys(g).every(k=>keys.has(k)),'PYRAMIDS_UNREVIEWED_GSD');
 for(const [k,v] of Object.entries(g)){
  if(k==='SHNST')need(['0','1'].includes(v),'PYRAMIDS_SUPER_HOLD_FLAG');
  else if(k==='CS')need(['RESPIN','RESPININITIALCHEST','RESPINSUPER','RESPINSUPERMORECHEST'].includes(v),'PYRAMIDS_STATE');
  else if(['CL','BGCL','HCL','HCLBT','HPCL'].includes(k)){
   const occupied=new Set();for(const row of rows(v)){const[x,y,value]=row,pos=x+','+y;
    need(row.length===3&&x>=0&&x<3&&y>=0&&y<5&&!occupied.has(pos)&&[-4,-3,-2,10,20,40,60,80,100,300,400,600,800].includes(value),'PYRAMIDS_COIN');occupied.add(pos);
   }
  }else if(['HVA','HVABT'].includes(k)){const grid=rows(v);need(grid.length===5&&grid.every(r=>r.length===3&&r.every(x=>x>=0&&x<=15)),'PYRAMIDS_GRID');}
  else if(['HNS','HNSID','HNSTW'].includes(k)){const n=uint(v);if(k==='HNS')need(n===1,'PYRAMIDS_HNS');if(k==='HNSID')need(n>=2&&n<=5,'PYRAMIDS_REELSET');}
  else rows(v);
 }return g;
}
export function pyramidsHoldReview(raw){
 need(raw?.sourceKey===PYRAMIDS_SOURCE&&raw.protocol==='nextgen'&&Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=100,'PYRAMIDS_PROFILE');
 let previous,pid,firstWin,last;
 for(const[i,s]of raw.steps.entries()){
  const msg=i?'FREE_GAME':'BET',q=pairs(s.requestPayload),p=pairs(s.responsePayload);
  need(s.msgId===msg&&q.MSGID===msg&&p.MSGID===msg&&Object.keys(q).length===5&&q.BPL==='1'&&q.LB==='40'&&q.GN==='hyperchargedpyramidsofra96','PYRAMIDS_REQUEST');
  need(/^gdmgcm.{1,505}$/.test(q.PID??'')&&(pid===undefined||pid===q.PID),'SESSION_CHANGED');pid=q.PID;
  need(['0','0|'].includes(p.FID)&&(p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0'&&!['JPV','SB','CFG','ABPM'].some(k=>Object.hasOwn(p,k))&&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k)),'PYRAMIDS_UNREVIEWED_FEATURE');
  need(['0','1'].includes(p.IFG)&&(!i||p.IFG==='1'),'PYRAMIDS_FREE_STATE');for(const k of ['B','AB','TW'])uint(p[k]);
  const xml=parseXml(s.responseXml),success=one(xml,'SUCCESS'),payload=one(xml,'PAYLOAD');
  need(xml.tag.toUpperCase()==='GDMRESPONSE'&&children(success).length===0&&children(payload).length===0&&success.children.map(x=>x.text??'').join('').toLowerCase()==='true'&&payload.children.map(x=>x.text??'').join('')===s.responsePayload,'PYRAMIDS_XML_MISMATCH');
  need(Number.isSafeInteger(s.elapsedMs)&&s.elapsedMs>=0&&s.elapsedMs<=300000,'PYRAMIDS_TIMING');
  const g=gsd(p),n=uint(p.NFG),t=uint(p.TFG),c=uint(p.CFGG);
  need(!Object.hasOwn(g,'SHNST')||i===0,'PYRAMIDS_SUPER_HOLD_PREFIX_ONLY');
  need(n<=99&&t>=6&&t<=98&&c<=98&&n+c===t,'PYRAMIDS_COUNTERS');
  if(!i){need(n===6&&t===6&&c===0&&p.IFG==='0'&&['CL','BGCL','HCL','HVA'].every(k=>Object.hasOwn(g,k)),'PYRAMIDS_TRIGGER');firstWin=uint(p.TW);}
  else{
   need(previous.n>0&&c===previous.c+1&&[0,2,4].includes(t-previous.t)&&n===previous.n-1+t-previous.t,'PYRAMIDS_PROGRESS');
   need(['HNS','HNSID','HNSRIDS','HVA','CS'].every(k=>Object.hasOwn(g,k)),'PYRAMIDS_HOLD_STATE');
   if(n===0)need(previous.n===1&&t===previous.t&&uint(p.TW)===firstWin+uint(g.HNSTW),'PYRAMIDS_TERMINAL');
  }previous={n,t,c};last=p;
 }
 if(previous.n)return{complete:false,next:'FREE_GAME',sourceRequests:0,captureAuthorized:false};
 need(raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1'&&Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=0,'PYRAMIDS_RECORD');
 const end=uint(last.B),win=uint(last.TW);need(end===uint(last.AB)&&raw.startBalanceRaw-end+win===20,'PYRAMIDS_MONEY');
 if(raw.steps.at(-1).responseBalance!==undefined)need(Number(raw.steps.at(-1).responseBalance)===end,'PYRAMIDS_BALANCE');
 return{complete:true,next:null,endBalanceRaw:end,totalWinRaw:win,betRaw:20,sourceRequests:0,captureAuthorized:false};
}
