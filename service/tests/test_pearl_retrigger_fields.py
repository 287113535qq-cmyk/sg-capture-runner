
import copy,json,pathlib,subprocess,unittest
from pearl_retrigger_fields import PearlRetriggerFields,SOURCE,review
from round_fields import FieldError
ROOT=pathlib.Path(__file__).resolve().parents[2]
class PearlRetriggerTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  result=subprocess.run(['node','--input-type=module','-e',"import {retriggerFixture} from './scripts/trial/pearl-retrigger-fixture.mjs';console.log(JSON.stringify(retriggerFixture()))"],cwd=ROOT,text=True,capture_output=True,check=True)
  cls.raw=json.loads(result.stdout);cls.adapter=PearlRetriggerFields({'gameId':32795,'runtimeGameId':33155,'sourceKey':SOURCE,'betRaw':200})
 def test_complete_and_all_prefixes(self):
  self.assertEqual(review(self.raw)['retriggers'],1)
  for n in range(len(self.raw['steps'])):
   raw={**self.raw,'steps':self.raw['steps'][:n]}
   self.assertEqual(self.adapter.next_request(raw),{'MSGID':'EndGame' if n==17 else 'Logic'})
   with self.assertRaises(FieldError):self.adapter.settled(raw)
  fields=self.adapter.settled(self.raw);self.assertEqual(fields['money']['betRaw'],200);self.assertEqual(fields['money']['totalWinRaw'],400)
 def test_reject_counter_money_flag_and_missing_frame(self):
  changes=[('freeSpinsTotal="16"','freeSpinsTotal="8"'),('freeSpinsAwarded="8"','freeSpinsAwarded="0"'),('freeSpinNumber="7"','freeSpinNumber="6"'),('bonusAwarded="Y"','bonusAwarded="N"'),('readyForEndGame="N"','readyForEndGame="Y"')]
  for a,b in changes:
   raw=copy.deepcopy(self.raw);step=raw['steps'][7];step['responseXml']=step['responsePayload']=step['responsePayload'].replace(a,b)
   with self.assertRaises(FieldError):self.adapter.settled(raw)
  raw=copy.deepcopy(self.raw);raw['steps'].pop(10)
  with self.assertRaises(FieldError):self.adapter.settled(raw)
  raw=copy.deepcopy(self.raw);raw['steps'][-1]['responseBalance']+=1
  with self.assertRaises(FieldError):self.adapter.settled(raw)
