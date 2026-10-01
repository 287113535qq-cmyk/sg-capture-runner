import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pyramids_mixed_plan import pyramids_mixed_plan
from store import digest
BASE=json.loads((Path(__file__).resolve().parents[2]/'config/round-one-plans.json').read_text())['32721']
def fixture():
 plan={**BASE,'countAllocation':'a'*64,'featureProfile':'pyramids-free-hold-v1'}
 p=dict(schema='sg-formal-repair-pyramids-v4',gameId=32721,group='secondary',workerOffset=20,basePlanHash=digest(BASE),
  completePreserved=3627,remainingComplete=296223,historicalBaseline=150,totalTarget=300000,maxSequence=600000,
  sessionRotation='closed-batches-v1',oldProfileHash='5c7278ed911ed73ca082e611e8556909704e979b9b6447d29591ec8f8cf6a411',
  sourceRun='36860241790:1',sourceCommit='d2d38028883eef3a609ba3209e19785857a54e56',
  retirementKey='formal-stopped-retire:sg_r1_20260928_32721:23a2419605be82e9bf0b6c359a501bc47b0c2b1015e7b9de8ceb5d88c03f7c62:complete',
  featureProfile=plan['featureProfile'],stateWriteMode='versioned-delta-v1',activation=plan['countAllocation'],planHash=digest(plan))
 return plan,p
class MixedPlanTests(unittest.TestCase):
 def test_bound_parent_and_remaining_target(self):
  plan,p=fixture();self.assertEqual(pyramids_mixed_plan(BASE,p),plan)
  self.assertEqual(p['remainingComplete']+p['completePreserved']+p['historicalBaseline'],300000)
 def test_unbound_or_expanded_scope_rejected(self):
  for key,value in dict(remainingComplete=300000,completePreserved=0,historicalBaseline=0,totalTarget=600000,maxSequence=600001,sourceRun='999:1',sourceCommit='c'*40,oldProfileHash='b'*64,retirementKey='other',featureProfile='other',stateWriteMode=None,activation='bad').items():
   _,p=fixture();p[key]=value
   with self.subTest(key=key),self.assertRaises(Exception):pyramids_mixed_plan(BASE,p)
