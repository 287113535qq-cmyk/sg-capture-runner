import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pyramids_super_hold_plan import pyramids_super_hold_plan
from store import digest
BASE=json.loads((Path(__file__).resolve().parents[2]/'config/round-one-plans.json').read_text())['32721']
def fixture():
 plan={**BASE,'countAllocation':'a'*64,'featureProfile':'pyramids-super-hold-cash-v1'}
 p=dict(schema='sg-formal-repair-pyramids-v6',gameId=32721,group='secondary',workerOffset=20,basePlanHash=digest(BASE),
  completePreserved=5111,remainingComplete=294739,historicalBaseline=150,totalTarget=300000,maxSequence=600000,
  sessionRotation='closed-batches-v1',oldProfileHash='f9fe107deffc81d8ebc86a00d9819987001e599bfe115890e4705f3bc8eb82a8',
  sourceRun='36941485498:1',sourceCommit='6a9d39684e1433cbba1c361044f57c8ee25787d3',
  retirementKey='count-shared-close:sg_r1_20260928_32721:36941485498:1:complete',
  featureProfile=plan['featureProfile'],controlReadMode='compact-worker-v1',gatewayHash='a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',recordsHash='4fb9e24fb9ded80ff45904791293a52742aa2a063572f83529b83d5611675d6a',stateWriteMode='versioned-delta-v1',activation=plan['countAllocation'],planHash=digest(plan))
 return plan,p
class MixedPlanTests(unittest.TestCase):
 def test_bound_parent_and_remaining_target(self):
  plan,p=fixture();self.assertEqual(pyramids_super_hold_plan(BASE,p),plan)
  self.assertEqual(p['remainingComplete']+p['completePreserved']+p['historicalBaseline'],300000)
 def test_unbound_or_expanded_scope_rejected(self):
  for key,value in dict(remainingComplete=300000,completePreserved=0,historicalBaseline=0,totalTarget=600000,maxSequence=600001,sourceRun='999:1',sourceCommit='c'*40,oldProfileHash='b'*64,retirementKey='other',featureProfile='other',stateWriteMode=None,activation='bad').items():
   _,p=fixture();p[key]=value
   with self.subTest(key=key),self.assertRaises(Exception):pyramids_super_hold_plan(BASE,p)
