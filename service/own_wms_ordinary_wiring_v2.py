"""Exact new plans and immutable old-record decoder dispatch. No network."""
import json
from pathlib import Path
from store import digest,require
POLICY_HASH='93eb53b077bacee8aa359e0a5fb97d9dbba7148505c94da4ba759b2b284f55b2'
POLICY=json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-own-wms-ordinary-wiring-v2.json').read_bytes())
require(digest(POLICY)==POLICY_HASH,'OWN_ORDINARY_POLICY_CHANGED')
def validate(plan,registry):
 p=POLICY['games'].get(str(plan.get('gameId')))
 require(p is not None and plan==p['plan'] and digest(plan)==p['planHash'] and plan.get('ordinarySemanticContract')==POLICY['contractHash'],'OWN_ORDINARY_PLAN')
 require(plan==registry.get('ordinarySemanticPlans',{}).get(str(plan['gameId'])),'OWN_ORDINARY_REGISTRY')
 require(registry.get('ordinarySemanticProofs',{}).get(str(plan['gameId']))==p['proof'] and digest(p['proof'])==p['proofHash'],'OWN_ORDINARY_WIRING_PROOF')
 require(POLICY['actualWiring']['actualPythonIPC'] and POLICY['actualWiring']['games'][str(plan['gameId'])]['actualParserClosed'],'OWN_ORDINARY_ACTUAL_IPC')
 require(digest(p['oldPlan'])==p['oldPlanHash'] and digest(p['oldProof'])==p['oldProofHash'] and p['oldProof']['planHash']==p['oldPlanHash'],'OWN_ORDINARY_OLD_PROOF')
 require(p['semanticReview']['naturalComplete']==2000 and p['semanticReview']['naturalFaultPrefixesRepaired']==2 and p['semanticReview']['negatives']==19 and p['semanticReview']['fixtureSha256']==POLICY['semanticReplaySha256'],'OWN_ORDINARY_SEMANTIC_PROOF')
 return plan
class OwnOrdinaryFields:
 def __init__(self,plan):
  self.plan=plan;p=POLICY['games'].get(str(plan.get('gameId')))
  require(p is not None and digest(plan)==p['planHash'],'OWN_ORDINARY_PLAN')
  if plan['gameId']==32752:
   import acorn_base_fields as old
   import acorn_ordinary_v2_fields as newer
   self.old=old.AcornBaseFields(p['oldPlan']);self.newer=newer.AcornBaseFields(plan)
  else:
   import crystalforest_base_fields as old
   import crystalforest_ordinary_v2_fields as newer
   self.old=old.CrystalForestBaseFields(p['oldPlan']);self.newer=newer.CrystalForestBaseFields(plan)
  self.old_source=old.SOURCE;self.new_source=newer.SOURCE
 def decoder(self,raw):
  require(raw.get('sourceKey') in (self.old_source,self.new_source),'OWN_ORDINARY_RAW_VERSION')
  return self.old if raw['sourceKey']==self.old_source else self.newer
 def next_request(self,raw):return self.decoder(raw).next_request(raw)
 def validate_intent(self,raw,payload):
  require(raw.get('sourceKey')==self.new_source,'OWN_ORDINARY_NO_LEGACY_REPLAY')
  return self.newer.validate_intent(raw,payload)
 def bootstrap(self,step,session):return self.newer.bootstrap(step,session)
 def settled(self,raw):return self.decoder(raw).settled(raw)
