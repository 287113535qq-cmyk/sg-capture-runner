import json,os,unittest
from pathlib import Path
from unittest.mock import patch
from pool_plan import validate_pool_plan
from store import digest
class RhinoPilotPlanTests(unittest.TestCase):
 def test_rhino_needs_own_zero_history_profile_and_formal_source_boundary(self):
  root=Path(__file__).resolve().parents[2];old=json.loads((root/'config/round-one-plans.json').read_text())['32799'];plan={**old,'demoGeneration':'a'*64}
  profile=dict(schema='sg-demo-next-game-v1',gameId=32799,fromGameId=32795,workers=20,perWorker=5,newBetAllowance=100,oldPlanHash=digest(old),generation='a'*64,planHash=digest(plan),completePreserved=0,abandonedAttempts=0,emptyCandidate={'schema':'sg-empty-demo-candidate-v1'},sourceFormal={'schema':'sg-formal-source-boundary-v1','kind':'complete','proofHash':'b'*64})
  real=Path.read_text
  def read(p,*a,**kw):return json.dumps(profile) if p.name=='demo-pilot-rhino-20261001.json' else real(p,*a,**kw)
  with patch.object(Path,'read_text',autospec=True,side_effect=read),patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-rhino-20261001.json'}):
   self.assertEqual(validate_pool_plan(plan),plan)
   for key,value in [('sourceFormal',{}),('emptyCandidate',{}),('completePreserved',100),('fromGameId',32714),('newBetAllowance',101),('workers',21),('perWorker',6)]:
    original=profile[key];profile[key]=value
    with self.assertRaises(Exception):validate_pool_plan(plan)
    profile[key]=original
   with self.assertRaises(Exception):validate_pool_plan({**plan,'target':299900})
