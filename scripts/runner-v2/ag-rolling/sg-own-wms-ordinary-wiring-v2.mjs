import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {queueHash} from './sg-queue-profile.mjs';
import * as acornOld from './sg-acorn-base.mjs';
import * as crystalOld from './sg-crystalforest-base.mjs';
import * as acornNew from './sg-acorn-ordinary-v2.mjs';
import * as crystalNew from './sg-crystalforest-ordinary-v2.mjs';
export const POLICY_HASH='93eb53b077bacee8aa359e0a5fb97d9dbba7148505c94da4ba759b2b284f55b2';
export const policy=JSON.parse(readFileSync(new URL('../../../config/ag-rolling-own-wms-ordinary-wiring-v2.json',import.meta.url)));
assert.equal(queueHash(policy),POLICY_HASH,'OWN_ORDINARY_POLICY_CHANGED');
const modules={'32752':[acornOld,acornNew],'32759':[crystalOld,crystalNew]};
export function ownOrdinaryV2Plan(plan){const p=policy.games[String(plan?.gameId)];return !!p&&queueHash(plan)===p.planHash;}
export function ownOrdinaryV2Proof(plan,proof){
 assert(ownOrdinaryV2Plan(plan),'OWN_ORDINARY_PLAN');const p=policy.games[String(plan.gameId)];
 assert(queueHash(proof)===p.proofHash&&proof.planHash===p.planHash&&proof.previousPlanHash===p.oldPlanHash
  &&proof.previousProofHash===p.oldProofHash&&queueHash(p.oldPlan)===p.oldPlanHash&&queueHash(p.oldProof)===p.oldProofHash,
  'OWN_ORDINARY_PROOF');
 return {previousPlan:p.oldPlan,previousProof:p.oldProof};
}
export function ownOrdinaryBinding(plan,binding){assert(ownOrdinaryV2Plan(plan)&&queueHash(binding)===policy.games[String(plan.gameId)].bindingHash,'OWN_ORDINARY_BINDING');return true;}
export function ownOrdinaryDecoder(plan,raw){assert(ownOrdinaryV2Plan(plan),'OWN_ORDINARY_PLAN');const [old,newer]=modules[String(plan.gameId)];
 const result=raw?.sourceKey===old.SOURCE?old:raw?.sourceKey===newer.SOURCE?newer:null;
 assert(result,'OWN_ORDINARY_RAW_VERSION');return result;}
