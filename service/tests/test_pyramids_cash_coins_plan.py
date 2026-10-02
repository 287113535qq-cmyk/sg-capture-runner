import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pyramids_cash_coins_plan import pyramids_cash_coins_plan
from store import digest
BASE=json.loads((Path(__file__).resolve().parents[2]/'config/round-one-plans.json').read_text())['32721']
def fixture():
 plan={**BASE,'countAllocation':'a'*64,'featureProfile':'pyramids-cash-coins-v1'}
 p=dict(schema='sg-formal-repair-pyramids-v9',gameId=32721,group='secondary',workerOffset=20,basePlanHash=digest(BASE),
  completePreserved=7503,remainingComplete=292347,historicalBaseline=150,totalTarget=300000,maxSequence=600000,
  sessionRotation='closed-batches-v1',oldProfileHash='9b5be7e5e018d9be4c7c09adda0dcac84bbae82c75e3d3c4d5c1fcc1b4982a34',
  sourceRun='36955443358:1',sourceCommit='3a4efb77f104cb23306b635ccfdddbd1daa5340d',
  retirementKey='count-parked-close:sg_r1_20260928_32721:36955443358:1:complete',
  featureProfile=plan['featureProfile'],controlReadMode='compact-worker-v1',gatewayHash='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',recordsHash='11f76cc6db83acfc439ddb4cea67ed1e842fc2312db2d3ee03c6a1fc38cbe5f6',stateWriteMode='versioned-delta-v1',activation=plan['countAllocation'],planHash=digest(plan))
 return plan,p
class MixedPlanTests(unittest.TestCase):
 def test_bound_parent_and_remaining_target(self):
  plan,p=fixture();self.assertEqual(pyramids_cash_coins_plan(BASE,p),plan)
  self.assertEqual(p['remainingComplete']+p['completePreserved']+p['historicalBaseline'],300000)
 def test_unbound_or_expanded_scope_rejected(self):
  for key,value in dict(remainingComplete=300000,completePreserved=0,historicalBaseline=0,totalTarget=600000,maxSequence=600001,sourceRun='999:1',sourceCommit='c'*40,oldProfileHash='b'*64,retirementKey='other',featureProfile='other',stateWriteMode=None,activation='bad').items():
   _,p=fixture();p[key]=value
   with self.subTest(key=key),self.assertRaises(Exception):pyramids_cash_coins_plan(BASE,p)
