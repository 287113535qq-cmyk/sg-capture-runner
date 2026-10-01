import unittest, json, pathlib, sys, copy
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from pyramids_major_plan import pyramids_major_plan
from store import digest
class MajorPlanTests(unittest.TestCase):
    def fixture(self):
        base=json.loads((pathlib.Path(__file__).resolve().parents[2]/'config/round-one-plans.json').read_text())['32721']
        plan={**base,'countAllocation':'a'*64}
        p={'schema':'sg-formal-repair-pyramids-v3','gameId':32721,'group':'secondary','workerOffset':20,'basePlanHash':digest(base),'completePreserved':3211,'remainingComplete':296639,'historicalBaseline':150,'totalTarget':300000,'maxSequence':600000,'sessionRotation':'closed-batches-v1','oldProfileHash':'1c7f256253480053168458a38b49e133a76240448416f7689b14753f439c7552','sourceRun':'36848037333:1','sourceCommit':'4c13485557529aba9dc7657487e7d9b75634f2b4','retirementKey':'count-shared-close:sg_r1_20260928_32721:36848037333:1:complete','featureProfile':'pyramids-free-major-v1','activation':'a'*64,'planHash':digest(plan)}
        return base,p,plan
    def test_preserves_history_and_remaining_quota(self):
        b,p,plan=self.fixture();self.assertEqual(pyramids_major_plan(b,p),plan);self.assertEqual(p['historicalBaseline']+p['completePreserved']+p['remainingComplete'],300000)
    def test_changed_source_count_quota_and_feature_refuse(self):
        for key,value in [('sourceRun','999:1'),('sourceCommit','0'*40),('completePreserved',0),('remainingComplete',299850),('oldProfileHash','0'*64),('featureProfile','free-v1'),('activation','bad'),('group','primary'),('retirementKey','ordinary')]:
            b,p,_=self.fixture();p[key]=value
            with self.subTest(key=key),self.assertRaises(Exception):pyramids_major_plan(b,p)
