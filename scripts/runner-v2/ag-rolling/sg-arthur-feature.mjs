import fs from 'node:fs';
import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {HEADER,SOURCE,review as baseReview,settled as baseSettled} from './sg-arthur-base.mjs';
export {SOURCE};
export const CONTRACT='wms-arthur-free-wild-evidence-v2';
export const FEATURE_MAPPING='arthurandtheroundtable-free-wild-ag-rolling-wms-v2';
const PIN='e735f6ab2616ed7eb1f4e4044b634e00f80ac26559e1db19f02979171840072f';
export function policy(){const p=JSON.parse(fs.readFileSync(new URL('../../../config/ag-rolling-arthur-feature-contracts.json',import.meta.url)));const {policyHash,...body}=p;need(policyHash===PIN&&queueHash(body)===PIN&&p.contract===CONTRACT&&p.sourceAllowance===0&&p.historicalCredit===0,'ARTHUR_FEATURE_POLICY_REQUIRED');return p;}
const eq=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag),text=n=>n.children.map(c=>c.text??'').join('').trim();
function exactShape(n,policy,variant,path='GameResponse'){
 need(policy.schemas[variant][path]?.some(([attributes,nodes])=>eq(Object.keys(n.a).sort(),attributes)&&eq(tags(n),nodes)),'ARTHUR_OWN_SHAPE_REVIEW_REQUIRED');
 children(n).forEach(c=>exactShape(c,policy,variant,path+'/'+c.tag));
}
const tree=n=>[n.tag,n.a,text(n),children(n).map(tree)];
const fsState=(f,p)=>p.stateKeys.map(k=>f[k]??(['remainingFeatureSpins','prevActive','activeFeature'].includes(k)?'0|0|0':k==='currentMultiplier'?'1':'0'));
export function validateRequest(step,first,expectedSession){
 const q=parseXml(step.requestPayload),h=one(q,'Header');need(q.tag==='GameRequest'&&eq(q.a,{type:step.msgId}),'ARTHUR_REQUEST_MISMATCH');
 const {sessionID,...rest}=h.a;need(eq(rest,HEADER)&&!children(h).length,'ARTHUR_REQUEST_MODE');
 need(typeof sessionID==='string'&&sessionID.length>0&&sessionID.length<=1024&&(expectedSession===null||sessionID===expectedSession),'WMS_SESSION_CHAIN_MISMATCH');
 if(first){need(step.msgId==='Logic'&&eq(tags(q),['Header','Stake','PaylineCount','AccountData']),'ARTHUR_REQUEST_MISMATCH');
  const stake=one(q,'Stake'),line=one(q,'PaylineCount'),a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');
  need(eq(stake.a,{total:'200'})&&!children(stake).length&&eq(line.a,{count:'20'})&&!children(line).length&&!Object.keys(a.a).length&&eq(tags(a),['CurrencyMultiplier'])&&!Object.keys(c.a).length&&!children(c).length&&text(c)==='1','ARTHUR_REQUEST_MODE');
 }else need(['Logic','EndGame'].includes(step.msgId)&&eq(tags(q),['Header']),'ARTHUR_REQUEST_MISMATCH');
}
function featureAudit(raw,p,requireComplete=true){
 const {policyHash,...body}=p;need(queueHash(body)===policyHash&&policyHash===PIN&&p.sourceAllowance===0&&p.historicalCredit===0,'ARTHUR_FEATURE_POLICY_REQUIRED');
 need(raw.sourceKey===SOURCE&&raw.fixtureOnly===false&&raw.protocol==='wms'&&raw.roundFieldsVersion==='sg-round-fields-v1','ARTHUR_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=22,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let session=null,next='Logic',kind=null,balance=start,firstWin=0,total=0,freeWin=0,initialReels,previousFS,previousToken;
 const traces=[],routes=[];
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'ARTHUR_SEQUENCE_MISMATCH');validateRequest(s,i===0,session);
  need(s.responsePayload===s.responseXml&&!s.sourceRejected&&uint(s.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const root=parseXml(s.responsePayload),h=one(root,'Header');need(root.tag==='GameResponse'&&eq(root.a,{type:next}),'ARTHUR_RESPONSE_MISMATCH');
  need(h.a.gameID==='20467'&&h.a.versionID==='1_0'&&h.a.isRecovering==='N'&&typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_RESPONSE_IDENTITY_MISMATCH');session=h.a.sessionID;
  if(i===0){const g=one(root,'GameResult');need(!tags(g).includes('ExcaliburInfo'),'ARTHUR_EXCALIBUR_INCOMPLETE');kind=tags(g).includes('FSInfo')?'free':'wild';need(kind==='free'||tags(g).includes('WildInfo'),'ARTHUR_FEATURE_CANDIDATE_REQUIRED');}
  exactShape(root,p,next==='EndGame'?'end':kind==='free'?(i?'free':'trigger'):'wild');
  if(next==='EndGame'){
   need(i===raw.steps.length-1&&h.a.readyForEndGame==='N'&&children(root).length===3,'ARTHUR_ENDGAME_MISMATCH');next=null;
  }else{
   const g=one(root,'GameResult'),reels=one(g,'ReelResults'),spin=one(reels,'ReelSpin'),w=uint(g.a.totalWin),pays=children(spin).filter(n=>n.tag==='PaylineWin'),scatters=children(spin).filter(n=>n.tag==='ScatterWin');
   need(g.a.stake==='200'&&g.a.stakePerLine==='10'&&g.a.paylineCount==='20'&&g.a.betID==='','ARTHUR_WAGER_MISMATCH');
   need(reels.a.numSpins==='1'&&children(reels).length===1&&spin.a.spinIndex==='0'&&(i===0?spin.a.reelsetIndex==='0':['2','3','4'].includes(spin.a.reelsetIndex))&&spin.a.freeSpin===(i?'Y':'N'),'ARTHUR_REEL_STATE_MISMATCH');
   const stops=text(one(spin,'ReelStops')).split('|');need(stops.length===5,'ARTHUR_REEL_STATE_MISMATCH');stops.forEach(uint);
   const grid=text(one(root,'SymbolGrids')).split(';').map(row=>row.split('|'));need(grid.length===3&&grid.every(row=>row.length===5&&row.every(v=>p.symbols.includes(uint(v)))),'ARTHUR_SYMBOL_REVIEW_REQUIRED');
   need(pays.length===uint(spin.a.winCountPL)&&pays.length<=11&&uint(spin.a.winCountSC)<=1&&scatters.length<=1,'ARTHUR_REEL_WIN_MISMATCH');
   const indexes=new Set();let sum=0;
   const multiplier=children(g).find(n=>n.tag==='FSInfo')?.a.currentMultiplier??'1';
   for(const line of pays){const id=uint(line.a.index);need(id<20&&!indexes.has(id)&&line.a.awardTableIndex==='0'&&p.paylineAwards.includes(uint(line.a.awardIndex)),'ARTHUR_PAYLINE_REVIEW_REQUIRED');need(p.paylineAwardValues.some(v=>eq(v,[multiplier,line.a.awardIndex,line.a.winVal])),'ARTHUR_PAYLINE_VALUE_REVIEW_REQUIRED');indexes.add(id);sum+=uint(line.a.winVal);uint(sum);}
   need(scatters.every(n=>eq(n.a,{awardIndex:'0',winVal:'0'})),'ARTHUR_SCATTER_REVIEW_REQUIRED');need(sum===uint(spin.a.spinWins)&&sum===w,'ARTHUR_REEL_WIN_MISMATCH');
   total+=w;uint(total);if(i===0){firstWin=w;initialReels=tree(reels);}else freeWin+=w;
   const bg=one(g,'BGInfo');need(bg.a.isMaxWin==='0'&&uint(bg.a.bgWinnings)===firstWin&&uint(bg.a.totalWagerWin)===total,'ARTHUR_CUMULATIVE_WIN_MISMATCH');
   if(kind==='wild'){
    need(i===0&&h.a.readyForEndGame==='Y'&&spin.a.bonusAwarded==='N'&&spin.a.winCountSC==='0'&&!scatters.length&&p.wildOverlays.includes(one(g,'WildInfo').a.overlay),'ARTHUR_WILD_REVIEW_REQUIRED');next='EndGame';
   }else{
    const f=one(g,'FSInfo').a,n=uint(f.freeSpinNumber),limit=uint(f.freeSpinsTotal);
    need(n===i&&n<=limit&&limit<=20&&uint(f.fsWinnings)===freeWin,'ARTHUR_FREE_COUNTER_MISMATCH');
    if(i===0){const wheel=one(g,'WheelInfo').a;need(wheel.featureType==='0'&&p.initialWheelFreeTotals[wheel.index]===limit&&spin.a.bonusAwarded==='Y'&&spin.a.winCountSC==='1'&&scatters.length===1,'ARTHUR_WHEEL_REVIEW_REQUIRED');}
    else{
     const extra=uint(f.extraSpinsAwarded),token=one(g,'TokenInfo').a;
     need([0,3,5].includes(extra)&&limit===uint(previousFS.freeSpinsTotal)+extra&&f.isMaxWin==='0','ARTHUR_FREE_COUNTER_MISMATCH');
     need(Object.values(token).every(v=>uint(v)<=2),'ARTHUR_TOKEN_REVIEW_REQUIRED');
     need(['Bronze','Silver','Golden'].every(k=>token['prev'+k]===(previousToken?.['new'+k]??'0')),'ARTHUR_TOKEN_CHAIN_MISMATCH');
     const joint=[...fsState(previousFS,p),...fsState(f,p),...p.tokenKeys.map(k=>token[k])];need(p.jointStateTransitions.some(v=>eq(v,joint)),'ARTHUR_TOKEN_TRANSITION_REVIEW_REQUIRED');
     need(spin.a.bonusAwarded===(extra?'Y':'N')&&spin.a.winCountSC===(extra?'1':'0')&&!scatters.length,'ARTHUR_FREE_AWARD_MISMATCH');
     need(eq(tree(one(one(g,'BaseGameRecoveryInfo'),'ReelResults')),initialReels),'ARTHUR_RECOVERY_REFERENCE_MISMATCH');previousToken=token;
    }
    previousFS=f;need(h.a.readyForEndGame===(n<limit?'N':'Y'),'ARTHUR_SETTLEMENT_FLAG_MISMATCH');next=n<limit?'Logic':'EndGame';
   }
  }
  balance=start-200+total;uint(balance);const cash=one(one(root,'Balances'),'Balance');need(cash.a.name==='CASH_BALANCE'&&uint(cash.a.value)===balance&&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
  traces.push({frame:i,next,totalWin:total,balance});routes.push({msg:s.msgId,first:i===0});
 }
 if(requireComplete)need(next===null&&start-balance+total===200,'ARTHUR_FEATURE_INCOMPLETE');
 return {kind,complete:next===null,next,start,balance,totalWin:total,freeWin,frames:raw.steps.length,traces,routes,session};
}

export function previous(plan){const {arthurFeatureContract,arthurFeatureContractHash,...p}=plan;return {...p,maxSteps:2};}
export function binding(plan){const p=policy();need(plan.arthurFeatureContract===CONTRACT&&plan.arthurFeatureContractHash===PIN&&plan.maxSteps===22&&queueHash(previous(plan))===p.previousPlanHash,'ARTHUR_FEATURE_PLAN_REQUIRED');return p;}
export function review(raw){
 if(raw.arthurFeatureContract===undefined)return baseReview(raw);
 need(raw.arthurFeatureContract===CONTRACT,'ARTHUR_FEATURE_MARKER_REQUIRED');const p=policy();
 need(Array.isArray(raw.steps)&&raw.steps.length<=22,'INVALID_ROUND_STEPS');if(!raw.steps.length)return baseReview(raw);
 const g=one(parseXml(raw.steps[0].responsePayload),'GameResult');
 if(!children(g).some(n=>['FSInfo','WildInfo','ExcaliburInfo'].includes(n.tag)))return baseReview(raw);
 return featureAudit(raw,p,false);
}
export function settled(raw,mappingHash){const s=review(raw);if(s.kind===undefined)return baseSettled(raw,mappingHash);
 need(s.complete&&s.next===null&&s.start-s.balance+s.totalWin===200,'ARTHUR_FEATURE_INCOMPLETE');
 const types=JSON.parse(fs.readFileSync(new URL('../../../service/round_types.json',import.meta.url))),h=queueHash(types.profiles[FEATURE_MAPPING]);
 need(h===mappingHash,'WMS_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,bet:2,mul:s.totalWin/200,buy:0,bonus:s.kind==='free'?1:0,primaryBonusKind:s.kind==='free'?'freeGame':'none',typeMappingHash:h,
 money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.totalWin,betRaw:200}};
}

const WIRE_PIN="fda8170a2859ee8a0cffcd1634ffd0ade4742c455e9f78c685afe829ee5c3b1f";
const REJECTED=[{"sampleIndex":243,"rawHash":"c8d33c85a328e50f033702aea6238b7c0a57cfcc208bb278615cd11872bc70cc","error":"ARTHUR_EXCALIBUR_INCOMPLETE"},{"sampleIndex":365,"rawHash":"13b257c75cf96637a8646f71bc973812241bd57a898ef431631e87ba28d4c647","error":"ARTHUR_EXCALIBUR_INCOMPLETE"},{"sampleIndex":902,"rawHash":"69799ba05ee9587422edb53b650aaab0ea7e41304cfc0c1675f9233762b4e4bb","error":"ARTHUR_EXCALIBUR_INCOMPLETE"}];
export function validateProof(plan,proof){const p=binding(plan),e=proof?.arthurFeatureEvidence??{},old=e.previousProof??{},wire=e.wiringEvidence??{};
 const {planHash:bound,arthurFeatureEvidence,...fields}=proof,{planHash:previousBound,...oldFields}=old;
 need(queueHash(old)===p.previousProofHash&&previousBound===p.previousPlanHash&&bound===queueHash(plan)&&eq(fields,oldFields)
  &&e.previousPlanHash===p.previousPlanHash&&e.previousProofHash===p.previousProofHash&&e.contractHash===PIN
  &&e.acceptedOriginalRawSetHash===wire.acceptedOriginalRawSetHash&&eq(e.rejectedHistoricalPrefixes,REJECTED)
  &&wire.evidenceHash===WIRE_PIN&&queueHash(Object.fromEntries(Object.entries(wire).filter(([k])=>k!=='evidenceHash')))===WIRE_PIN,'ARTHUR_FEATURE_WIRING_PROOF_REQUIRED');
 return true;
}
