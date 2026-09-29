import {demonNextRequest} from './demon-protocol.mjs';
const need=(b,c)=>{if(!b)throw Error(c);};
const integer=x=>{need(typeof x==='string' && /^\d+$/.test(x) && Number.isSafeInteger(Number(x)),'INVALID_PROTOCOL_COUNTER');return Number(x);};
const parts=(s,sep='&',eq='=')=>{const d={};for(const item of s.split(sep)){if(!item)continue;const at=item.indexOf(eq);need(at>0&&!Object.hasOwn(d,item.slice(0,at)),'NESTED_PARAMETER_AMBIGUOUS');d[item.slice(0,at)]=item.slice(at+1);}return d;};
export function nestedNext(raw){
 if(!raw.steps.some(s=>parts(s.responsePayload).FID==='0|1|'))return demonNextRequest(raw);
 need(raw.sourceKey==='thedemoncodecap250c96-round-one-base-v1'&&raw.protocol==='nextgen'&&raw.steps.length>0&&raw.steps.length<=100,'NESTED_PROFILE_REQUIRED');
 let expected='BET',player,previous,saved,seen=false,index=0,prior;
 for(const st of raw.steps){
  need(expected!==null&&st.msgId===expected,'NESTED_SEQUENCE_CHANGED');const r=parts(st.requestPayload),p=parts(st.responsePayload),fid=p.FID??'';
  need(r.MSGID===st.msgId&&p.MSGID===st.msgId,'MESSAGE_ID_MISMATCH');need(/^gdmgcm.{1,505}$/.test(r.PID??'')&&(player===undefined||r.PID===player),'SESSION_CHANGED_MID_ROUND');player=r.PID;
  need(Object.keys(r).sort().join(',')==='BPR,GN,MSGID,PID,RB'&&r.BPR==='10'&&r.RB==='10'&&r.GN==='thedemoncodecap250c96','FIRST_ROUND_REQUEST_MODE');
  need(['','0','0|','1|0|','0|1|'].includes(fid)&&!Object.keys(p).some(k=>/^(FS_|NFR_)/.test(k))&&p.CFG===undefined&&p.ABPM===undefined,'UNKNOWN_TRIAL_FEATURE');
  need(['0','1'].includes(p.IFG)&&(st.msgId!=='FREE_GAME'||p.IFG==='1'),'INVALID_FREE_GAME_STATE');for(const k of ['B','AB','TW'])integer(p[k]);
  const [n,t,c]=['NFG','TFG','CFGG'].map(k=>p[k]===undefined?null:integer(p[k]));need([n,t,c].every(v=>v===null||v<=100),'TRIAL_FREE_LIMIT');
  if(st.msgId==='FREE_GAME'||fid==='1|0|'||n)need([n,t,c].every(v=>v!==null),'DEMON_MISSING_FREE_COUNTER');
  if(fid==='0|1|'){
   need(st.msgId==='FREE_GAME'&&['1|0|','0|1|'].includes(previous),'NESTED_ENTRY_CHANGED');const d=parts(p.GSD??'','#','~');const outer=['STFG','SCFGG','SNFG'].map(k=>integer(d[k]));
   need(outer.every(v=>v<=100)&&outer[0]===outer[1]+outer[2],'NESTED_SAVED_COUNTERS_INVALID');need(t===c+n,'NESTED_INNER_COUNTERS_INVALID');
   if(previous==='0|1|')need(JSON.stringify(outer)===JSON.stringify(saved),'NESTED_SAVED_COUNTERS_CHANGED');if(previous==='1|0|'){if(!seen)need(demonNextRequest({...raw,steps:raw.steps.slice(0,index)})?.MSGID==='FREE_GAME','NESTED_ENTRY_CHANGED');need(JSON.stringify(outer)===JSON.stringify([integer(prior.TFG),integer(prior.CFGG)+1,integer(prior.NFG)-1]),'NESTED_OUTER_TRANSITION_CHANGED');}saved=outer;seen=true;
   need(n>0,'NESTED_TERMINAL_REQUIRES_REVIEW');
  }else if(previous==='0|1|'){need(fid==='1|0|'&&n>0&&JSON.stringify([t,c,n])===JSON.stringify(saved),'NESTED_RETURN_REQUIRES_REVIEW');saved=undefined;}
  else if(seen){
   if(n===0)need(previous==='1|0|'&&integer(prior.NFG)===1&&['','0','0|'].includes(fid)&&saved===undefined,'NESTED_TERMINAL_REQUIRES_REVIEW');
   else need(previous==='1|0|'&&fid==='1|0|'&&t===c+n&&c===integer(prior.CFGG)+1&&t>=integer(prior.TFG),'NESTED_OUTER_PROGRESS_REQUIRES_REVIEW');
  }
  if(seen&&fid!=='0|1|'){const d=parts(p.GSD??'','#','~');need(d.SNFG===undefined||integer(d.SNFG)===0,'NESTED_UNCLEARED_SAVED_COUNTER');}
  previous=fid;prior=p;index++;expected=n?'FREE_GAME':null;
 }
 return expected?{MSGID:expected}:null;
}

export const DEMON_NESTED_EXTENSION='thedemoncodecap250c96-round-one-base-v1-demon-nested-free-v1';
export const hasNested=raw=>raw.steps.some(s=>parts(s.responsePayload).FID==='0|1|');
export function nestedMapping(raw,hash){
 need(hasNested(raw)&&nestedNext(raw)===null&&typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash),'NESTED_MAPPING_REQUIRED');
 return {buy:0,bonus:2,typeMappingHash:hash};
}
