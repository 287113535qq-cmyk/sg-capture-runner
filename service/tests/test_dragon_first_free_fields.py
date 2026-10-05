import copy,json,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from dragon_first_free_fields import route,intent,validate_proof,policy
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError
from store import digest
ROOT=Path(__file__).resolve().parents[2];REG=json.loads((ROOT/'config/ag-rolling-plans.json').read_bytes());PLAN=REG['plans']['32497'];FIX=json.loads((ROOT/'service/tests/fixtures/dragon-first-free-v4-synthetic.json').read_bytes())
def raw():return copy.deepcopy(FIX['raw'])
def alter(r,k,v):
 s=r['steps'][-1];p=dict(x.split('=',1) for x in s['responsePayload'].split('&'))
 if v is None:p.pop(k,None)
 else:p[k]=v
 s['responsePayload']='&'.join(f'{k}={v}' for k,v in p.items());s['responseXml']='<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD>'+s['responsePayload'].replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'
class DragonFirstFreeTests(unittest.TestCase):
 def test_own_first_free_constructor_params(self):
  self.assertEqual(route(PLAN,raw()),dict(request={'MSGID':'FREE_GAME'},options=[],settlementApproved=False))
  pid=dict(x.split('=',1) for x in raw()['steps'][0]['requestPayload'].split('&'))['PID'];p=f'GN={PLAN["runtimeSlug"]}&PID={pid}&AP=false&BPL=5&LB=50&MSGID=FREE_GAME'
  self.assertEqual(intent(PLAN,raw(),p),{'validated':True})
  for bad in (p.replace('LB=50','LB=25'),p+'&CFG=0',p+'&BPR=10',p.replace('FREE_GAME','BET')):
   with self.assertRaisesRegex(FieldError,'INTENT_CHANGED'):intent(PLAN,raw(),bad)
 def test_parent_and_old_markers_refuse_settlement(self):
  for n,msg in ((1,'FEATURE_START'),(2,'FEATURE_PICK'),(3,'FEATURE_END')):
   r=raw();r['steps']=r['steps'][:n];self.assertEqual(route(PLAN,r)['request']['MSGID'],msg)
  with self.assertRaisesRegex(FieldError,'INCOMPLETE_DRAGON_FIRST_FREE'):NativeNextgenFields(PLAN).settled(raw())
  r=raw();del r['dragonFreeContract']
  with self.assertRaisesRegex(FieldError,'INCOMPLETE_DRAGON_END'):NativeNextgenFields(PLAN).settled(r)
 def test_money_counters_session_exact_joint(self):
  for k,v in [('B','1'),('AB','1'),('TW','1'),('SID','other'),('NFG','0'),('NFG','9'),('TFG','99'),('FGT','99'),('CW','1'),('FID','0|'),('GCT','0'),('PD','unknown'),('LB','50')]:
   r=raw();alter(r,k,v)
   with self.subTest(k=k),self.assertRaises(FieldError):route(PLAN,r)
 def test_xml_timing_and_unknown_free_never_terminal(self):
  r=raw();r['steps'][-1]['responseXml']=r['steps'][-1]['responseXml'].replace('<OGS_RC>0</OGS_RC>','<OGS_RC>1</OGS_RC>')
  with self.assertRaisesRegex(FieldError,'XML'):route(PLAN,r)
  r=raw();r['steps'][-1]['elapsedMs']=300001
  with self.assertRaisesRegex(FieldError,'TIMING'):route(PLAN,r)
  r=raw();r['steps'].append(copy.deepcopy(r['steps'][-1]));r['steps'][-1]['msgId']='FREE_GAME'
  with self.assertRaisesRegex(FieldError,'DRAGON_FREE_RESPONSE_REVIEW_REQUIRED'):route(PLAN,r)
 def test_resigned_policy_rejects_expansion(self):
  p=copy.deepcopy(policy());p['allowedInitialFreeCounts'].append(9)
  with patch('dragon_first_free_fields.policy',return_value=p),self.assertRaisesRegex(FieldError,'BINDING'):route({**PLAN,'dragonFreeContractHash':digest(p)},raw())
 def test_mandatory_proof_parent_and_wiring(self):
  self.assertTrue(validate_proof(PLAN,REG['proofs']['32497']))
  for k,v in [('actualOwnCodecPythonRequests',279),('ownCandidateIntentsHash','a'*64),('frontendExecutionHash','a'*64),('oldOrdinaryRecordFormsHash','a'*64),('freeResponsesObserved',1),('failedRoundsCredited',1)]:
   p=copy.deepcopy(REG['proofs']['32497']);p['dragonFreeEvidence']['wiringEvidence'][k]=v
   with self.subTest(k=k),self.assertRaisesRegex(FieldError,'PROOF'):validate_proof(PLAN,p)
  p=copy.deepcopy(REG['proofs']['32497']);del p['dragonFreeEvidence']['wiringEvidence']
  with self.assertRaisesRegex(FieldError,'PROOF'):validate_proof(PLAN,p)
