import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pyramids_fifteen_plan import pyramids_fifteen_plan
from store import digest
BASE=json.loads((Path(__file__).resolve().parents[2]/'config/round-one-plans.json').read_text())['32721']
def fixture():
 plan={**BASE,'countAllocation':'a'*64,'featureProfile':'pyramids-fifteen-free-v1'}
 p=dict(schema='sg-formal-repair-pyramids-v5',gameId=32721,group='secondary',workerOffset=20,basePlanHash=digest(BASE),
  completePreserved=5024,remainingComplete=294826,historicalBaseline=150,totalTarget=300000,maxSequence=600000,
  sessionRotation='closed-batches-v1',oldProfileHash='f32e340466c2c02d725b93e87a92a493f013157275f6ea7ff699d47712ee8892',
  sourceRun='36937673870:1',sourceCommit='a66e2c7ac642c87ecedbbe9ddde5194bcae4de36',
  retirementKey='count-shared-close:sg_r1_20260928_32721:36937673870:1:complete',
  featureProfile=plan['featureProfile'],controlReadMode='compact-worker-v1',gatewayHash='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',recordsHash='a030ea2977061f63db69493a19fd09233fff9b784d49cf5b8ca448f3206c45aa',stateWriteMode='versioned-delta-v1',activation=plan['countAllocation'],planHash=digest(plan))
 return plan,p
class MixedPlanTests(unittest.TestCase):
 def test_bound_parent_and_remaining_target(self):
  plan,p=fixture();self.assertEqual(pyramids_fifteen_plan(BASE,p),plan)
  self.assertEqual(p['remainingComplete']+p['completePreserved']+p['historicalBaseline'],300000)
 def test_unbound_or_expanded_scope_rejected(self):
  for key,value in dict(remainingComplete=300000,completePreserved=0,historicalBaseline=0,totalTarget=600000,maxSequence=600001,sourceRun='999:1',sourceCommit='c'*40,oldProfileHash='b'*64,retirementKey='other',featureProfile='other',stateWriteMode=None,activation='bad').items():
   _,p=fixture();p[key]=value
   with self.subTest(key=key),self.assertRaises(Exception):pyramids_fifteen_plan(BASE,p)
