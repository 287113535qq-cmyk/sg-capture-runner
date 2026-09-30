"""Synthetic isolated Hard Hat +1 retrigger; never source evidence."""
import copy,unittest
from test_huff_fields import exchange,raw,PLAN
from huff_fields import HuffFields
from huff_retrigger_review import review,EXTENSION
from round_fields import FieldError,type_profile

def sample():
 steps=[]
 for i in range(8):
  total=6 if i<2 else 7;left=total-i;added=int(i==2)
  g={'VA':','.join(['0']*15),'HHADD':'1'}
  if i:g.update(FEAT='HARDHAT',PCFID='1|1|' if added else '1|',CFFGT=str(added),CFTFG=str(total),CFNFG=str(left),CFCFGG=str(i))
  steps.append(exchange('FREE_GAME' if i else 'BET',left,'1|','#'.join(k+'~'+v for k,v in g.items()),win=i*100,TFG=total,CFGG=i,RID=int(i>0)))
 return raw(steps)
class RetriggerTests(unittest.TestCase):
 def test_prefix_and_distinct_settlement(self):
  r=sample();a=HuffFields(PLAN)
  for i in range(1,len(r['steps'])):
   p={**r,'steps':r['steps'][:i]};self.assertEqual(a.next_request(p),{'MSGID':'FREE_GAME'})
   with self.assertRaises(FieldError):a.settled(p)
  f=a.settled(r);self.assertEqual(f['typeMappingHash'],type_profile(EXTENSION)[1]);self.assertEqual(f['bonus'],2);self.assertEqual(f['bet'],5)
 def test_duplicate_slots_need_corresponding_award_and_single_feature(self):
  for before,after in [('PCFID~1|1|','PCFID~1|0|'),('CFFGT~1','CFFGT~0'),('FID=1|','FID=1|2|'),('RID=1','RID=0'),('NFG=5','NFG=0')]:
   r=copy.deepcopy(sample());s=r['steps'][2];s['responsePayload']=s['responsePayload'].replace(before,after);s['responseXml']=s['responseXml'].replace(before,after)
   with self.assertRaises(FieldError):HuffFields(PLAN).settled(r)
if __name__=='__main__':unittest.main()
