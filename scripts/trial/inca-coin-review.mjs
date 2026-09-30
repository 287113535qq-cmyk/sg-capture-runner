// Independent positive-coin/free validation. Capture permission remains separate.
// Independently reviewed ten-free scope; complete continuation shape remains synthetic.
// Official Inca route also checks nested free counters and forced termination.
// Standalone FID1 is supported; switching feature at NFG0 is not an exit.
export const INCA_SOURCE='hyperchargedincajungle96-round-one-base-v1';
export const INCA_EXTENSION=INCA_SOURCE+'-inca-coin-free-v1';
const expected={BPL:'1',GN:'hyperchargedincajungle96',LB:'40'};
const check=(v,e)=>{if(!v)throw Error(e);};
function pairs(text,sep='&',eq='='){
  check(typeof text==='string','INVALID_PARAMETERS');const p=Object.create(null);
  for(const item of text.split(sep).filter(Boolean)){
    const at=item.indexOf(eq),key=item.slice(0,at);
    check(at>0&&!Object.hasOwn(p,key)&&(eq!=='~'||item.lastIndexOf(eq)===at),'AMBIGUOUS_PARAMETERS');
    p[key]=item.slice(at+1);
  }return p;
}
function integer(v){check(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v)),'INVALID_NUMBER');return Number(v);}
export function hasIncaCoins(raw){return raw.steps.some(s=>Object.keys(pairs(pairs(s.responsePayload).GSD??'','#','~')).some(k=>['CL','BGCL'].includes(k)));}
export function incaCoinSequence(raw){
  check(raw.sourceKey===INCA_SOURCE&&raw.protocol==='nextgen'&&raw.steps?.length>0&&raw.steps.length<=100,'INCA_PROFILE_REQUIRED');
  const special=raw.steps.some(s=>['1','1|'].includes(pairs(s.responsePayload).FID));
  check(special,'INCA_FREE_REVIEW_REQUIRED');
  let previous,player,last;
  for(const [index,step] of raw.steps.entries()){
    const msg=index===0?'BET':'FREE_GAME',q=pairs(step.requestPayload),p=pairs(step.responsePayload);
    check(step.msgId===msg&&q.MSGID===msg&&p.MSGID===msg&&(index===0||previous.n>0),'INCA_SEQUENCE_MISMATCH');
    check(Object.keys(q).length===5&&Object.entries(expected).every(([k,v])=>q[k]===v),'REQUEST_MISMATCH');
    check(/^gdmgcm.{1,505}$/.test(q.PID??'')&&(player===undefined||player===q.PID),'SESSION_CHANGED');player=q.PID;
    check((special?['1','1|']:['','0','0|']).includes(p.FID??'')
      && !Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))
      && !['CFG','ABPM','SB','JPV'].some(k=>Object.hasOwn(p,k)),'UNKNOWN_TRIAL_FEATURE');
    check(['0','1'].includes(p.IFG)&&(index===0||p.IFG==='1'),'INVALID_FREE_STATE');
    for(const k of ['B','AB','TW'])integer(p[k]);
    const n=integer(p.NFG??(index===0&&!special?'0':undefined));check(n<=100,'FREE_LIMIT');
    let t,c;
    if(special){
      const gsd=pairs(p.GSD??'','#','~');
      check(Object.keys(gsd).every(k=>['BGRS','IIFS','VA','NWI','PWI','FGTS','FGRS','CFGC','CL','BGCL'].includes(k)),'INCA_UNREVIEWED_GSD');
      for(const key of ['CL','BGCL'])if(gsd[key]!==undefined){
        const rows=gsd[key].split('|');if(rows.at(-1)==='')rows.pop();
        check(rows.length>0&&rows.length<=15,'INCA_COIN_LAYOUT');const occupied=new Set();
        for(const row of rows){const fields=row.split(';');if(fields.at(-1)==='')fields.pop();
          check(fields.length===3,'INCA_COIN_LAYOUT');const [x,y,value]=fields.map(integer),position=x+','+y;
          check(x<3&&y<5&&[10,20,40,60,80,100,300,400,600,800].includes(value)&&!occupied.has(position),'INCA_UNREVIEWED_COIN');occupied.add(position);
        }
      }
      check(gsd.IIFS===undefined||gsd.IIFS===(index===0?'1':'0'),'INCA_UNREVIEWED_GSD');
      check((p.FRBAL??'0')==='0','INCA_UNREVIEWED_FREE_ROUNDS');
      t=integer(p.TFG);c=integer(p.CFGG);check(t===10&&c<=10&&n<=10&&t===n+c,'INCA_COUNTERS');
      check((p.GCT??'0')==='0','UNSUPPORTED_INCA_TERMINATION');
      check((gsd.FGRS===undefined||integer(gsd.FGRS)===n)&&(gsd.CFGC===undefined||integer(gsd.CFGC)===c),'UNSUPPORTED_INCA_NESTED_COUNTER');
      if(index===0)check(n>0&&c===0&&p.IFG==='0','INCA_EMPTY_TRIGGER');
      else{
        check(c===previous.c+1&&t===previous.t&&n===previous.n-1,'INCA_PROGRESS');
        if(n===0)check(previous.n===1&&t===previous.t,'INCA_TERMINAL');
      }
    }
    previous={n,t,c};last=p;
  }
  return {next:previous.n?'FREE_GAME':null,special,last};
}
export function incaCoinReview(raw){
 const {next,last}=incaCoinSequence(raw);
 if(next)return{complete:false,next,sourceRequests:0,captureAuthorized:false};
 const end=integer(last.B),win=integer(last.TW);check(raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1'&&Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=0,'TRIAL_PROFILE_REQUIRED');
 check(raw.startBalanceRaw-end+win===20&&end===integer(last.AB),'STAKE_MISMATCH');
 if(raw.steps.at(-1).responseBalance!==undefined)check(Number(raw.steps.at(-1).responseBalance)===end,'BALANCE_MISMATCH');
 return{complete:true,betRaw:20,endBalanceRaw:end,totalWinRaw:win,sourceRequests:0,captureAuthorized:false};
}
