import copy
import json
import pathlib
import subprocess
import unittest
from pearl_fields import PearlFields, SOURCE, review
from round_fields import FieldError

ROOT=pathlib.Path(__file__).resolve().parents[2]
PLAN={'gameId':32795,'runtimeGameId':33155,'sourceKey':SOURCE,'betRaw':200}

def sample(free=True):
    # Shared entirely synthetic input; Python computes its own independent result.
    result=subprocess.run(['node','--input-type=module','-e',
        "import {pearlFixture} from './scripts/trial/pearl-fixture.mjs';console.log(JSON.stringify(pearlFixture("+str(free).lower()+")))"],
        cwd=ROOT,text=True,capture_output=True,check=True)
    return json.loads(result.stdout)

class PearlTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.free=sample();cls.ordinary=sample(False)

    def test_every_prefix_and_settlement(self):
        adapter=PearlFields(PLAN)
        for raw in (self.free,self.ordinary):
            for count in range(len(raw['steps'])):
                partial={**raw,'steps':raw['steps'][:count]}
                self.assertEqual(adapter.next_request(partial),{'MSGID':'EndGame' if count==len(raw['steps'])-1 else 'Logic'})
                self.assertEqual(adapter.validate_intent(partial,raw['steps'][count]['requestPayload']),{'validated':True})
                with self.assertRaises(FieldError):adapter.settled(partial)
            fields=adapter.settled(raw)
            self.assertEqual(fields['money'],dict(startBalanceRaw=100000,endBalanceRaw=100200,totalWinRaw=400,betRaw=200))
            self.assertEqual(fields['bonus'],int(len(raw['steps'])==10))

    def test_mutated_responses_fail(self):
        changes=[('freeSpinNumber="1"','freeSpinNumber="2"'),('freeSpinsAwarded="0"','freeSpinsAwarded="8"'),
                 ('readyForEndGame="N"','readyForEndGame="Y"'),('isMaxWin="0"','isMaxWin="1"'),
                 ('totalWin="0"','totalWin="1"'),('<BGInfo','<BGInfo UNKNOWN="1"'),('<AccountData/>','<UnknownFeature/>')]
        for before,after in changes:
            raw=copy.deepcopy(self.free)
            raw['steps'][1]['responsePayload']=raw['steps'][1]['responseXml']=raw['steps'][1]['responsePayload'].replace(before,after)
            with self.subTest(before=before),self.assertRaises(FieldError):review(raw)

    def test_session_second_wager_and_missing_end(self):
        for key,before,after in [('requestPayload','synthetic-1','foreign'),('requestPayload','total="200"','total="400"')]:
            raw=copy.deepcopy(self.free);raw['steps'][1][key]=raw['steps'][1][key].replace(before,after)
            with self.assertRaises(FieldError):review(raw)
        raw=copy.deepcopy(self.free);raw['steps'].pop()
        with self.assertRaises(FieldError):PearlFields(PLAN).settled(raw)
        raw=copy.deepcopy(self.free);raw['startBalanceRaw']+=1
        with self.assertRaises(FieldError):review(raw)

if __name__=='__main__':unittest.main()
