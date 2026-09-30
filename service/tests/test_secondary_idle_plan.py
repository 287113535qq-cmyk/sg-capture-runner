import os,json,unittest,copy
from pathlib import Path
from unittest.mock import patch
from pool_plan import validate_pool_plan
from store import digest
class SecondaryIdleTests(unittest.TestCase):
    def test_independent_secondary_profile_and_fixed_archive(self):
        root=Path(__file__).resolve().parents[2];old=json.loads((root/'config/round-one-plans.json').read_text())['32719']
        plan={**old,'demoGeneration':'e'*64}
        profile={'schema':'sg-demo-secondary-idle-pilot-v1','group':'secondary','workerOffset':20,'gameId':32719,'fromGameId':None,'workers':20,'perWorker':5,'newBetAllowance':100,'oldPlanHash':digest(old),'generation':'e'*64,'planHash':digest(plan),'completePreserved':67,'abandonedAttempts':1,'legacyImport':{'schema':'sg-parked-import-v1','mongoCount':60,'complete':67,'pending':1,'bytes':74009,'archiveHash':'2d815dffe1185deb4b13d180744f8eec69364956297efc122cd1858f9b6c01f2'}}
        real=Path.read_text
        def read(path,*args,**kwargs):return json.dumps(profile) if path.name=='demo-pilot-inca-20261001.json' else real(path,*args,**kwargs)
        with patch.object(Path,'read_text',autospec=True,side_effect=read),patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':'demo-pilot-inca-20261001.json'}):
            self.assertEqual(validate_pool_plan(plan),plan)
            for key,value in [('workerOffset',0),('workerOffset',20.0),('group','primary'),('fromGameId',32795),('newBetAllowance',101),('completePreserved',60),('sourceRunKey','capture-run:1:1')]:
                before=copy.deepcopy(profile);profile[key]=value
                with self.assertRaises(Exception):validate_pool_plan(plan)
                profile.clear();profile.update(before)
            profile['legacyImport']['archiveHash']='0'*64
            with self.assertRaises(Exception):validate_pool_plan(plan)
