import {settledFields} from './sg.fields';
const {reviewFeatureValues,parseFeatureValues}=require('./feature-state.cjs');
const source='huffnpuffmoneymansionhighlimit96-round-one-base-v1';
const need=(ok:unknown,code:string):void=>{if(!ok)throw Error(code);};
function pairs(text:string,separator='&',delimiter='='):Record<string,string>{
  need(typeof text==='string','HUFF_PAYLOAD');const result:Record<string,string>=Object.create(null);
  for(const item of text.split(separator).filter(Boolean)){
    const n=item.indexOf(delimiter),key=item.slice(0,n);
    need(n>0&&!Object.prototype.hasOwnProperty.call(result,key),'HUFF_DUPLICATE_FIELD');result[key]=item.slice(n+1);
  }return result;
}
function vector(text:string,separator:string,signed=false):number[]{
  need(typeof text==='string'&&text.length,'HUFF_MISSING_VECTOR');
  const xs=text.split(separator);need(xs.every(x=>(signed?/^-?\d+$/:/^\d+$/).test(x)&&Number.isSafeInteger(Number(x))),'HUFF_VECTOR');return xs.map(Number);
}
const ids=(s=''):string=>s.replace(/\|$/,'');
export function hasHuffTouchup(raw:any):boolean{return raw.sourceKey===source&&raw.steps.some((s:any)=>ids(pairs(s.responsePayload).FID).split('|').includes('2'));}
export function huffTouchupFields(raw:any,mappingHash:string){
  need(hasHuffTouchup(raw)&&raw.fixtureOnly===false&&raw.protocol==='nextgen'
    &&raw.roundFieldsVersion==='sg-round-fields-v1'&&raw.steps.length===8,'HUFF_TOUCHUP_PROFILE');
  need(/^[a-f0-9]{64}$/.test(mappingHash),'HUFF_TOUCHUP_MAPPING');
  const allowed=new Set(['MMBG','BRS','BGHHPOS','BMS','VA','HHPOS','BWC','BWS','FEAT','NEXTFRAMES','MMW','PCFID','FRAMES','PREVFRAMES','FRAMEWINS']);
  let player:string|undefined,last:Record<string,string>={};
  raw.steps.forEach((step:any,i:number)=>{
    const p=pairs(step.responsePayload),req=pairs(step.requestPayload),g=pairs(p.GSD??'','#','~'),msg=i?'FREE_GAME':'BET';
    need(step.msgId===msg&&p.MSGID===msg&&req.MSGID===msg,'HUFF_MESSAGE');
    need(Object.keys(req).sort().join(',')==='AP,BPR,GN,MSGID,PID,RB'&&req.AP==='false'&&req.BPR==='25'&&req.GN==='huffnpuffmoneymansionhighlimit96'&&req.RB==='5','HUFF_REQUEST');
    need(/^gdmgcm.{1,505}$/.test(req.PID??'')&&(player===undefined||player===req.PID),'HUFF_SESSION');player=req.PID;
    need(Number.isSafeInteger(step.elapsedMs)&&step.elapsedMs>=0&&step.elapsedMs<=300000,'HUFF_TIMING');
    need(Object.keys(g).every(k=>allowed.has(k)),'HUFF_UNKNOWN_GSD');
    need(p.RID==='0'&&!('GCT'in p)&&p.IFG===(i?'1':'0'),'HUFF_REPLAY');
    need((p.FRBAL??'0')==='0'&&!['CFG','ABPM','SB','FRTR','FRTW','BUY_IN'].some(k=>k in p)
      &&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k)),'HUFF_UNKNOWN_FEATURE');
    for(const k of ['B','AB','TW','NFG','TFG','CFGG'])need(/^\d+$/.test(p[k]??'')&&Number.isSafeInteger(Number(p[k])),'HUFF_NUMBER');
    const board=vector(g.VA,',');need(board.length===15&&board.every(v=>v<=15),'HUFF_BOARD');
    need(!(board.filter(v=>v===13).length>=3&&board.filter(v=>v===14).length>=6),'HUFF_COMBINED');
    if('FRAMEWINS'in g){const wins=reviewFeatureValues(g.FRAMEWINS,{size:15,displaySentinels:[-1,-2,-3,-4,-5],continuationSentinels:[-100]});
      parseFeatureValues(g.FRAMES,{size:15,decimalPlaces:0});need(!wins.requiresFeatureContinuation,'HUFF_FRAME_EXIT');}
    if(i===0)need(ids(p.FID)==='0'&&!ids(g.PCFID)&&g.FEAT===undefined&&g.MMBG==='1'&&!g.MMW&&p.NFG==='1'&&p.TFG==='1'&&p.CFGG==='0','HUFF_TRIGGER');
    else if(i===1)need(ids(p.FID)==='2'&&ids(g.PCFID)==='0'&&g.FEAT==='MMANSION'&&g.MMBG==='1'&&g.MMW&&p.NFG==='6'&&p.TFG==='6'&&p.CFGG==='0','HUFF_AWARD');
    else need(ids(p.FID)==='2'&&['','2'].includes(ids(g.PCFID))&&g.FEAT==='PAINT'&&[undefined,'0'].includes(g.MMBG)&&!g.MMW
      &&Number(p.NFG)===7-i&&p.TFG==='6'&&Number(p.CFGG)===i-1&&'FRAMEWINS'in g&&'FRAMES'in g,'HUFF_PROGRESS');
    last=p;
  });
  need(last.B===last.AB&&(raw.steps[7].responseBalance===undefined||Number(raw.steps[7].responseBalance)===Number(last.B)),'HUFF_BALANCE');
  const f=settledFields(raw.startBalanceRaw,Number(last.B),Number(last.TW),0,4);need(f.money.betRaw===500,'HUFF_STAKE');
  return {...f,protocol:'nextgen',sourceKey:source,primaryBonusKind:'freeGame',typeMappingHash:mappingHash};
}
