// Independent offline mixed-chain hypothesis; no capture or production import.
import {reviewMixedPrefix} from './pyramids-mixed-prefix.mjs';
import {parseXml,one,children} from './pearl-protocol.mjs';
const check=(v,k)=>{if(!v)throw Error(k);};
function pairs(text,sep='&',eq='='){
 check(typeof text==='string','MIXED_PARAMETERS');const p=Object.create(null);
 for(const part of text.split(sep).filter(Boolean)){const i=part.indexOf(eq),k=part.slice(0,i);
  check(i>0&&!Object.hasOwn(p,k)&&(eq!=='~'||part.lastIndexOf(eq)===i),'MIXED_PARAMETERS');p[k]=part.slice(i+1);
 }return p;
}
function number(v){check(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(+v),'MIXED_NUMBER');return +v;}
const free=new Set('BGRS IIFS VA FGRS CFGC FGVABN BGCL CL CLBN FSRS'.split(' '));
const hold=new Set('BGCL BGRS CL CS FTTCV HCL HCLBT HNS HNSID HNSRIDS HNSTW HPCL HRS HRSBT HVA HVABT NCCP PHRS PSTRS PVA STRS VA'.split(' '));
const coin=new Set('BGCL CL HCL HCLBT HPCL'.split(' '));
function rows(v){const rs=v.split('|');if(rs.at(-1)==='')rs.pop();check(rs.length>0&&rs.length<=100,'MIXED_ARRAY');
 return rs.map(r=>{const cells=r.split(';');if(cells.at(-1)==='')cells.pop();check(cells.length>0&&cells.length<=100
  &&cells.every(x=>/^-?\d+$/.test(x)&&Number.isSafeInteger(+x)),'MIXED_ARRAY');return cells.map(Number);});}
function validateGsd(g,phase,base){
 for(const [k,v]of Object.entries(g)){
  check(phase==='hold'?(free.has(k)||hold.has(k)||k==='FGTS'):free.has(k),'MIXED_GSD');
  if(coin.has(k)){const seen=new Set();for(const r of rows(v)){const[x,y,n]=r,pos=x+','+y;
   check(r.length===3&&x>=0&&x<3&&y>=0&&y<5&&!seen.has(pos)&&[-4,-3,-2,10,20,40,60,80,100,300,400,600,800].includes(n),'MIXED_COIN');seen.add(pos);}}
  else if(['HVA','HVABT','FGVABN'].includes(k)){const grid=rows(v);check(grid.length===5&&grid.every(r=>r.length===3&&r.every(n=>n>=0&&n<=15)),'MIXED_GRID');}
  else if(k==='CS')check(['RESPIN','RESPININITIALCHEST','RESPINSUPER','RESPINSUPERMORECHEST'].includes(v),'MIXED_STATE');
  else if(k==='HNS')check(number(v)===1,'MIXED_HNS');
  else if(k==='HNSID')check(number(v)>=2&&number(v)<=5,'MIXED_REELSET');
  else if(['HNSTW','FGRS','CFGC','FGTS'].includes(k))number(v);
  else if(k==='IIFS')check(['0','1'].includes(v),'MIXED_FLAG');
  else if(k==='FSRS'){const stops=v.split(';');if(stops.at(-1)==='')stops.pop();check(stops.length===5,'MIXED_STOPS');stops.forEach(number);}
  else if(hold.has(k)&&!free.has(k))rows(v);
 }
 if(g.BGCL!==undefined)check(g.BGCL===base,'MIXED_BASE_CHANGED');
 if(g.CLBN!==undefined)check(g.CLBN===g.CL,'MIXED_COIN_ALIAS');
}
export function reviewMixedSequence(raw){
 check(Array.isArray(raw.steps)&&raw.steps.length>=2&&raw.steps.length<=100,'MIXED_STEPS');
 check(raw.steps.every(s=>s.methodName==='processGameMessage'),'MIXED_METHOD');
 const trigger=raw.steps.findIndex(s=>pairs(s.responsePayload).FID==='0|1|');check(trigger>=0,'MIXED_TRIGGER_MISSING');
 const prefix=reviewMixedPrefix({...raw,steps:raw.steps.slice(0,trigger+1)});
 let outer={...prefix.outer},inner={...prefix.inner},phase='hold',complete=false;
 const pid=pairs(raw.steps[0].requestPayload).PID,base=pairs(pairs(raw.steps[0].responsePayload).GSD,'#','~').BGCL;
 const firstWin=number(pairs(raw.steps[trigger].responsePayload).TW);let win=firstWin;
 for(const s of raw.steps.slice(trigger+1)){
  check(!complete,'MIXED_AFTER_COMPLETE');const p=pairs(s.responsePayload),q=pairs(s.requestPayload),g=pairs(p.GSD,'#','~');
  check(s.msgId===p.MSGID&&q.MSGID===p.MSGID&&p.MSGID==='FREE_GAME'&&p.IFG==='1'&&q.PID===pid
   &&Object.keys(q).length===5&&q.BPL==='1'&&q.LB==='40'&&q.GN==='hyperchargedpyramidsofra96','MIXED_REQUEST');
  check((p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0'&&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))
   &&!['CFG','ABPM','SB','JPV'].some(k=>Object.hasOwn(p,k)),'MIXED_FEATURE');
  const xml=parseXml(s.responseXml),ok=one(xml,'SUCCESS'),payload=one(xml,'PAYLOAD');
  check(xml.tag.toUpperCase()==='GDMRESPONSE'&&children(ok).length===0&&children(payload).length===0
   &&ok.children.map(x=>x.text??'').join('').toLowerCase()==='true'&&payload.children.map(x=>x.text??'').join('')===s.responsePayload,'MIXED_XML');
  check(Number.isSafeInteger(s.elapsedMs)&&s.elapsedMs>=0&&s.elapsedMs<=300000,'MIXED_TIMING');
  const b=number(p.B),ab=number(p.AB),nextWin=number(p.TW);check(raw.startBalanceRaw-b+nextWin===20&&nextWin>=win,'MIXED_MONEY');
  validateGsd(g,phase,base);for(const k of ['BGCL','CL','CLBN','HCL','HCLBT','HPCL'])if(g[k]!==undefined)
   check(!/(^|[;|])-0([;|]|$)/.test(g[k])&&rows(g[k]).every(r=>[10,20,40,60,80,100,300,400,600,800].includes(r[2])),'MIXED_UNREVIEWED_COIN_VALUE');const n=number(p.NFG),t=number(p.TFG),c=number(p.CFGG);
  if(phase==='hold'){
   check(p.FID==='0|1|'&&['FGTS','FGRS','CFGC','HNS','HNSID','HNSRIDS','HVA','CS'].every(k=>Object.hasOwn(g,k)),'MIXED_HOLD_FIELDS');
   check(number(g.FGRS)===outer.remaining&&number(g.CFGC)===outer.current&&number(g.FGTS)===outer.total,'MIXED_OUTER_CHANGED');
   check(inner.remaining>0&&n<=99&&t>=6&&t<=98&&c<=98&&n+c===t&&c===inner.current+1
    &&[0,2,4].includes(t-inner.total)&&n===inner.remaining-1+t-inner.total,'MIXED_HOLD_PROGRESS');
   if(n===0){check(inner.remaining===1&&t===inner.total&&g.HNSTW!==undefined&&nextWin===firstWin+number(g.HNSTW),'MIXED_PAYOUT');phase='free';complete=outer.remaining===0;}
   inner={remaining:n,current:c,total:t};
  }else{
   check(['1','1|'].includes(p.FID)&&outer.remaining>0&&t===outer.total&&t===10&&c===outer.current+1
    &&n===outer.remaining-1&&n+c===t,'MIXED_FREE_RESUME');
   check((g.FGRS===undefined||number(g.FGRS)===n)&&(g.CFGC===undefined||number(g.CFGC)===c),'MIXED_FREE_COUNTER');
   outer={remaining:n,current:c,total:t};complete=n===0;
  }
  if(complete)check(ab===b&&(s.responseBalance===undefined||s.responseBalance===null||s.responseBalance===b),'MIXED_BALANCE');win=nextWin;
 }
 return {complete,next:complete?null:'FREE_GAME',outer,inner,sourceRequests:0,captureAuthorized:false,
  ...(complete?{betRaw:20,endBalanceRaw:number(pairs(raw.steps.at(-1).responsePayload).B),totalWinRaw:win}:{})};
}

export function pyramidsHasMixed(raw){return raw.steps.some(s=>pairs(s.responsePayload).FID==='0|1|');}
