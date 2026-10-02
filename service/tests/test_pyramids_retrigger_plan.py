import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pyramids_retrigger_plan import pyramids_retrigger_plan
from store import digest
BASE=json.loads((Path(__file__).resolve().parents[2]/'config/round-one-plans.json').read_text())['32721']
def fixture():
 plan={**BASE,'countAllocation':'a'*64,'featureProfile':'pyramids-ten-retrigger-v1'}
 p=dict(schema='sg-formal-repair-pyramids-v8',gameId=32721,group='secondary',workerOffset=20,basePlanHash=digest(BASE),
  completePreserved=5787,remainingComplete=294063,historicalBaseline=150,totalTarget=300000,maxSequence=600000,
  sessionRotation='closed-batches-v1',oldProfileHash='ea7929295dc8f5098b2d392262b563cf4158c87051987c8c71e62cd9b727fcf9',
  sourceRun='36951574835:1',sourceCommit='e2383403cb09d36c34aafcdbc49d9a1948831a06',
  retirementKey='count-shared-close:sg_r1_20260928_32721:36951574835:1:complete',
  featureProfile=plan['featureProfile'],controlReadMode='compact-worker-v1',gatewayHash='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',recordsHash='656c64a4430f731a2afb31110756bb79a01988bb5602f7c6edb29d0b1dbb8433',stateWriteMode='versioned-delta-v1',activation=plan['countAllocation'],planHash=digest(plan))
 return plan,p
class MixedPlanTests(unittest.TestCase):
 def test_bound_parent_and_remaining_target(self):
  plan,p=fixture();self.assertEqual(pyramids_retrigger_plan(BASE,p),plan)
  self.assertEqual(p['remainingComplete']+p['completePreserved']+p['historicalBaseline'],300000)
 def test_unbound_or_expanded_scope_rejected(self):
  for key,value in dict(remainingComplete=300000,completePreserved=0,historicalBaseline=0,totalTarget=600000,maxSequence=600001,sourceRun='999:1',sourceCommit='c'*40,oldProfileHash='b'*64,retirementKey='other',featureProfile='other',stateWriteMode=None,activation='bad').items():
   _,p=fixture();p[key]=value
   with self.subTest(key=key),self.assertRaises(Exception):pyramids_retrigger_plan(BASE,p)
