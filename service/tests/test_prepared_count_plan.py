import copy,json,os,unittest
from pathlib import Path
from unittest.mock import patch
from store import digest
from prepared_count_plan import prepared_count_plan
from pool_plan import validate_pool_plan

class PreparedCountPlanTests(unittest.TestCase):
    def fixture(self):
        base=json.loads((Path(__file__).resolve().parents[2]/'config/round-one-plans.json').read_text(encoding='utf-8'))['32714']
        profile=dict(schema='sg-prepared-count-profile-v1',gameId=32714,trialId=base['trialId'],group='primary',
            basePlanHash=digest(base),targetComplete=300000,completePreserved=152,remainingComplete=299848,
            maxSequence=600000,sessionRotation='closed-batches-v1',newBetAllowance=0,requiresNewSession=True,
            createdAt=0,expiresAt=7200000)
        for field in ('activation','preparationProofHash','failureEvidenceHash','sceneHash','recordsHash','closureHash'):profile[field]='a'*64
        plan={**base,'target':300000,'countAllocation':profile['activation']};profile['planHash']=digest(plan)
        auth=dict(schema='sg-prepared-count-authorization-v1',gameId=32714,trialId=base['trialId'],group='primary',
            basePlanHash=digest(base),profileHash=digest(profile),activation=profile['activation'])
        return base,profile,auth,plan

    def test_exact_authorization_and_preserved_count_no_new_pilot(self):
        base,p,a,plan=self.fixture();self.assertEqual(prepared_count_plan(base,p,a),plan)
        for field,value in [('newBetAllowance',100),('completePreserved',True),('remainingComplete',300000),
            ('maxSequence',900000),('requiresNewSession',False),('planHash','b'*64)]:
            bad={**p,field:value};auth={**a,'profileHash':digest(bad)}
            with self.subTest(field=field),self.assertRaises(Exception):prepared_count_plan(base,bad,auth)

    def test_real_pool_plan_entry_requires_exact_committed_registry_and_profile(self):
        base,p,a,plan=self.fixture();name=f"formal-prepared-count-32714-{p['activation']}.json"
        registry=dict(schema='sg-prepared-count-authorizations-v1',sourceAllowance=0,profiles={name:a})
        def read(path,*args,**kwargs):
            if path.name=='round-one-plans.json':return json.dumps({'32714':base})
            if path.name=='prepared-count-authorizations.json':return json.dumps(registry)
            if path.name==name:return json.dumps(p)
            raise AssertionError('UNEXPECTED_PROFILE_READ')
        with patch.object(Path,'read_text',read),patch.dict(os.environ,SG_FORMAL_COUNT_PROFILE=name):
            self.assertEqual(validate_pool_plan(plan),plan)
            for field,value in [('target',299900),('buy',1),('countAllocation','b'*64),('demoGeneration','b'*64)]:
                with self.subTest(field=field),self.assertRaises(Exception):validate_pool_plan({**plan,field:value})
            registry['profiles']={}
            with self.assertRaises(Exception):validate_pool_plan(plan)
        with patch.dict(os.environ,SG_FORMAL_COUNT_PROFILE='formal-prepared-count-../../other.json'):
            with self.assertRaises(Exception):validate_pool_plan(plan)

    def test_repair_parent_is_independently_bound_without_changing_complete_target(self):
        base,p,a,plan=self.fixture()
        p['repairParent']=dict(activation='b'*64,specHash='c'*64,sourceCommit='d'*40,sourceRun='9:1',
            closureKey=f"count-shared-close:{base['trialId']}:9:1:complete")
        a['profileHash']=digest(p);self.assertEqual(prepared_count_plan(base,p,a),plan)
        for kind in ('shared','parked','prepared'):
            candidate=copy.deepcopy(p)
            candidate['repairParent']['closureKey']=f"count-{kind}-close:{base['trialId']}:9:1:complete"
            self.assertEqual(prepared_count_plan(base,candidate,{**a,'profileHash':digest(candidate)}),plan)
        for field,value in [('activation',p['activation']),('specHash','wrong'),('sourceRun','9:2'),('closureKey','foreign')]:
            bad=copy.deepcopy(p);bad['repairParent'][field]=value;auth={**a,'profileHash':digest(bad)}
            with self.subTest(field=field),self.assertRaises(Exception):prepared_count_plan(base,bad,auth)
