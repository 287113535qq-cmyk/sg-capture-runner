// Independent retrigger sequence review. No source permission.
import {parseXml,children,one} from './pearl-protocol.mjs';
const need=(ok,code)=>{if(!ok)throw Error('HARDHAT_'+code);};
const uint=v=>{need(/^(0|[1-9]\d*)$/.test(String(v))&&Number.isSafeInteger(Number(v)),'INTEGER');return Number(v);};
const parse=(s,sep,del)=>{need(typeof s==='string','PAYLOAD');const out={};for(const v of s.split(sep)){if(!v)continue;const i=v.indexOf(del);need(i>0&&!Object.hasOwn(out,v.slice(0,i)),'PAYLOAD');out[v.slice(0,i)]=v.slice(i+1);}return out;};
const nums=(s,sep=',')=>{need(typeof s==='string'&&s.length>0,'BOARD');return s.split(sep).map(uint);};
const known=new Set('BRS BGHHPOS BMS HHADD VA HHPOS HHNPOS CFFGT CFTFG PREVFRAMES CFCFGG PCFID FMS FEAT FRAMES CFNFG FRAMEWINS'.split(' '));
export function review(raw){
 need(raw.sourceKey==='huffnpuffmoneymansionhighlimit96-round-one-base-v1'&&raw.protocol==='nextgen'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','PROFILE');
 need(Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=100,'STEPS');
 let player,priorTotal,priorRemaining,remaining,total,retriggers=0;
 for(const [i,s]of raw.steps.entries()){
  const msg=i?'FREE_GAME':'BET';need(s.msgId===msg,'SEQUENCE');
  const q=parse(s.requestPayload,'&','=');need(Object.keys(q).sort().join()==='AP,BPR,GN,MSGID,PID,RB'&&q.AP==='false'&&q.BPR==='25'&&q.GN==='huffnpuffmoneymansionhighlimit96'&&q.RB==='5'&&q.MSGID===msg&&/^gdmgcm.{1,505}$/.test(q.PID),'REQUEST');
  need(player===undefined||player===q.PID,'SESSION');player=q.PID;
  const p=parse(s.responsePayload,'&','='),g=parse(p.GSD??'','#','~'),root=parseXml(s.responseXml);
  const text=n=>n.children.map(c=>c.text??'').join('');
  need(root.tag.toUpperCase()==='GDMRESPONSE'&&text(one(root,'SUCCESS')).toLowerCase()==='true'&&text(one(root,'PAYLOAD'))===s.responsePayload,'XML');
  need(uint(s.elapsedMs)<=300000,'TIMING');
  need(p.MSGID===msg&&['1','1|'].includes(p.FID)&&p.IFG===(i?'1':'0')&&p.RID===(i?'1':'0'),'FEATURE');
  need(!Object.keys(p).some(k=>['CFG','ABPM','GCT','SB','FRTR','FRTW','BUY_IN'].includes(k)||/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k))&&(p.FRBAL??'0')==='0','UNREVIEWED');
  need(Object.keys(g).every(k=>known.has(k)),'UNKNOWN_FIELD');
  const board=nums(g.VA);need(board.length===15&&board.every(n=>n<=15),'BOARD');
  need(!(board.filter(n=>n===13).length>=3&&board.filter(n=>n===14).length>=6),'COMBINED_EXIT');
  if(g.FRAMEWINS!==undefined)need(nums(g.FRAMEWINS,'|').length===15&&nums(g.FRAMES,'|').length===15,'FRAME_EXIT');
  total=uint(p.TFG);remaining=uint(p.NFG);const progress=uint(p.CFGG);
  need(total>0&&total<100&&total===remaining+progress&&progress===i,'COUNTER');
  if(!i)need(total===6&&remaining===6&&!g.PCFID&&!g.FEAT,'TRIGGER');
  else{
   need(priorRemaining>0,'AFTER_END');const added=uint(g.CFFGT);
   need(total===priorTotal+added&&remaining===priorRemaining-1+added,'COUNTER');
   need(g.FEAT==='HARDHAT'&&(added?['1|1|','1|1']:['1|','1']).includes(g.PCFID),'PREVIOUS_SLOTS');
   need(uint(g.CFTFG)===total&&uint(g.CFNFG)===remaining&&uint(g.CFCFGG)===progress,'COUNTER');retriggers+=Number(added>0);
  }
  priorTotal=total;priorRemaining=remaining;
  need(s.responseBalance===undefined||uint(s.responseBalance)===uint(p.B),'BALANCE');
  need(uint(p.B)===uint(p.AB)&&uint(raw.startBalanceRaw)-uint(p.B)+uint(p.TW)===500,'MONEY');
 }
 return {next:remaining?'FREE_GAME':null,candidateComplete:remaining===0,retriggers,total,sourceRequests:0,captureAuthorized:false,naturalTerminalObserved:false};
}

export const HUFF_RETRIGGER_EXTENSION='huffnpuffmoneymansionhighlimit96-round-one-base-v1-hard-hat-retrigger-v2';
export function hasRetrigger(raw){
 if(raw.sourceKey!=='huffnpuffmoneymansionhighlimit96-round-one-base-v1')return false;
 return raw.steps.some(s=>{const g=parse(parse(s.responsePayload,'&','=').GSD??'','#','~');return (g.PCFID??'').replace(/\|$/,'')==='1|1'||g.FEAT==='HARDHAT'&&!['0','',undefined].includes(g.CFFGT);});
}
