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
 def test_awarded_previous_slots_persist_without_another_award(self):
  r=sample();old=HuffFields(PLAN).settled(r)
  for s in r['steps'][3:]:
   for k in ('responsePayload','responseXml'):s[k]=s[k].replace('PCFID~1|','PCFID~1|1|')
  for i in range(3,len(r['steps'])):
   self.assertEqual(HuffFields(PLAN).next_request({**r,'steps':r['steps'][:i]}),{'MSGID':'FREE_GAME'})
  self.assertEqual(HuffFields(PLAN).settled(r),old)
  unearned=sample()
  for k in ('responsePayload','responseXml'):unearned['steps'][1][k]=unearned['steps'][1][k].replace('PCFID~1|','PCFID~1|1|')
  self.assertEqual(HuffFields(PLAN).settled(unearned),old)
 def test_ordered_prior_slots_do_not_imply_additional_free_games(self):
  r=sample();r['steps']=r['steps'][:7]
  from xml.sax.saxutils import escape
  for i,step in enumerate(r['steps']):
   values=dict(x.split('=',1) for x in step['responsePayload'].split('&'))
   values.update(TFG='6',NFG=str(6-i),CFGG=str(i))
   g=dict(x.split('~',1) for x in values['GSD'].split('#'))
   if i:g.update(CFFGT='0',CFTFG='6',CFNFG=str(6-i),CFCFGG=str(i),PCFID='1|'*i)
   values['GSD']='#'.join(k+'~'+v for k,v in g.items())
   step['responsePayload']='&'.join(k+'='+v for k,v in values.items())
   step['responseXml']='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+escape(step['responsePayload'])+'</PAYLOAD></GDMRESPONSE>'
  for i in range(1,7):self.assertEqual(HuffFields(PLAN).next_request({**r,'steps':r['steps'][:i]}),{'MSGID':'FREE_GAME'})
  self.assertIsNone(HuffFields(PLAN).next_request(r));self.assertEqual(review(r)['retriggers'],0)
  self.assertEqual(HuffFields(PLAN).settled(r)['bonus'],2)
  for bad in ('1||','1|0|','1|2|','1|'*101):
   changed=copy.deepcopy(r)
   for k in ('responsePayload','responseXml'):changed['steps'][2][k]=changed['steps'][2][k].replace('PCFID~1|1|','PCFID~'+bad)
   with self.assertRaises(FieldError):HuffFields(PLAN).next_request(changed)

 def test_single_previous_slot_additive_retrigger_preserves_old_normalization(self):
  r=sample();old=HuffFields(PLAN).settled(r)
  for s in r['steps']:
   for k in ('responsePayload','responseXml'):s[k]=s[k].replace('PCFID~1|1|','PCFID~1|')
  for i in range(1,len(r['steps'])):self.assertEqual(HuffFields(PLAN).next_request({**r,'steps':r['steps'][:i]}),{'MSGID':'FREE_GAME'})
  self.assertEqual(HuffFields(PLAN).settled(r),old)
  wrong_award=copy.deepcopy(r)
  for k in ('responsePayload','responseXml'):wrong_award['steps'][2][k]=wrong_award['steps'][2][k].replace('CFFGT~1','CFFGT~0')
  with self.assertRaises(FieldError):HuffFields(PLAN).next_request(wrong_award)
  s=r['steps'][2]
  for k in ('responsePayload','responseXml'):s[k]=s[k].replace('PCFID~1|','PCFID~0|')
  with self.assertRaises(FieldError):HuffFields(PLAN).settled(r)

 def test_prefix_and_distinct_settlement(self):
  r=sample();a=HuffFields(PLAN)
  for i in range(1,len(r['steps'])):
   p={**r,'steps':r['steps'][:i]};self.assertEqual(a.next_request(p),{'MSGID':'FREE_GAME'})
   with self.assertRaises(FieldError):a.settled(p)
  f=a.settled(r);self.assertEqual(f['typeMappingHash'],type_profile(EXTENSION)[1]);self.assertEqual(f['bonus'],2);self.assertEqual(f['bet'],5)
 def test_wrong_awards_or_mixed_slots_still_rejected(self):
  for before,after in [('PCFID~1|1|','PCFID~1|0|'),('CFFGT~1','CFFGT~0'),('FID=1|','FID=1|2|'),('RID=1','RID=0'),('NFG=5','NFG=0')]:
   r=copy.deepcopy(sample());s=r['steps'][2];s['responsePayload']=s['responsePayload'].replace(before,after);s['responseXml']=s['responseXml'].replace(before,after)
   with self.assertRaises(FieldError):HuffFields(PLAN).settled(r)
if __name__=='__main__':unittest.main()
