import json, os, unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch
from pool_plan import validate_pool_plan
from store import digest


class RepairPlanTests(unittest.TestCase):
    def test_independent_repair_scopes_and_fail_closed_identity(self):
        root = Path(__file__).resolve().parents[2]
        plans = json.loads((root/'config/round-one-plans.json').read_text())
        registry = json.loads((root/'service/round_types.json').read_text())['profiles']
        scopes = [('mansion',32714,129,'huffnpuffmoneymansionhighlimit96-round-one-base-v1-hard-hat-retrigger-v2'),
                  ('piggies',32636,33,'richlittlepiggiesworldclass96-round-one-base-v1-size2-free-v1'),
                  ('morepuff',32718,91,'huffnmorepuffhighlimit96-round-one-base-v1-wheel-megahat-single-v1')]
        for name, game, count, extension in scopes:
            base = plans[str(game)]
            plan = {**base, 'demoGeneration':'b'*64}
            candidate = dict(schema='sg-repaired-demo-candidate-v1', oldGeneration='a'*64,
                             basePlanHash=digest(base), oldPlanHash=digest({**base,'demoGeneration':'a'*64}),
                             completePreserved=count, extension=extension, mappingHash=digest(registry[extension]),
                             closureKey=f"closed-demo-pilot:{base['trialId']}:{'a'*64}",
                             repairKey=f"game-repair:{base['trialId']}:{'a'*64}",
                             **{k:'c'*64 for k in ('closureHash','repairHash','poolHash','campaignHash','batchesHash','recordsHash')})
            original = dict(schema='sg-demo-next-game-v1', gameId=game, fromGameId=32795,
                            oldPlanHash=digest(base), planHash=digest(plan), generation='b'*64,
                            workers=20, perWorker=5, newBetAllowance=100, completePreserved=count,
                            abandonedAttempts=0, repairedCandidate=candidate,
                            sourceFormal=dict(schema='sg-formal-source-boundary-v1',kind='complete',proofHash='d'*64))
            filename = f'demo-repair-{name}-20261001.json'
            profile = deepcopy(original)
            real = Path.read_text
            def read(path,*args,**kwargs):
                return json.dumps(profile) if path.name == filename else real(path,*args,**kwargs)
            with self.subTest(game=game), patch.object(Path,'read_text',autospec=True,side_effect=read), patch.dict(os.environ,{'SG_DEMO_PILOT_PROFILE':filename}):
                self.assertEqual(validate_pool_plan(plan),plan)
                for field, value in [('mappingHash','0'*64),('closureKey','other'),('repairKey','other'),('oldGeneration','b'*64),('extension','unreviewed'),('recordsHash',''),('completePreserved',count+1)]:
                    profile=deepcopy(original);profile['repairedCandidate'][field]=value
                    with self.subTest(field=field),self.assertRaises(Exception):validate_pool_plan(plan)
                for field, value in [('sourceFormal',{}),('fromGameId',game),('newBetAllowance',200),('workers',21),('completePreserved',count+1),('abandonedAttempts',1),('emptyCandidate',{'schema':'x'}),('legacyImport',{'schema':'x'})]:
                    profile=deepcopy(original);profile[field]=value
                    with self.subTest(field=field),self.assertRaises(Exception):validate_pool_plan(plan)
