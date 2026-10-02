/** Independent collector checks for Pyramids base, isolated Hold and ten-free. */
const requireP=(ok:unknown,code:string):void=>{if(!ok)throw Error(code);};
function fields(text:string,sep='&',eq='='):Record<string,string>{
 requireP(typeof text==='string','PYRAMIDS_PARAMETERS');const out:Record<string,string>=Object.create(null);
 for(const part of text.split(sep).filter(Boolean)){const i=part.indexOf(eq),k=part.slice(0,i);requireP(i>0&&!Object.prototype.hasOwnProperty.call(out,k)&&(eq!=='~'||part.lastIndexOf(eq)===i),'PYRAMIDS_PARAMETERS');out[k]=part.slice(i+1);}return out;
}
function count(value:string):number{requireP(typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(+value),'PYRAMIDS_NUMBER');return +value;}
function matrix(text:string):number[][]{
 const rs=text.split('|');if(rs[rs.length-1]==='')rs.pop();requireP(rs.length>0&&rs.length<=100,'PYRAMIDS_ARRAY');
 return rs.map(row=>{const cells=row.split(';');if(cells[cells.length-1]==='')cells.pop();requireP(cells.length>0&&cells.length<=100&&cells.every(v=>/^-?\d+$/.test(v)&&Number.isSafeInteger(+v)),'PYRAMIDS_ARRAY');return cells.map(Number);});
}
function grid(text:string){const m=matrix(text);requireP(m.length===5&&m.every(r=>r.length===3&&r.every(v=>v>=0&&v<=15)),'PYRAMIDS_GRID');}
function holdGsd(g:Record<string,string>){
 const keys='BGCL BGRS CL CS FTTCV HCL HCLBT HNS HNSID HNSRIDS HNSTW HPCL HRS HRSBT HVA HVABT NCCP PHRS PSTRS PVA STRS VA SHNST'.split(' ');
 requireP(Object.keys(g).every(k=>keys.includes(k)),'PYRAMIDS_UNREVIEWED_GSD');
 for(const k of Object.keys(g)){
  if(k==='SHNST')requireP(['0','1'].includes(g[k]),'PYRAMIDS_SUPER_HOLD_FLAG');
  else if(['CL','BGCL','HCL','HCLBT','HPCL'].includes(k)){
   const seen=new Set<string>();for(const r of matrix(g[k])){const [x,y,v]=r,pos=x+','+y;requireP(r.length===3&&x>=0&&x<3&&y>=0&&y<5&&!seen.has(pos)&&[-4,-3,-2,10,20,40,60,80,100,300,400,600,800].includes(v),'PYRAMIDS_COIN');seen.add(pos);}
  }else if(['HVA','HVABT'].includes(k))grid(g[k]);
  else if(k==='HNS')requireP(count(g[k])===1,'PYRAMIDS_HNS');
  else if(k==='HNSID')requireP(count(g[k])>=2&&count(g[k])<=5,'PYRAMIDS_REELSET');
  else if(k==='HNSTW')count(g[k]);
  else if(k==='CS')requireP(['RESPIN','RESPININITIALCHEST','RESPINSUPER','RESPINSUPERMORECHEST'].includes(g[k]),'PYRAMIDS_STATE');
  else matrix(g[k]);
 }
}
export function pyramidsFields(raw:any,mappingHash:string,reviewedMajor=false,freeTotal=10,superHold=false){
 requireP([10,15].includes(freeTotal),'PYRAMIDS_UNREVIEWED_FREE_TOTAL');
 requireP(raw.sourceKey==='hyperchargedpyramidsofra96-round-one-base-v1'&&raw.protocol==='nextgen'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1'&&Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=100,'PYRAMIDS_PROFILE');
 const free=raw.steps.some((s:any)=>['1','1|'].includes(fields(s.responsePayload).FID));
 const hold=!free&&(raw.steps.length>1||count(fields(raw.steps[0].responsePayload).NFG??'0')>0);
 requireP(!superHold||hold,'PYRAMIDS_SUPER_HOLD_SCOPE');
 let observedMajor=false;
 let prior=0,total=0,played=0,firstWin=0,pid:string|undefined,baseCoins:string|undefined,last:Record<string,string>={};
 raw.steps.forEach((s:any,i:number)=>{
  const q=fields(s.requestPayload),p=fields(s.responsePayload),msg=i?'FREE_GAME':'BET';
  requireP(s.msgId===msg&&q.MSGID===msg&&p.MSGID===msg&&(!i||prior>0)&&Object.keys(q).length===5&&q.BPL==='1'&&q.LB==='40'&&q.GN==='hyperchargedpyramidsofra96','PYRAMIDS_REQUEST');
  requireP(/^gdmgcm.{1,505}$/.test(q.PID??'')&&(pid===undefined||pid===q.PID),'SESSION_CHANGED');pid=q.PID;
  requireP((free?['1','1|']:['','0','0|']).includes(p.FID??'')&&!['CFG','ABPM','SB','JPV'].some(k=>p[k]!==undefined)&&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k)),'PYRAMIDS_UNREVIEWED_FEATURE');
  requireP(['0','1'].includes(p.IFG)&&(!i||p.IFG==='1'),'PYRAMIDS_FREE_STATE');['B','AB','TW'].forEach(k=>count(p[k]));
  const n=count(p.NFG??(!free&&!hold?'0':undefined as any));
  if(free||hold){
   requireP((p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0','PYRAMIDS_TERMINATION');
   const t=count(p.TFG),c=count(p.CFGG),g=fields(p.GSD??'','#','~');requireP(n+c===t,'PYRAMIDS_COUNTERS');
   if(free){
    requireP(t===freeTotal&&n<=t&&c<=t,'PYRAMIDS_FREE_COUNTERS');
    requireP(Object.keys(g).every(k=>['BGRS','VA','IIFS','FGRS','CFGC','FGVABN','BGCL','CL','CLBN','FSRS'].includes(k)),'PYRAMIDS_FREE_GSD');
    if(g.CLBN!==undefined)requireP(i>0&&g.CL!==undefined&&g.CLBN===g.CL,'PYRAMIDS_FREE_COIN_ALIAS');
    if(g.FSRS!==undefined){const stops=g.FSRS.split(';');if(stops[stops.length-1]==='')stops.pop();requireP(i>0&&stops.length===5,'PYRAMIDS_FREE_STOPS');stops.forEach(count);}
    let unreviewedCoin=false;
    for(const key of ['BGCL','CL'])if(g[key]!==undefined){
     if(key==='BGCL'){
      if(i===0)baseCoins=g[key];
      else requireP(baseCoins!==undefined&&g[key]===baseCoins,'PYRAMIDS_BASE_COINS_CHANGED');
     }
     const seen=new Set<string>(),coins=matrix(g[key]);
     requireP(coins.length<=15,'PYRAMIDS_FREE_COIN');
     for(const coin of coins){const [x,y,v]=coin,pos=x+','+y;requireP(coin.length===3&&x>=0&&x<3&&y>=0&&y<5&&(v>=0||[-4,-3,-2].includes(v))&&!seen.has(pos)&&!/(^|[;|])-0([;|]|$)/.test(g[key]),'PYRAMIDS_FREE_COIN');seen.add(pos);observedMajor ||= i>0&&key==='CL'&&v===-3;unreviewedCoin ||= v<0&&!(reviewedMajor&&i>0&&key==='CL'&&v===-3);}
    }
    requireP(!unreviewedCoin,'PYRAMIDS_FREE_UNREVIEWED_COIN');
    requireP((g.IIFS===undefined||(i?['0','1']:['1']).includes(g.IIFS))&&(g.FGRS===undefined||count(g.FGRS)===n)&&(g.CFGC===undefined||count(g.CFGC)===c),'PYRAMIDS_FREE_NESTED');
    if(g.FGVABN!==undefined)grid(g.FGVABN);
    requireP(i?c===played+1&&n===prior-1&&t===total:n===freeTotal&&c===0&&p.IFG==='0','PYRAMIDS_FREE_PROGRESS');
   }else{
    holdGsd(g);requireP(superHold?g.SHNST==='1':g.SHNST===undefined||i===0,'PYRAMIDS_SUPER_HOLD_PREFIX_ONLY');
    requireP(n<=99&&t>=6&&t<=98&&c<=98,'PYRAMIDS_COUNTERS');
    if(!i){requireP(n===6&&t===6&&c===0&&p.IFG==='0'&&['CL','BGCL','HCL','HVA'].every(k=>g[k]!==undefined),'PYRAMIDS_TRIGGER');firstWin=count(p.TW);}
    else{requireP(c===played+1&&[0,2,4].includes(t-total)&&n===prior-1+t-total&&['HNS','HNSID','HNSRIDS','HVA','CS'].every(k=>g[k]!==undefined),'PYRAMIDS_PROGRESS');
     if(n===0)requireP(prior===1&&t===total&&count(p.TW)===firstWin+count(g.HNSTW),'PYRAMIDS_TERMINAL');}
   }total=t;played=c;
  }else requireP(raw.steps.length===1&&n===0,'PYRAMIDS_UNKNOWN_FEATURE');
  prior=n;last=p;
 });
 requireP(!reviewedMajor||freeTotal===15||observedMajor,'PYRAMIDS_MAJOR_SCOPE');
 requireP(prior===0&&(!(free||hold)||raw.steps.length>1),'INCOMPLETE_ROUND');
 const start=raw.startBalanceRaw,end=count(last.B),win=count(last.TW),stake=start-end+win;
 requireP(Number.isSafeInteger(start)&&start>=0&&stake===20&&end===count(last.AB)&&(raw.steps[raw.steps.length-1].responseBalance===undefined||Number(raw.steps[raw.steps.length-1].responseBalance)===end),'PYRAMIDS_MONEY');
 requireP(typeof mappingHash==='string'&&/^[a-f0-9]{64}$/.test(mappingHash),'PYRAMIDS_MAPPING_REQUIRED');
 return{roundFieldsVersion:raw.roundFieldsVersion,protocol:raw.protocol,sourceKey:raw.sourceKey,bet:stake/100,mul:win/stake,buy:0,bonus:free?(reviewedMajor?3:2):hold?1:0,primaryBonusKind:raw.steps.length>1?'freeGame':'none',typeMappingHash:mappingHash,money:{startBalanceRaw:start,endBalanceRaw:end,totalWinRaw:win,betRaw:stake}};
}
