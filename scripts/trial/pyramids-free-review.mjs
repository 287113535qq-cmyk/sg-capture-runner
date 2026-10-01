// Independently reviewed ten-free scope; complete continuation shape remains synthetic.
// Official Pyramids route also checks nested free counters and forced termination.
// Standalone FID1 is supported; switching feature at NFG0 is not an exit.
export const PYRAMIDS_FREE_SOURCE='hyperchargedpyramidsofra96-round-one-base-v1';
export const PYRAMIDS_FREE_EXTENSION=PYRAMIDS_FREE_SOURCE+'-pyramids-ten-free-v1';
const expected={BPL:'1',GN:'hyperchargedpyramidsofra96',LB:'40'};
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
export function pyramidsFreeSequence(raw,{reviewedMajor=false,freeTotal=10}={}){
  check([10,15].includes(freeTotal),'PYRAMIDS_UNREVIEWED_FREE_TOTAL');
  check(raw.sourceKey===PYRAMIDS_FREE_SOURCE&&raw.protocol==='nextgen'&&raw.steps?.length>0&&raw.steps.length<=100,'PYRAMIDS_FREE_PROFILE_REQUIRED');
  const special=raw.steps.some(s=>['1','1|'].includes(pairs(s.responsePayload).FID));
  check(special,'PYRAMIDS_FREE_FREE_REVIEW_REQUIRED');
  let previous,player,last,baseCoins;
  for(const [index,step] of raw.steps.entries()){
    const msg=index===0?'BET':'FREE_GAME',q=pairs(step.requestPayload),p=pairs(step.responsePayload);
    check(step.msgId===msg&&q.MSGID===msg&&p.MSGID===msg&&(index===0||previous.n>0),'PYRAMIDS_FREE_SEQUENCE_MISMATCH');
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
      if(index===0)baseCoins=gsd.BGCL;
      else if(gsd.BGCL!==undefined)check(baseCoins!==undefined&&gsd.BGCL===baseCoins,'PYRAMIDS_BASE_COINS_CHANGED');
      check(Object.keys(gsd).every(k=>['BGRS','IIFS','VA','FGRS','CFGC','FGVABN','BGCL','CL','CLBN','FSRS'].includes(k)),'PYRAMIDS_FREE_UNREVIEWED_GSD');
      if(gsd.CLBN!==undefined)check(index>0&&gsd.CL!==undefined&&gsd.CLBN===gsd.CL,'PYRAMIDS_FREE_COIN_ALIAS');
      if(gsd.FSRS!==undefined){const stops=gsd.FSRS.split(';');if(stops.at(-1)==='')stops.pop();check(index>0&&stops.length===5,'PYRAMIDS_FREE_STOPS');stops.forEach(integer);}
      let unreviewedCoin=false;
      for(const key of ['BGCL','CL'])if(gsd[key]!==undefined){
        const rows=gsd[key].split('|');if(rows.at(-1)==='')rows.pop();
        check(rows.length>0&&rows.length<=15,'PYRAMIDS_FREE_COIN');const seen=new Set();
        for(const row of rows){
          const cells=row.split(';');if(cells.at(-1)==='')cells.pop();
          check(cells.length===3,'PYRAMIDS_FREE_COIN');check(cells.slice(0,2).every(v=>/^\d+$/.test(v)&&Number.isSafeInteger(+v))
            &&(/^[0-9]+$/.test(cells[2])&&Number.isSafeInteger(+cells[2])||['-4','-3','-2'].includes(cells[2])),'PYRAMIDS_FREE_COIN');
          const [x,y,value]=cells.map(Number),pos=x+','+y;
          check(x<3&&y<5&&!seen.has(pos),'PYRAMIDS_FREE_COIN');seen.add(pos);unreviewedCoin ||= value<0&&!(reviewedMajor&&index>0&&key==='CL'&&cells[2]==='-3');
        }
      }
      check(!unreviewedCoin,'PYRAMIDS_FREE_UNREVIEWED_COIN');
      if(gsd.FGVABN!==undefined){
       const rs=gsd.FGVABN.split('|');if(rs.at(-1)==='')rs.pop();
       check(rs.length===5&&rs.every(row=>{const cells=row.split(';');if(cells.at(-1)==='')cells.pop();return cells.length===3&&cells.every(v=>/^\d+$/.test(v)&&+v<=15);}), 'PYRAMIDS_FREE_GRID');
      }
      check(gsd.IIFS===undefined||(index===0?['1']:['0','1']).includes(gsd.IIFS),'PYRAMIDS_FREE_UNREVIEWED_GSD');
      check((p.FRBAL??'0')==='0','PYRAMIDS_FREE_UNREVIEWED_FREE_ROUNDS');
      t=integer(p.TFG);c=integer(p.CFGG);check(t===freeTotal&&c<=t&&n<=t&&t===n+c,'PYRAMIDS_FREE_COUNTERS');
      check((p.GCT??'0')==='0','UNSUPPORTED_PYRAMIDS_FREE_TERMINATION');
      check((gsd.FGRS===undefined||integer(gsd.FGRS)===n)&&(gsd.CFGC===undefined||integer(gsd.CFGC)===c),'UNSUPPORTED_PYRAMIDS_FREE_NESTED_COUNTER');
      if(index===0)check(n>0&&c===0&&p.IFG==='0','PYRAMIDS_FREE_EMPTY_TRIGGER');
      else{
        check(c===previous.c+1&&t===previous.t&&n===previous.n-1,'PYRAMIDS_FREE_PROGRESS');
        if(n===0)check(previous.n===1&&t===previous.t,'PYRAMIDS_FREE_TERMINAL');
      }
    }
    previous={n,t,c};last=p;
  }
  return {next:previous.n?'FREE_GAME':null,special,last};
}
export function pyramidsFreeReview(raw){
 const {next,last}=pyramidsFreeSequence(raw);
 if(next)return{complete:false,next,sourceRequests:0,captureAuthorized:false};
 const end=integer(last.B),win=integer(last.TW);check(raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1'&&Number.isSafeInteger(raw.startBalanceRaw)&&raw.startBalanceRaw>=0,'TRIAL_PROFILE_REQUIRED');
 check(raw.startBalanceRaw-end+win===20&&end===integer(last.AB),'STAKE_MISMATCH');
 if(raw.steps.at(-1).responseBalance!==undefined)check(Number(raw.steps.at(-1).responseBalance)===end,'BALANCE_MISMATCH');
 return{complete:true,betRaw:20,endBalanceRaw:end,totalWinRaw:win,sourceRequests:0,captureAuthorized:false};
}
