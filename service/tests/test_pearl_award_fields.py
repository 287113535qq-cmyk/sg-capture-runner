import copy,json,pathlib,subprocess,unittest
from pearl_award_fields import PearlAwardFields,SOURCE,review
from pearl_retrigger_fields import PearlRetriggerFields
from round_fields import FieldError
ROOT=pathlib.Path(__file__).resolve().parents[2]
class PearlAwardTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  r=subprocess.run(['node','--input-type=module','-e',"import {awardFixture as f} from './scripts/trial/pearl-award-fixture.mjs';console.log(JSON.stringify([f(8),f(8,{7:8}),f(15),f(15,{4:8,14:15})]))"],cwd=ROOT,text=True,capture_output=True,check=True)
  cls.raws=json.loads(r.stdout);cls.plan={'gameId':32795,'runtimeGameId':33155,'sourceKey':SOURCE,'betRaw':200};cls.adapter=PearlAwardFields(cls.plan)
 def test_old_mapping_preserved_and_new_mapping_distinct(self):
  old=PearlRetriggerFields(self.plan)
  for raw in self.raws[:2]:self.assertEqual(self.adapter.settled(raw),old.settled(raw))
  self.assertNotEqual(self.adapter.settled(self.raws[2])['typeMappingHash'],old.settled(self.raws[0])['typeMappingHash'])
  with self.assertRaises(FieldError):old.settled(self.raws[2])
 def test_all_prefixes_and_repeated_counts(self):
  for raw in self.raws:
   self.assertIsNone(review(raw)['next'])
   for n in range(len(raw['steps'])):
    prefix={**raw,'steps':raw['steps'][:n]}
    self.assertEqual(self.adapter.next_request(prefix),{'MSGID':'EndGame' if n==len(raw['steps'])-1 else 'Logic'})
    with self.assertRaises(FieldError):self.adapter.settled(prefix)
 def test_new_count_does_not_bypass_amount_counter_or_session_checks(self):
  for key,a,b in [('responsePayload','freeSpinsTotal="15"','freeSpinsTotal="16"'),('responsePayload','bonusAwarded="Y"','bonusAwarded="N"'),('requestPayload','synthetic-1','wrong')]:
   raw=copy.deepcopy(self.raws[2]);i=1 if key=='requestPayload' else 0;raw['steps'][i][key]=raw['steps'][i][key].replace(a,b)
   if key=='responsePayload':raw['steps'][i]['responseXml']=raw['steps'][i][key]
   with self.assertRaises(FieldError):self.adapter.settled(raw)
