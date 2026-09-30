import copy,json,pathlib,subprocess,unittest
from rhino_fields import RhinoFields,SOURCE,review
from round_fields import FieldError
ROOT=pathlib.Path(__file__).resolve().parents[2]
class RhinoTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  r=subprocess.run(['node','--input-type=module','-e',"import {rhinoFixture as f} from './scripts/trial/rhino-fixture.mjs';console.log(JSON.stringify([f(0),f(8,{4:5}),f(15,{4:10})]))"],cwd=ROOT,text=True,capture_output=True,check=True)
  cls.rows=json.loads(r.stdout);cls.adapter=RhinoFields({'gameId':32799,'runtimeGameId':33159,'sourceKey':SOURCE,'betRaw':40})
 def test_complete_and_prefixes(self):
  for r in self.rows:
   self.assertEqual(self.adapter.settled(r)['bet'],0.4)
   for n in range(len(r['steps'])):
    p={**r,'steps':r['steps'][:n]}
    self.assertEqual(self.adapter.next_request(p),{'MSGID':'EndGame' if n==len(r['steps'])-1 else 'Logic'})
    self.assertTrue(self.adapter.validate_intent(p,r['steps'][n]['requestPayload'])['validated'])
    with self.assertRaises(FieldError):self.adapter.settled(p)
 def test_terminal_and_money_are_independent(self):
  for before,after in [('remainingFreeSpins="7"','remainingFreeSpins="0"'),('totalWin="0"','totalWin="40"'),('gameID="20124"','gameID="20327"')]:
   r=copy.deepcopy(self.rows[1]);s=r['steps'][1];self.assertIn(before,s['responsePayload']);s['responsePayload']=s['responseXml']=s['responsePayload'].replace(before,after)
   with self.assertRaises(FieldError):self.adapter.settled(r)
 def test_extra_request_field_and_repeat_end_rejected(self):
  r=copy.deepcopy(self.rows[0]);r['steps'][0]['requestPayload']=r['steps'][0]['requestPayload'].replace('</AccountData>','<Extra/></AccountData>')
  with self.assertRaises(FieldError):review(r)
  r=copy.deepcopy(self.rows[0]);r['steps'].append(copy.deepcopy(r['steps'][-1]))
  with self.assertRaises(FieldError):review(r)
