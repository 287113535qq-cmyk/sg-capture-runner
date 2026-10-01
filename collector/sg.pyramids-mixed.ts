/** Third independent offline validator. Independent additive validator; no source permit. */
import assert from 'node:assert/strict';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
const xmlParser=new XMLParser({parseTagValue:false,trimValues:false,ignoreAttributes:false});
type Fields=Record<string,string>;
const has=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key);
function pairs(text:string,separator='&',equals='='):Fields{
 assert(typeof text==='string','COLLECTOR_PARAMETERS');const result:Fields=Object.create(null);
 for(const token of text.split(separator).filter(Boolean)){
  const at=token.indexOf(equals),key=token.slice(0,at);
  assert(at>0&&!has(result,key)&&(equals!=='~'||token.lastIndexOf(equals)===at),'COLLECTOR_PARAMETERS');
  result[key]=token.slice(at+1);
 }return result;
}
function num(value:string){assert(typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(+value),'COLLECTOR_NUMBER');return +value;}
function rows(text:string):number[][]{
 assert(typeof text==='string','COLLECTOR_ARRAY');const lines=text.split('|');if(lines[lines.length-1]==='')lines.pop();
 assert(lines.length>0&&lines.length<=100,'COLLECTOR_ARRAY');
 return lines.map(line=>{const cells=line.split(';');if(cells[cells.length-1]==='')cells.pop();
  assert(cells.length>0&&cells.length<=100&&cells.every(v=>/^-?\d+$/.test(v)&&Number.isSafeInteger(+v)),'COLLECTOR_ARRAY');return cells.map(Number);
 });
}
const free=new Set('BGRS IIFS VA FGRS CFGC FGVABN BGCL CL CLBN FSRS'.split(' '));
const hold=new Set('BGCL BGRS CL CS FTTCV HCL HCLBT HNS HNSID HNSRIDS HNSTW HPCL HRS HRSBT HVA HVABT NCCP PHRS PSTRS PVA STRS VA'.split(' '));
function geometry(g:Fields,phase:string,base:string|undefined){
 for(const [k,v] of Object.entries(g)){
  assert(free.has(k)||(phase==='hold'&&(hold.has(k)||k==='FGTS')),'COLLECTOR_UNREVIEWED_GSD');
  if(['BGCL','CL','CLBN','HCL','HCLBT','HPCL'].includes(k)){
   const occupied=new Set<string>();for(const r of rows(v)){
    const [x,y,n]=r,position=x+','+y;
    assert(r.length===3&&x>=0&&x<3&&y>=0&&y<5&&!occupied.has(position)&&!/(^|[;|])-0([;|]|$)/.test(v),'COLLECTOR_COIN');
    assert(phase==='free'||phase==='initial'?n>=0||(phase==='free'&&['CL','CLBN'].includes(k)&&n===-3):[10,20,40,60,80,100,300,400,600,800].includes(n),'COLLECTOR_COIN_SCOPE');
    occupied.add(position);
   }
  }else if(['HVA','HVABT','FGVABN'].includes(k)){
   const matrix=rows(v);assert(matrix.length===5&&matrix.every(r=>r.length===3&&r.every(n=>n>=0&&n<=15)),'COLLECTOR_GRID');
  }else if(k==='IIFS')assert(['0','1'].includes(v),'COLLECTOR_FLAG');
  else if(k==='FSRS'){const stops=v.split(';');if(stops[stops.length-1]==='')stops.pop();assert(stops.length===5,'COLLECTOR_STOPS');stops.forEach(num);}
  else if(['FGRS','CFGC','FGTS','HNSTW'].includes(k))num(v);
  else if(k==='HNS')assert(num(v)===1,'COLLECTOR_HNS');
  else if(k==='HNSID')assert(num(v)>=2&&num(v)<=5,'COLLECTOR_REELSET');
  else if(k==='CS')assert(['RESPIN','RESPININITIALCHEST','RESPINSUPER','RESPINSUPERMORECHEST'].includes(v),'COLLECTOR_STATE');
  else rows(v);
 }
 if(g.BGCL!==undefined&&phase!=='initial')assert(base!==undefined&&g.BGCL===base,'COLLECTOR_BASE_CHANGED');
 if(g.CLBN!==undefined)assert(g.CL!==undefined&&g.CL===g.CLBN,'COLLECTOR_COIN_ALIAS');
}
function xml(step:any){
 const text=step.responseXml;assert(typeof text==='string'&&text.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(text),'COLLECTOR_XML');
 assert(XMLValidator.validate(text)===true,'COLLECTOR_XML');const parsed=xmlParser.parse(text);
 const roots=Object.keys(parsed).filter(k=>k!=='?xml');assert(roots.length===1&&roots[0].toUpperCase()==='GDMRESPONSE','COLLECTOR_XML');
 const root=parsed[roots[0]];assert(typeof root.SUCCESS==='string'&&root.SUCCESS.toLowerCase()==='true'&&root.PAYLOAD===step.responsePayload,'COLLECTOR_XML');
}
export function reviewMixedCollector(raw:any,mappingHash:string){
 assert(raw?.protocol==='nextgen'&&raw.sourceKey==='hyperchargedpyramidsofra96-round-one-base-v1'&&raw.fixtureOnly===false
  &&raw.roundFieldsVersion==='sg-round-fields-v1'&&Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=0
  &&Array.isArray(raw.steps)&&raw.steps.length>=2&&raw.steps.length<=100,'COLLECTOR_PROFILE');
 assert(/^[a-f0-9]{64}$/.test(mappingHash),'COLLECTOR_MAPPING');
 let outer={remaining:0,current:0,total:0},inner={remaining:0,current:0,total:0};
 let phase='initial',pid:string|undefined,base:string|undefined,entryWin=0,lastWin=0,complete=false,last:Fields={};
 for(let i=0;i<raw.steps.length;i++){
  const step=raw.steps[i],q=pairs(step.requestPayload),p=pairs(step.responsePayload),g=pairs(p.GSD??'','#','~');
  assert(!complete,'COLLECTOR_AFTER_COMPLETE');const message=i?'FREE_GAME':'BET';
  assert(step.msgId===message&&q.MSGID===message&&p.MSGID===message&&Object.keys(q).length===5&&q.GN==='hyperchargedpyramidsofra96'
   &&step.methodName==='processGameMessage'&&q.LB==='40'&&q.BPL==='1'&&/^gdmgcm.{1,505}$/.test(q.PID)&&(!pid||q.PID===pid),'COLLECTOR_REQUEST');pid=q.PID;
  assert((p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0'&&!['CFG','ABPM','SB','JPV'].some(k=>has(p,k))
   &&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))&&p.IFG===(i?'1':'0'),'COLLECTOR_UNREVIEWED_FEATURE');
  xml(step);assert(Number.isSafeInteger(step.elapsedMs)&&step.elapsedMs>=0&&step.elapsedMs<=300000,'COLLECTOR_TIMING');
  const b=num(p.B),ab=num(p.AB),win=num(p.TW),n=num(p.NFG),t=num(p.TFG),c=num(p.CFGG);
  assert(raw.startBalanceRaw-b+win===20&&win>=lastWin,'COLLECTOR_MONEY');
  if(!i){
   assert(['1','1|'].includes(p.FID)&&n===10&&t===10&&c===0&&g.IIFS==='1','COLLECTOR_FREE_TRIGGER');
   base=g.BGCL;geometry(g,'initial',base);outer={remaining:n,current:c,total:t};phase='free-before-hold';
  }else if(phase==='free-before-hold'&&p.FID==='0|1|'){
   assert(outer.remaining>0&&n===6&&t===6&&c===0&&['FGRS','CFGC','FGTS','CL','CLBN','HCL','HVA','FGVABN'].every(k=>has(g,k)),'COLLECTOR_MIXED_TRIGGER');
   geometry(g,'hold',base);assert(g.CL===g.CLBN&&g.CL===g.HCL,'COLLECTOR_COIN_SNAPSHOT');
   assert(num(g.FGRS)===outer.remaining-1&&num(g.CFGC)===outer.current+1&&num(g.FGTS)===outer.total,'COLLECTOR_OUTER_TRIGGER');
   outer={remaining:num(g.FGRS),current:num(g.CFGC),total:num(g.FGTS)};inner={remaining:6,current:0,total:6};entryWin=win;phase='hold';
  }else if(phase==='hold'){
   assert(p.FID==='0|1|'&&['FGTS','FGRS','CFGC','HNS','HNSID','HNSRIDS','HVA','CS'].every(k=>has(g,k)),'COLLECTOR_HOLD_FIELDS');
   geometry(g,'hold',base);assert(num(g.FGRS)===outer.remaining&&num(g.CFGC)===outer.current&&num(g.FGTS)===outer.total,'COLLECTOR_OUTER_FROZEN');
   assert(inner.remaining>0&&n<=99&&t>=6&&t<=98&&c<=98&&n+c===t&&c===inner.current+1
    &&[0,2,4].includes(t-inner.total)&&n===inner.remaining-1+t-inner.total,'COLLECTOR_HOLD_PROGRESS');
   if(n===0){assert(inner.remaining===1&&t===inner.total&&g.HNSTW!==undefined&&win===entryWin+num(g.HNSTW),'COLLECTOR_HOLD_PAYOUT');phase='free-after-hold';complete=outer.remaining===0;}
   inner={remaining:n,current:c,total:t};
  }else{
   assert(['free-before-hold','free-after-hold'].includes(phase)&&['1','1|'].includes(p.FID)&&outer.remaining>0
    &&t===outer.total&&t===10&&c===outer.current+1&&n===outer.remaining-1&&n+c===t,'COLLECTOR_FREE_PROGRESS');
   geometry(g,'free',base);assert((g.FGRS===undefined||num(g.FGRS)===n)&&(g.CFGC===undefined||num(g.CFGC)===c),'COLLECTOR_FREE_COUNTERS');
   if(phase==='free-after-hold')for(const k of ['BGCL','CL','CLBN'])if(g[k]!==undefined)assert(rows(g[k]).every(r=>[10,20,40,60,80,100,300,400,600,800].includes(r[2])),'COLLECTOR_POST_HOLD_UNREVIEWED_COIN');
   outer={remaining:n,current:c,total:t};complete=n===0;assert(!complete||phase==='free-after-hold','COLLECTOR_MIXED_REQUIRED');
  }
  if(complete)assert(ab===b&&(step.responseBalance===undefined||step.responseBalance===null||step.responseBalance===b),'COLLECTOR_FINAL_BALANCE');
  lastWin=win;last=p;
 }
 assert(phase!=='free-before-hold','COLLECTOR_MIXED_REQUIRED');
 const result:any={complete,next:complete?null:'FREE_GAME',outer,inner,sourceRequests:0,captureAuthorized:false};
 if(complete)result.fields={roundFieldsVersion:raw.roundFieldsVersion,protocol:raw.protocol,sourceKey:raw.sourceKey,
  bet:0.2,mul:lastWin/20,buy:0,bonus:4,primaryBonusKind:'freeGame',typeMappingHash:mappingHash,
  money:{startBalanceRaw:raw.startBalanceRaw,endBalanceRaw:num(last.B),totalWinRaw:lastWin,betRaw:20}};
 return result;
}

export function hasPyramidsMixed(raw:any){return raw?.sourceKey==='hyperchargedpyramidsofra96-round-one-base-v1'&&Array.isArray(raw.steps)&&raw.steps.some((s:any)=>pairs(s.responsePayload).FID==='0|1|');}
