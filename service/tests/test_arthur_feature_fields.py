import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from unittest.mock import patch
from arthur_feature_fields import review,settled,binding,validate_proof,policy,CONTRACT
from round_fields import derive,FieldError
from store import digest,Rejected
from ag_rolling_plan import validate_rolling_plan
ROOT=Path(__file__).resolve().parents[2]
FIX=json.loads((ROOT/'scripts/runner-v2/ag-rolling/fixtures/arthur-feature-v2.json').read_bytes())
REG=json.loads((ROOT/'config/ag-rolling-plans.json').read_bytes())
class ArthurFeatureTests(unittest.TestCase):
 def test_free_retrigger_wild_classification_and_independent_money(self):
  for v in FIX:
   self.assertEqual(settled(v['raw']),v['fields']);self.assertEqual(derive(v['raw']),v['fields']);self.assertIsNone(review(v['raw'])['next'])
  self.assertEqual([v['fields']['bonus'] for v in FIX],[1,1,0])
 def test_old_marker_and_unknown_markers_do_not_gain_permission(self):
  r=copy.deepcopy(FIX[0]['raw']);r.pop('arthurFeatureContract')
  with self.assertRaisesRegex(FieldError,'FEATURE_NOT_ADAPTED'):review(r)
  with self.assertRaisesRegex(FieldError,'MARKER'):review({**r,'arthurFeatureContract':'unknown'})
 def test_counter_money_session_and_missing_end_fail_independently(self):
  for mutate in (lambda r:r['steps'][1].update(responseBalance=r['steps'][1]['responseBalance']+1),
   lambda r:r['steps'][1].update(elapsedMs=300001),lambda r:r['steps'].pop(),
   lambda r:r['steps'][1].update(requestPayload=r['steps'][1]['requestPayload'].replace('fixture-response-0','wrong'))):
   r=copy.deepcopy(FIX[0]['raw']);mutate(r)
   with self.assertRaises(FieldError):settled(r)
 def test_ready_flag_is_not_enough_to_skip_the_free_counter(self):
  r=copy.deepcopy(FIX[0]['raw']);s=r['steps'][1];s['responsePayload']=s['responseXml']=s['responseXml'].replace('readyForEndGame="N"','readyForEndGame="Y"')
  with self.assertRaisesRegex(FieldError,'SETTLEMENT'):review(r)
 def test_versioned_plan_proof_rejects_resigned_evidence(self):
  plan=REG['plans']['32754'];proof=REG['proofs']['32754'];validate_proof(plan,proof);self.assertEqual(validate_rolling_plan(plan),plan)
  for k,v in [('fullRecordsHash','a'*64),('actualOwnRequests',0),('originalEndConstructorExecutions',0),('historicalCredit',300000)]:
   q=copy.deepcopy(proof);wire=q['arthurFeatureEvidence']['wiringEvidence'];wire[k]=v;wire['evidenceHash']=digest({k:v for k,v in wire.items() if k!='evidenceHash'})
   with self.assertRaisesRegex(Rejected,'WIRING'):validate_proof(plan,q)
 def test_policy_is_pinned_and_ordinary_type_profile_remains_separate(self):
  p=policy();self.assertEqual(p['maximumSteps'],22);self.assertEqual(p['historicalCredit'],0)
  with self.assertRaisesRegex(FieldError,'PLAN'):binding({**REG['plans']['32754'],'maxSteps':23})
  types=json.loads((ROOT/'service/round_types.json').read_bytes())['profiles'];self.assertEqual(types['arthurandtheroundtable-base-ag-rolling-wms-v1']['freeTypes'],{})
if __name__=='__main__':unittest.main()
