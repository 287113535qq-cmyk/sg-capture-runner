import json,pathlib,unittest
from crystal_free_route import inspect_control
H=pathlib.Path(__file__).resolve().parent
class RouteTests(unittest.TestCase):pass
for case in json.loads((H/'route-vectors-private.json').read_bytes())['cases']:
 def f(self,c=case):
  if not c['accept']:
   with self.assertRaises((ValueError,TypeError)):inspect_control(c['input'])
  else:
   out=inspect_control(c['input']);self.assertEqual(out['next'],c['next'])
   self.assertFalse(out['captureAuthorized']);self.assertFalse(out['businessComplete']);self.assertFalse(out['moneyValidated'])
 setattr(RouteTests,'test_'+case['id'].replace('-','_'),f)
if __name__=='__main__':unittest.main()
