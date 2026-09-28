import test from 'node:test';
import assert from 'node:assert/strict';
import {GameRuleEvidence,loadRuleCard} from './game-rule-evidence.mjs';

const plan={gameId:32714,trialId:'sg_r1_20260928_32714',target:2};
const proof={trialId:plan.trialId,planHash:'c'.repeat(64),recordsHash:'d'.repeat(64),fullReadback:2};
const card={gameId:32714,ruleHash:'a'.repeat(64),planHash:proof.planHash};
const record=(steps,bonus=0)=>({_id:'1'.repeat(64),contentHash:'2'.repeat(64),
  normalized:{bonus,typeMappingHash:'3'.repeat(64)},raw:{steps:steps.map(([msgId,responsePayload])=>({msgId,responsePayload}))}});
const make=()=>new GameRuleEvidence({plan,card,revision:'f'.repeat(40)});

test('observed complete chains keep missing counters separate and do not claim total feature coverage',()=>{
  const rules=make();rules.observeVerified(record([['BET','IFG=0']]));
  rules.observeVerified(record([['BET','IFG=0&NFG=1&FID=1|'],['FREE_GAME','IFG=1&NFG=0&GSD=FEAT~HARDHAT#MMBG~0']],2));
  const {value}=rules.finish(proof);
  assert.equal(value.completeRounds,2);assert.equal(value.sourceFrames,3);
  assert.deepEqual(value.continuationSteps,{total:1,min:0,max:1});
  assert.equal(value.roundsWithContinuation,1);
  assert.equal(value.fieldObservations.NFG.missing,1);
  assert.deepEqual(value.fieldObservations.NFG.values,{'1':1,'0':1});
  assert.equal(value.fieldObservations['GSD.FEAT'].values.HARDHAT,1);
  assert.deepEqual(value.normalizedBonusCounts,{'0':1,'2':1});
  assert.equal(value.allSpecialStageTypesCovered,false);assert.equal(value.allSpecialStageTypesTotal,null);
});

test('sequence summary counts retriggers and picks without treating them as separate paid rounds',()=>{
  const rules=make();rules.observeVerified(record([['BET','NFG=2'],['FREE_GAME','NFG=2'],['FREE_GAME','NFG=0'],
    ['FEATURE_START','CFG=1'],['FEATURE_PICK','CFG=1'],['FEATURE_PICK','CFG=1'],['FEATURE_END','NFG=0']],3));
  const {value}=rules.finish(proof);
  assert.equal(value.completeRounds,1);assert.equal(value.messageCounts.FEATURE_PICK,2);
  assert.equal(value.transitions['FREE_GAME>FEATURE_START'],1);
  assert.equal(value.continuationSteps.total,6);assert.equal(value.observedBonusCategoryCount,1);
});

test('archive is deterministic, bounded and strips private or unrecognized field values',()=>{
  const rules=make();
  for(let i=0;i<100;i++)rules.observeVerified(record([['BET',`NFG=${i}&FID=secret-session&PID=secret-session&GSD=FEAT~secret-session#MMW~secret-result&URL=https://secret-url`]]));
  const result=rules.finish(proof),text=JSON.stringify(result.value);
  assert.equal(Object.keys(result.value.fieldObservations.NFG.values).length,32);
  assert.equal(result.value.fieldObservations.NFG.overflowOccurrences,68);
  assert.equal(result.value.fieldObservations.FID.redacted,100);
  assert.equal(result.value.fieldObservations['GSD.MMW'].present,100);
  assert(!text.includes('secret-'));assert(!text.includes('https://'));
  assert(result.key.length<=180);assert.match(result.key,/^[a-zA-Z0-9:_-]+$/);
  assert.deepEqual(result,rules.finish(proof));
  rules.revision='e'.repeat(40);assert.notEqual(result.key,rules.finish(proof).key);
});

test('snapshot embeds the saved rule version and distinguishes differing plan versions',()=>{
  const actual=loadRuleCard(32714);assert.equal(actual.gameId,32714);assert.equal(actual.captureAuthorization,false);
  const rules=make(),before=rules.finish(proof);assert.equal(before.value.ruleCardPlanMatches,true);
  assert.equal(rules.finish({...proof,planHash:'9'.repeat(64)}).value.ruleCardPlanMatches,false);
});

test('Demon archive keeps mode counters and stage presence without copying private boards',()=>{
  const rules=new GameRuleEvidence({plan:{...plan,gameId:32739},card,revision:'f'.repeat(40)});
  rules.observeVerified(record([['BET','FID=0|&NFG=1'],['FREE_GAME','FID=1|0|&NFG=10&TFG=10&CFGG=0&FGT=10&GSD=DST~2#SBEFG~2#DDDP~private-board#RGSF~private-board#SNFG~private-value']],2));
  const {value}=rules.finish(proof);
  assert.deepEqual(value.fieldObservations['GSD.DST'].values,{'2':1});
  assert.equal(value.fieldObservations['GSD.SBEFG'].missing,1);
  assert.equal(value.fieldObservations['GSD.DDDP'].present,1);
  assert.deepEqual(value.fieldObservations['GSD.DDDP'].values,{});
  assert.equal(value.fieldObservations['GSD.SNFG'].redacted,1);
  assert(!JSON.stringify(value).includes('private-'));
  assert(!Object.hasOwn(make().finish(proof).value.fieldObservations,'GSD.DST'));
});

test('foam archive retains awarded/current counts while hiding choice data and boards',()=>{
  const rules=new GameRuleEvidence({plan:{...plan,gameId:32836},card,revision:'f'.repeat(40)});
  rules.observeVerified(record([['BET','FID=2|&NFR_2=1&CFR_2=0'],['FEATURE_START','CFP_2=0&GSD=featureData~private-choices#display~private-board#BVAL~private-value']],2));
  const {value}=rules.finish(proof);
  assert.deepEqual(value.fieldObservations.NFR_2.values,{'1':1});
  assert.equal(value.fieldObservations['GSD.featureData'].present,1);
  assert.deepEqual(value.fieldObservations['GSD.featureData'].values,{});
  assert(!JSON.stringify(value).includes('private-'));
  assert(!Object.hasOwn(make().finish(proof).value.fieldObservations,'CFP_2'));
});
