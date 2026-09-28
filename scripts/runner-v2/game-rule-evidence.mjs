// GitHub-side, bounded observations of records already read and verified by audit.
// This module neither validates settlement nor authorizes any source request.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stable} from './mongo-writer.mjs';

const sha=x=>createHash('sha256').update(stable(x)).digest('hex');
const hex=x=>typeof x==='string' && /^[a-f0-9]{64}$/.test(x);
const messages=new Set(['BET','FREE_GAME','FEATURE_START','FEATURE_PICK','FEATURE_END']);
const fields=['NFG','IFG','TFG','CFGG','CFG','FID','FS_1','NFR_1','CFR_1','CFP_1',
  'GSD.FEAT','GSD.PCFID','GSD.MMBG','GSD.NEXTTRIGGER','GSD.CFTFG','GSD.MMW','GSD.WH1','GSD.WH2','GSD.WHSLICE'];
const presenceOnly=new Set(['GSD.MMW','GSD.WH1','GSD.WH2','GSD.WHSLICE']);
const names=new Set(['MMANSION','HARDHAT','PAINT','HOMEIMP','MANSION','FG','WHEEL','WHEEL1','WHEEL2','MEGAHAT','BUZZSAW','FREE_SPINS','BASE_GAME']);
function values(payload){
  const out=Object.create(null);
  for(const part of (payload||'').split('&')){
    const at=part.indexOf('=');if(at<0)continue;
    const key=part.slice(0,at);if(fields.includes(key)||key==='GSD')out[key]=part.slice(at+1);
  }
  for(const part of (out.GSD||'').split('#')){
    const at=part.indexOf('~'),key='GSD.'+part.slice(0,at);
    if(at>=0 && fields.includes(key))out[key]=part.slice(at+1);
  }
  delete out.GSD;return out;
}
function safeValue(field,value){
  if(typeof value!=='string' || value.length>24)return null;
  if(['GSD.FEAT','GSD.NEXTTRIGGER'].includes(field))return names.has(value)?value:null;
  if(['FID','GSD.PCFID'].includes(field))return /^(?:\d{1,2}\|?){0,3}$/.test(value)?value:null;
  return /^\d{1,6}$/.test(value)?value:null;
}
export function loadRuleCard(gameId){
  if(!Number.isSafeInteger(gameId))throw new Error('RULE_GAME_ID_REQUIRED');
  return JSON.parse(readFileSync(new URL(`../../docs/game-rules/${gameId}.json`,import.meta.url),'utf8'));
}

export class GameRuleEvidence {
  constructor({plan,card=loadRuleCard(plan.gameId),revision=process.env.GITHUB_SHA}={}){
    this.plan=plan;this.card=card;
    this.revision=/^[a-f0-9]{40}$/.test(revision||'')?revision:null;
    this.rounds=0;this.frames=0;this.specialRounds=0;this.continuations={total:0,min:null,max:0};
    this.messages={};this.transitions={};this.bonus={};this.examples={};this.mappingHashes=new Set();
    this.fields=Object.fromEntries(fields.map(k=>[k,{present:0,missing:0,empty:0,redacted:0,overflowOccurrences:0,values:{}}]));
  }
  observeVerified(record){
    const steps=record.raw.steps;
    this.rounds++;this.frames+=steps.length;
    const extra=steps.length-1;
    this.continuations.total+=extra;this.continuations.min=Math.min(this.continuations.min??extra,extra);
    this.continuations.max=Math.max(this.continuations.max,extra);if(extra>0)this.specialRounds++;
    const bonus=record.normalized?.bonus;
    const category=Number.isInteger(bonus)&&bonus>=0&&bonus<=255?String(bonus):'unclassified';
    this.bonus[category]=(this.bonus[category]||0)+1;
    if(!this.examples[category] && hex(record._id)&&hex(record.contentHash))
      this.examples[category]={recordId:record._id,contentHash:record.contentHash};
    const mapping=record.normalized?.typeMappingHash;
    if(hex(mapping)&&this.mappingHashes.size<16)this.mappingHashes.add(mapping);
    let previous=null;
    for(const step of steps){
      const msg=messages.has(step.msgId)?step.msgId:'UNRECOGNIZED';
      this.messages[msg]=(this.messages[msg]||0)+1;
      if(previous){const edge=previous+'>'+msg;this.transitions[edge]=(this.transitions[edge]||0)+1;}previous=msg;
      const parsed=values(step.responsePayload);
      for(const field of fields){
        const stats=this.fields[field],value=parsed[field];
        if(value===undefined){stats.missing++;continue;}
        stats.present++;if(value==='')stats.empty++;
        if(presenceOnly.has(field))continue;
        const safe=safeValue(field,value);
        if(safe===null){stats.redacted++;continue;}
        if(Object.hasOwn(stats.values,safe))stats.values[safe]++;
        else if(Object.keys(stats.values).length<32)stats.values[safe]=1;
        else stats.overflowOccurrences++;
      }
    }
  }
  finish(proof){
    const value={schema:'sg-game-rule-observations-v1',gameId:this.plan.gameId,trialId:this.plan.trialId,
      scope:'audited-new-rounds-only',audit:proof,codeRevision:this.revision,ruleCard:this.card,
      ruleCardPlanMatches:this.card.planHash===proof.planHash,
      completeRounds:this.rounds,sourceFrames:this.frames,roundsWithContinuation:this.specialRounds,
      continuationSteps:this.continuations,messageCounts:this.messages,transitions:this.transitions,
      normalizedBonusCounts:this.bonus,observedBonusCategoryCount:Object.keys(this.bonus).filter(k=>k!=='0'&&k!=='unclassified').length,
      fieldObservations:this.fields,typeMappingHashes:[...this.mappingHashes].sort(),exampleRecords:this.examples,
      allSpecialStageTypesTotal:null,allSpecialStageTypesCovered:false,
      coverageMeaning:'Observed in verified complete new rounds only. Bonus combinations are not independent stage counts. Historical baseline and parked incomplete rounds excluded.',
      privacy:'No raw payloads, PID, session values, credentials or launch URLs. Evidence references remain private.'};
    return {key:`game-rules:${this.plan.trialId}:${proof.recordsHash}:${sha(value)}`,value};
  }
}
