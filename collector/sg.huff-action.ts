import {XMLParser,XMLValidator} from 'fast-xml-parser';
const featureState=require('./feature-state.cjs');
const source='huffnpuffmoneymansionhighlimit96-round-one-base-v1',version='huff-action-v1';
const contractHash='9a9a312a3b8bb858ac878bb03f429a2e8f86dda0c0be48fc17b72af30fca8670';
const request={AP:'false',BPR:'25',GN:'huffnpuffmoneymansionhighlimit96',RB:'5'};
const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,trimValues:false});
const need=(ok:any,code:string)=>{if(!ok)throw Error('HUFF_ACTION_'+code);};
const own=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key);
function uint(v:any):number{need((typeof v==='string'&&/^\d+$/.test(v)||typeof v==='number')
  &&Number.isSafeInteger(Number(v))&&Number(v)>=0,'NUMBER');return Number(v);}
function fields(text:any,separator='&',equals='='):Record<string,string>{
  need(typeof text==='string','PAYLOAD');const out:Record<string,string>=Object.create(null);
  for(const part of text.split(separator).filter(Boolean)){
    const at=part.indexOf(equals),key=part.slice(0,at);need(at>0&&!own(out,key),'AMBIGUOUS_PAYLOAD');
    out[key]=part.slice(at+1);
  }return out;
}
function slots(text:any,max=100):number[]{
  if(text===undefined||text==='')return [];
  need(typeof text==='string'&&/^\d+(?:\|\d+)*\|?$/.test(text),'FEATURE_ID');
  const ids=text.replace(/\|$/,'').split('|').map(uint);
  need(ids.length<=max&&ids.every((n:number)=>n<=4),'UNREVIEWED_ROUTE');return ids;
}
export function huffActionNext(raw:any,plan:any):{MSGID:string}|null{
  need(plan.gameId===32714&&plan.runtimeGameId===33114&&plan.sourceKey===source&&plan.betRaw===500&&plan.buy===0
    &&plan.featureProfile===version&&plan.actionContractHash===contractHash&&plan.maxSteps===100
    &&Object.keys(plan.requestParams??{}).length===4
    &&Object.entries(request).every(([k,v])=>plan.requestParams[k]===v),'PROFILE');
  need(raw.fixtureOnly===false&&raw.protocol==='nextgen'&&raw.sourceKey===source&&raw.roundFieldsVersion==='sg-round-fields-v1'
    &&raw.requestFlowVersion===version&&raw.actionContractHash===contractHash,'RAW_CONTRACT');
  need(Array.isArray(raw.steps)&&raw.steps.length<=100,'STEPS');const start=uint(raw.startBalanceRaw);need(start>=500,'START');
  let next:string|null='BET',pid:string|undefined,previous:any,priorWin=0,priorFeatures:number[]=[];
  for(const [i,s]of raw.steps.entries()){
    need(next!==null&&s.msgId===next,'SEQUENCE');const q=fields(s.requestPayload),p=fields(s.responsePayload),g=fields(p.GSD??'','#','~');
    need(Object.keys(q).sort().join(',')==='AP,BPR,GN,MSGID,PID,RB'&&q.MSGID===next
      &&Object.entries(request).every(([k,v])=>q[k]===v),'REQUEST');
    need(/^gdmgcm.{1,505}$/.test(q.PID??'')&&(pid===undefined||pid===q.PID),'SESSION');pid=q.PID;
    need(s.methodName==='processGameMessage'&&p.MSGID===next&&p.IFG===String(Number(i>0)),'MESSAGE');
    need(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml)
      &&XMLValidator.validate(s.responseXml)===true,'XML');const root=parser.parse(s.responseXml).GDMRESPONSE;
    need(root&&Object.keys(root).every(k=>['SUCCESS','PAYLOAD','OGS_RC'].includes(k))
      &&typeof root.SUCCESS==='string'&&root.SUCCESS.toLowerCase()==='true'&&root.PAYLOAD===s.responsePayload
      &&(root.OGS_RC===undefined||root.OGS_RC==='0'),'XML');
    need(uint(s.elapsedMs)<=300000,'TIMING');
    need((p.GCT??'0')==='0'&&(p.FRBAL??'0')==='0'
      &&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k))
      &&!['CFG','ABPM','SB','FRTR','FRTW','BUY_IN'].some(k=>own(p,k)),'UNREVIEWED_ROUTE');
    const ids=slots(p.FID,2);need(new Set(ids).size===ids.length,'FEATURE_ID');slots(g.PCFID);
    need([undefined,'MMANSION','HARDHAT','PAINT','HOMEIMP','MANSION'].includes(g.FEAT),'UNREVIEWED_ROUTE');
    need([undefined,'0','1'].includes(g.MMBG)&&[undefined,'0','1'].includes(g.MMFG),'MANSION_FLAG');
    const ordinary=i===0&&!ids.length&&!['NFG','TFG','CFGG'].some(k=>own(p,k));
    const n=ordinary?0:uint(p.NFG),t=ordinary?0:uint(p.TFG),c=ordinary?0:uint(p.CFGG);
    need(n+c===t&&t<=100,'COUNTERS');
    if(ids.length===1&&ids[0]===2){
      for(const [display,value] of [['CFNFG',n],['CFTFG',t],['CFCFGG',c]] as [string,number][])
        if(g[display]!==undefined)need(uint(g[display])===value,'DISPLAY_COUNTERS');
      for(const display of ['CFFGT','FMS'])if(g[display]!==undefined)uint(g[display]);
    }
    if(previous){
      if(JSON.stringify(ids)===JSON.stringify(previous.ids))need(previous.n>0&&c===previous.c+1
        &&t>=previous.t&&n===previous.n-1+t-previous.t,'PROGRESS');
      else {
        const selected=previous.ids.length===1&&previous.ids[0]===0&&previous.intro&&ids.length===1&&ids[0]>0
          &&g.FEAT==='MMANSION'&&!!g.MMW&&n===6&&t===6&&c===0;
        const from=previous.ids[0],history=slots(g.PCFID);
        const awarded=previous.ids.length===1&&from>0&&ids.length===1&&ids[0]===0&&previous.n===1
          &&n===1&&t===1&&c===0&&g.MMFG==='1'&&!g.MMW
          &&g.FEAT===['MMANSION','HARDHAT','PAINT','HOMEIMP','MANSION'][from]
          &&uint(g.CFNFG)===0&&uint(g.CFTFG)===previous.t&&uint(g.CFCFGG)===previous.c+1
          &&JSON.stringify(history)===JSON.stringify(priorFeatures)&&g.FRAMEWINS!==undefined
          &&featureState.reviewFeatureValues(g.FRAMEWINS,{size:from===3?20:15,
            displaySentinels:[-1,-2,-3,-4,-5],continuationSentinels:[-100]}).requiresFeatureContinuation;
        need(selected||awarded,'UNREVIEWED_TRANSITION');
      }
    }else need(c===0,'TRIGGER');
    const intro=ids[0]===0&&(g.MMBG==='1'||g.MMFG==='1'&&n===1&&t===1&&c===0)&&!g.MMW;next=n>0||intro?'FREE_GAME':null;
    const b=uint(p.B),ab=uint(p.AB),win=uint(p.TW);need(win>=priorWin,'WIN_REGRESSION');priorWin=win;
    featureState.checkFeatureWallet(start,500,b,ab,win,{settled:next===null,
      responseBalance:s.responseBalance===undefined?undefined:uint(s.responseBalance)});
    if(next===null){
      need(ids.length<=1,'UNREVIEWED_EXIT');
      if(g.FRAMEWINS!==undefined){const result=featureState.reviewFeatureValues(g.FRAMEWINS,{size:ids[0]===3?20:15,
        displaySentinels:[-1,-2,-3,-4,-5],continuationSentinels:[-100]});need(!result.requiresFeatureContinuation,'UNREVIEWED_EXIT');}
      if(g.VA){const board=g.VA.split(',').map(uint);
        need(!(board.filter(v=>v===13).length>=3&&board.filter(v=>v===14).length>=6),'UNREVIEWED_EXIT');}
    }
    previous={ids,n,t,c,intro};priorFeatures.unshift(...ids);
  }
  return next?{MSGID:next}:null;
}
export function prepareNextgenActionRound(raw:any,plan:any){
  need(huffActionNext(raw,plan)===null,'INCOMPLETE');const p=fields(raw.steps[raw.steps.length-1].responsePayload);
  const start=uint(raw.startBalanceRaw),end=uint(p.B),win=uint(p.TW);
  need(uint(p.AB)===end&&start-end+win===500,'SETTLEMENT');
  return {roundFieldsVersion:'sg-round-evidence-v2',protocol:'nextgen',sourceKey:source,bet:5,mul:win/500,
    buy:0,bonus:null,primaryBonusKind:null,classificationStatus:'pending',typeMappingHash:contractHash,requestFlowVersion:version,
    money:{startBalanceRaw:start,endBalanceRaw:end,totalWinRaw:win,betRaw:500}};
}

export const hasHuffHomeImprovement=(raw:any)=>raw?.sourceKey===source&&Array.isArray(raw.steps)
  &&raw.steps.some((s:any)=>(fields(s.responsePayload).FID??'').replace(/\|$/,'').split('|').includes('3'));
export const hasHuffActionBridge=(raw:any)=>hasHuffHomeImprovement(raw)||raw?.sourceKey===source
  &&Array.isArray(raw.steps)&&raw.steps.some((s:any)=>{
    const p=fields(s.responsePayload),g=fields(p.GSD??'','#','~');
    return (p.FID??'').replace(/\|$/,'').split('|').includes('2')
      &&['CFNFG','CFTFG','CFCFGG','CFFGT','FMS'].some(k=>own(g,k));
  });
export function prepareLegacyHuffActionRound(raw:any,mapping:any){
  need(!own(raw,'requestFlowVersion')&&!own(raw,'actionContractHash'),'LEGACY_CONTRACT');
  need(mapping.buy===0&&mapping.bonus===null&&mapping.typeMappingHash===contractHash,'MAPPING');
  return prepareNextgenActionRound({...raw,requestFlowVersion:version,actionContractHash:contractHash},
    {gameId:32714,runtimeGameId:33114,sourceKey:source,betRaw:500,buy:0,maxSteps:100,
      featureProfile:version,actionContractHash:contractHash,requestParams:request});
}
