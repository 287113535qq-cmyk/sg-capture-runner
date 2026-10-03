// Independent collector settlement evidence for isolated FID1 retriggers.
const assert=require('node:assert/strict');
const {advanceFreeGameCounters}=require('./free-game-counters.cjs');
const {parseFeatureHistory,checkFeatureWallet}=require('./feature-state.cjs');
const {XMLParser,XMLValidator}=require('fast-xml-parser');
const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false});
const fields=(text,sep='&',del='=')=>{assert.equal(typeof text,'string');const out=Object.create(null);for(const part of text.split(sep).filter(Boolean)){const at=part.indexOf(del),key=part.slice(0,at);assert(at>0&&!Object.hasOwn(out,key));out[key]=part.slice(at+1);}return out;};
const uint=v=>{assert(/^(0|[1-9]\d*)$/.test(String(v)));const n=Number(v);assert(Number.isSafeInteger(n));return n;};
const vector=(s,sep)=>{assert.equal(typeof s,'string');assert(s.length);return s.split(sep).map(uint);};
const known=new Set('BRS BGHHPOS BMS HHADD VA HHPOS HHNPOS CFFGT CFTFG PREVFRAMES CFCFGG PCFID FMS FEAT FRAMES CFNFG FRAMEWINS'.split(' '));
function review(raw){
 assert(raw.fixtureOnly===false&&raw.protocol==='nextgen'&&raw.sourceKey==='huffnpuffmoneymansionhighlimit96-round-one-base-v1'&&raw.roundFieldsVersion==='sg-round-fields-v1');
 assert(Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=100);
 let player,total,remaining,previousTotal,previousRemaining,retriggers=0,last;
 for(let i=0;i<raw.steps.length;i++){
  const step=raw.steps[i],msg=i?'FREE_GAME':'BET',q=fields(step.requestPayload),p=fields(step.responsePayload),g=fields(p.GSD??'','#','~');
  assert.equal(Object.keys(q).sort().join(), 'AP,BPR,GN,MSGID,PID,RB');
  assert(q.AP==='false'&&q.BPR==='25'&&q.GN==='huffnpuffmoneymansionhighlimit96'&&q.RB==='5'&&q.MSGID===msg&&step.msgId===msg&&p.MSGID===msg);
  assert(/^gdmgcm.{1,505}$/.test(q.PID)&&(player===undefined||player===q.PID));player=q.PID;
  assert(typeof step.responseXml==='string'&&step.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(step.responseXml)&&XMLValidator.validate(step.responseXml)===true);
  const xml=parser.parse(step.responseXml).GDMRESPONSE;assert(xml&&String(xml.SUCCESS).toLowerCase()==='true'&&xml.PAYLOAD===step.responsePayload);
  assert(uint(step.elapsedMs)<=300000&&['1','1|'].includes(p.FID)&&p.IFG===(i?'1':'0')&&p.RID===(i?'1':'0'));
  assert(!Object.keys(p).some(k=>['CFG','ABPM','GCT','SB','FRTR','FRTW','BUY_IN'].includes(k)||/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k))&&(p.FRBAL??'0')==='0');
  assert(Object.keys(g).every(k=>known.has(k)));const board=vector(g.VA,',');assert(board.length===15&&board.every(n=>n<=15));
  assert(!(board.filter(n=>n===13).length>=3&&board.filter(n=>n===14).length>=6));
  if('FRAMEWINS'in g)assert(vector(g.FRAMEWINS,'|').length===15&&vector(g.FRAMES,'|').length===15);
  total=uint(p.TFG);remaining=uint(p.NFG);const progress=uint(p.CFGG);assert(total>0&&total<100&&total===remaining+progress&&progress===i);
  if(i===0)assert(total===6&&remaining===6&&!g.PCFID&&!g.FEAT);
  else{
   const added=uint(g.CFFGT);advanceFreeGameCounters({total:previousTotal,remaining:previousRemaining,played:i-1},{total,remaining,played:progress},{added,maximum:99});
   assert.equal(g.FEAT,'HARDHAT');parseFeatureHistory(g.PCFID??'',[1],{maximum:100});
   assert(uint(g.CFTFG)===total&&uint(g.CFNFG)===remaining&&uint(g.CFCFGG)===progress);retriggers+=Number(added>0);
  }
  checkFeatureWallet(uint(raw.startBalanceRaw),500,uint(p.B),uint(p.AB),uint(p.TW),{settled:remaining===0,responseBalance:step.responseBalance===undefined?undefined:uint(step.responseBalance)});
  last=p;previousTotal=total;previousRemaining=remaining;
 }
 return {complete:remaining===0,next:remaining?'FREE_GAME':null,retriggers,total,start:uint(raw.startBalanceRaw),end:uint(last.B),win:uint(last.TW)};
}
module.exports={review};
