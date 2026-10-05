import copy,json,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from dragon_end_fields import CONTRACT,route,intent,validate_proof,previous,policy
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError
from store import digest
ROOT=Path(__file__).resolve().parents[2]
REG=json.loads((ROOT/'config/ag-rolling-plans.json').read_bytes());PLAN={k:v for k,v in REG['plans']['32497'].items() if k not in ('dragonFreeContract','dragonFreeContractHash')};REG['proofs']['32497']={**{k:v for k,v in REG['proofs']['32497'].items() if k!='dragonFreeEvidence'},'planHash':digest(PLAN)};FIX=json.loads((ROOT/'service/tests/fixtures/dragon-end-v3-synthetic.json').read_bytes())
def raw():return copy.deepcopy(FIX['raw'])
def alter(r,k,v):
 s=r['steps'][-1];p=dict(x.split('=',1) for x in s['responsePayload'].split('&'))
 if v is None:p.pop(k,None)
 else:p[k]=v
 s['responsePayload']='&'.join(f'{k}={v}' for k,v in p.items());s['responseXml']='<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD>'+s['responsePayload'].replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'
class DragonEndTests(unittest.TestCase):
 def test_own_pick_to_end_request_only(self):
  self.assertEqual(route(PLAN,raw()),{'request':{'MSGID':'FEATURE_END','CFG':'0'},'options':[],'settlementApproved':False})
  prefix=f'GN={PLAN["runtimeSlug"]}&PID=gdmgcmoffline-dragon-end-v3&'
  self.assertEqual(intent(PLAN,raw(),prefix+'MSGID=FEATURE_END&CFG=0'),{'validated':True})
  for q in ('MSGID=FEATURE_END&CFG=0&FP=0|1|1','MSGID=FREE_GAME','MSGID=FEATURE_PICK&CFG=0&FP=0|2|1'):
   with self.assertRaisesRegex(FieldError,'INTENT_CHANGED'):intent(PLAN,raw(),prefix+q)
 def test_parent_start_gate_retained(self):
  with self.assertRaisesRegex(FieldError,'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED'):route(PLAN,FIX['parentBlocked'])
  r=raw();r['steps']=r['steps'][:2];self.assertEqual(route(PLAN,r)['request']['FP'],'0|1|1')
 def test_money_session_counters_and_pd_exact(self):
  for k,v in [('B','1'),('AB','1'),('TW','1'),('SID','other'),('CFP_0','2'),('CFR_0','2'),('FS_0','0'),('NFR_0','2'),('FID','1|'),('ABPM','0'),('PD','rid_100~0#')]:
   r=raw();alter(r,k,v)
   with self.subTest(k=k),self.assertRaises(FieldError):route(PLAN,r)
 def test_xml_errors_timing_and_unknown_response_refused(self):
  for tag in ('<OGS_RC>1</OGS_RC>','<ERROR>reject</ERROR>'):
   r=raw();r['steps'][-1]['responseXml']=r['steps'][-1]['responseXml'].replace('<OGS_RC>0</OGS_RC>',tag)
   with self.assertRaisesRegex(FieldError,'XML'):route(PLAN,r)
  r=raw();r['steps'][-1]['elapsedMs']=300001
  with self.assertRaisesRegex(FieldError,'TIMING'):route(PLAN,r)
  r=raw();r['steps'].append(copy.deepcopy(r['steps'][-1]))
  with self.assertRaisesRegex(FieldError,'DRAGON_END_RESPONSE_REVIEW_REQUIRED'):route(PLAN,r)
 def test_old_markers_and_special_settlement_never_credit(self):
  r=raw()
  with self.assertRaisesRegex(FieldError,'INCOMPLETE_DRAGON_END'):NativeNextgenFields(PLAN).settled(r)
  del r['dragonEndContract']
  with self.assertRaisesRegex(FieldError,'INCOMPLETE_EXPLICIT_PROBE'):NativeNextgenFields(PLAN).settled(r)
 def test_re_signed_proof_and_policy_cannot_expand_scope(self):
  self.assertTrue(validate_proof(PLAN,REG['proofs']['32497']))
  for k,v in [('actualOwnCodecPythonRequests',256),('oldAcceptedRecordParity',98),('ownPrefixRoutesHash','a'*64),('oldOrdinaryRecordFormsHash','a'*64),('ownCandidateIntentsHash','a'*64),('endResponsesObserved',1),('failedRoundsCredited',1)]:
   proof=copy.deepcopy(REG['proofs']['32497']);proof['dragonEndEvidence']['wiringEvidence'][k]=v
   with self.subTest(k=k),self.assertRaisesRegex(FieldError,'PROOF'):validate_proof(PLAN,proof)
  p=copy.deepcopy(policy());p['pickKeys'].append('ABPM')
  with patch('dragon_end_fields.policy',return_value=p),self.assertRaisesRegex(FieldError,'BINDING'):route({**PLAN,'dragonEndContractHash':digest(p)},raw())
