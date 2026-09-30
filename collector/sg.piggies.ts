/** Independent settlement guard for 32636; no source or admission authority. */
export function validatePiggies(raw:any,mapping:{buy:number;bonus:number;typeMappingHash:string}):void{
 const check=(ok:unknown,code:string)=>{if(!ok)throw Error(code);};
 const parse=(s:string,sep='&',join='='):Record<string,string>=>{check(typeof s==='string','INVALID_PARAMETERS');const p:Record<string,string>=Object.create(null);for(const x of s.split(sep).filter(Boolean)){const pos=x.indexOf(join),k=x.slice(0,pos);check(pos>0&&!Object.prototype.hasOwnProperty.call(p,k)&&(join!=='~'||x.lastIndexOf(join)===pos),'AMBIGUOUS_PARAMETERS');p[k]=x.slice(pos+1);}return p;};
 const num=(s:string)=>{check(typeof s==='string'&&/^\d+$/.test(s)&&Number.isSafeInteger(Number(s)),'INVALID_COUNTER');return Number(s);};
 const allowed=new Set('WWW MSR VA MSRNAME CONAMES CO WM FGEW RW RT CW WCP WCS SCP GE WWCTA WWCITE RTR BT RSTA RPI RSAS ITFG WWP WWTI PBG PWG RE WCE0 PWCS0 PRG WWPI WT WWTP BE GT JS JO PJS JW WWCP RSS RSCT PRPI PGS4 GE4 PGG EP4 WWFITE WWFWAE'.split(' '));
 check(raw.fixtureOnly===false&&raw.sourceKey==='richlittlepiggiesworldclass96-round-one-base-v1'&&raw.protocol==='nextgen'&&Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=100,'PIGGIES_PROFILE_REQUIRED');
 let remaining=0,total=0,progress=0,session:string|undefined,last:Record<string,string>={};
 for(let i=0;i<raw.steps.length;i++){
  const step=raw.steps[i],p=parse(step.responsePayload),q=parse(step.requestPayload),msg=i?'FREE_GAME':'BET';
  check(q.MSGID===msg&&p.MSGID===msg&&step.msgId===msg,'MESSAGE_MISMATCH');
  check(q.GN==='richlittlepiggiesworldclass96'&&q.AP==='false'&&q.BPL==='5'&&q.LB==='25'&&Object.keys(q).length===6,'REQUEST_MISMATCH');
  check(/^gdmgcm.{1,505}$/.test(q.PID??'')&&(!i||q.PID===session),'SESSION_CHANGED');session=q.PID;
  check(['','0','0|'].includes(p.FID??'')&&(p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0'&&Object.keys(p).every(k=>!['CFG','ABPM','SB','FRTR','FRTW','BUY_IN'].includes(k)&&!/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k)),'PIGGIES_FEATURE_NOT_ADAPTED');
  check(Object.keys(parse(p.GSD??'','#','~')).every(k=>allowed.has(k)),'PIGGIES_FEATURE_NOT_ADAPTED');
  check(p.IFG===(i?'1':'0')&&(!i||p.NFG!==undefined),'INVALID_FREE_GAME_STATE');
  const n=num(p.NFG??'0'),t=num(p.TFG??'0'),c=num(p.CFGG??'0');
  if(n||i){check(p.TFG!==undefined&&p.CFGG!==undefined&&t===n+c&&t>0&&t<=99,'PIGGIES_COUNTER_MISMATCH');check(i?remaining>0&&c===progress+1&&t>=total&&n===remaining-1+t-total:c===0&&num(p.FGT)===n,'PIGGIES_COUNTER_MISMATCH');}
  else check(t===0&&c===0&&num(p.FGT??'0')===0,'PIGGIES_COUNTER_MISMATCH');
  for(const k of ['B','AB','TW'])num(p[k]);remaining=n;total=t;progress=c;last=p;
 }
 check(remaining===0,'INCOMPLETE_ROUND');
 check(Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=0&&raw.startBalanceRaw-num(last.B)+num(last.TW)===100,'TRIAL_ACTUAL_COST_MISMATCH');
 check(last.B===last.AB,'BALANCE_MISMATCH');
 check(mapping.buy===0&&mapping.bonus===(raw.steps.length>1?1:0)&&/^[a-f0-9]{64}$/.test(mapping.typeMappingHash),'PIGGIES_MAPPING_MISMATCH');
}
