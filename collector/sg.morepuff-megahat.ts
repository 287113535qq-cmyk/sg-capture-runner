/** Independent bounded MegaHat normalization. No source admission here. */
const need=(ok:unknown,code:string):void=>{if(!ok)throw Error(code);};
function parse(s:string,sep='&',del='='):Record<string,string>{
 need(typeof s==='string','MEGAHAT_PARAMETERS');const out:Record<string,string>={};
 for(const part of s.split(sep).filter(Boolean)){const at=part.indexOf(del),key=part.slice(0,at);
  need(at>0&&!Object.prototype.hasOwnProperty.call(out,key)&&(del!=='~'||at===part.lastIndexOf(del)),'MEGAHAT_PARAMETERS');out[key]=part.slice(at+1);}
 return out;
}
const num=(v:any):number=>{need(typeof v==='string'?/^\d+$/.test(v):Number.isSafeInteger(v),'MEGAHAT_NUMBER');const n=Number(v);need(Number.isSafeInteger(n)&&n>=0,'MEGAHAT_NUMBER');return n;};
export function hasMegaHat(raw:any):boolean{return raw.sourceKey==='huffnmorepuffhighlimit96-round-one-base-v1'&&raw.steps.some((s:any)=>['1|2','1|2|'].includes(parse(s.responsePayload).FID));}
export function megaHatFields(raw:any,mappingHash:string){
 need(hasMegaHat(raw)&&raw.protocol==='nextgen'&&raw.roundFieldsVersion==='sg-round-fields-v1'&&raw.fixtureOnly===false&&raw.steps.length===3,'MEGAHAT_PROFILE');
 need(mappingHash==='af2fadb272854c5cb8720ae5f64e3247fa5472c52a3772e0d7b0e64d3ed2317c','MEGAHAT_MAPPING');
 const start=num(raw.startBalanceRaw),base=['BRS','BMS','BSPOS','VA','BWC','BWS'];let session:string|undefined,end=0,win=0;
 for(let i=0;i<3;i++){
  const step=raw.steps[i],q=parse(step.requestPayload),p=parse(step.responsePayload),msg=i?'FREE_GAME':'BET';
  need(q.MSGID===msg&&p.MSGID===msg&&step.msgId===msg,'MEGAHAT_MESSAGE');
  need(Object.keys(q).length===5&&q.GN==='huffnmorepuffhighlimit96'&&q.BPR==='100'&&q.RB==='5','MEGAHAT_REQUEST');
  need(typeof q.PID==='string'&&q.PID.startsWith('gdmgcm')&&q.PID.length>6&&q.PID.length<512&&(!session||session===q.PID),'MEGAHAT_SESSION');session=q.PID;
  need(num(step.elapsedMs)<=300000,'MEGAHAT_TIMING');
  need(!['CFG','ABPM','SB','FRTR','FRTW','BUY_IN'].some(k=>p[k]!==undefined)&&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k))&&(p.FRBAL??'0')==='0'&&(p.GCT??'0')==='0','MEGAHAT_UNREVIEWED');
  need(p.IFG===(i?'1':'0')&&p.RID==='0','MEGAHAT_UNREVIEWED');
  const total=num(p.TFG),remaining=num(p.NFG),played=num(p.CFGG);
  need(total===remaining+played,'MEGAHAT_COUNTER');need(total===1&&remaining===(i===2?0:1)&&played===(i===2?1:0),'MEGAHAT_UNREVIEWED');
  need((i===0?['2','2|']:i===1?['1|2','1|2|']:['0','0|','1','1|']).includes(p.FID),'MEGAHAT_UNREVIEWED');
  const g=parse(p.GSD,'#','~');need(Object.keys(g).every(k=>base.includes(k)||(i===1&&['WHSTOP','WHSLICE','WHEELSPIN'].includes(k))),'MEGAHAT_UNREVIEWED');
  const symbols=(g.VA??'').split(',').map(num);need(symbols.length===15,'MEGAHAT_SYMBOLS');
  need(!(symbols.filter(v=>v===13).length>=3&&symbols.filter(v=>v===14).length>=6),'MEGAHAT_UNREVIEWED');
  if(i===1)need(g.WHSTOP==='3'&&g.WHSLICE==='MEGAHAT'&&g.WHEELSPIN==='1','MEGAHAT_UNREVIEWED');
  const balance=num(p.B),available=num(p.AB),award=num(p.TW);
  need(balance===available&&start-balance+award===2000&&award>=win,'MEGAHAT_MONEY');
  if(step.responseBalance!==undefined&&step.responseBalance!==null)need(num(step.responseBalance)===balance,'MEGAHAT_MONEY');end=balance;win=award;
 }
 return {roundFieldsVersion:raw.roundFieldsVersion,protocol:raw.protocol,sourceKey:raw.sourceKey,bet:20,mul:win/2000,buy:0,bonus:3,primaryBonusKind:'freeGame',typeMappingHash:mappingHash,money:{startBalanceRaw:start,endBalanceRaw:end,totalWinRaw:win,betRaw:2000}};
}
