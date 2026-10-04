import copy,json,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from carnival_pick_fields import CONTRACT,route,intent,validate_proof,previous,policy
from native_nextgen_fields import NativeNextgenFields
from explicit_request_continuation import route as old_route
from round_fields import FieldError
from store import digest
from test_explicit_request_continuation import sample,alter,PID
ROOT=Path(__file__).resolve().parents[2]
REG=json.loads((ROOT/'config/ag-rolling-plans.json').read_text(encoding='utf-8'));PLAN=REG['plans']['32474']
def raw(position=0,missing=False,second=False):
    r=sample();r['carnivalPickContract']=CONTRACT
    r['steps'][2]['requestPayload']=r['steps'][2]['requestPayload'].replace('1|1|0',f'1|1|{position}')
    alter(r,'FPM_1',f'{position};|')
    if missing:
        for k in ('NFG','TFG','FGT','CFGG','CW','FGTW'):alter(r,k,None)
        alter(r,'FID','1|')
    if second:
        r['steps'].append(copy.deepcopy(r['steps'][-1]));r['steps'][-1]['requestPayload']=r['steps'][-1]['requestPayload'].replace(f'1|1|{position}','1|2|1')
        for k,v in {'FPM_1':'0;1;|','CFP_1':'2','CFR_1':'2'}.items():alter(r,k,v)
    for s in r['steps']:s['responseXml']=s['responseXml'].replace('<GDMRESPONSE>','<GDMRESPONSE><OGS_RC>0</OGS_RC>')
    return r
class CarnivalPickTests(unittest.TestCase):
    def test_own_first_positions_and_second_pair(self):
        for position in (0,1):
            for missing in (False,True):
                result=route(PLAN,raw(position,missing));self.assertEqual(len(result['options']),14);self.assertNotIn(position,[o['position'] for o in result['options']])
        r=route(PLAN,raw(second=True));self.assertEqual(r['request']['FP'],'1|3|2');self.assertEqual(len(r['options']),13)
        with self.assertRaises(FieldError):route(PLAN,raw(position=2))
        with self.assertRaises(FieldError):route(PLAN,raw(position=1,second=True))
    def test_missing_counter_and_money_shape_is_exact(self):
        for k,v in [('NFG','3'),('ABPM','0'),('FID','1|0|'),('TW','1'),('SID','other'),('CFP_1','2')]:
            r=raw(missing=True);alter(r,k,v)
            with self.subTest(k=k),self.assertRaises(FieldError):route(PLAN,r)
        for k,v in [('CFGG','1'),('CFR_1','3'),('FTV_1','0;1;1;1;|')]:
            r=raw(second=True);alter(r,k,v)
            with self.subTest(k=k),self.assertRaises(FieldError):route(PLAN,r)
    def test_old_v2_and_all_special_settlement_still_reject(self):
        r=raw(position=1);del r['carnivalPickContract']
        with self.assertRaisesRegex(FieldError,'EXPLICIT_CONTINUATION_REQUEST'):old_route(previous(PLAN),r)
        with self.assertRaisesRegex(FieldError,'INCOMPLETE_EXPLICIT_PROBE'):NativeNextgenFields(PLAN).settled(r)
        with self.assertRaisesRegex(FieldError,'INCOMPLETE_CARNIVAL_PICK'):NativeNextgenFields(PLAN).settled(raw(second=True))
    def test_intent_excludes_repeats_wrong_ordinal_end_and_free(self):
        r=raw(second=True);prefix=f'GN={PLAN["runtimeSlug"]}&PID={PID}&MSGID=FEATURE_PICK&CFG=1&FP='
        for position in range(2,15):self.assertEqual(intent(PLAN,r,prefix+f'1|3|{position}'),{'validated':True})
        for fp in ('1|3|0','1|3|1','1|2|2','1|4|2','1|3|15'):
            with self.subTest(fp=fp),self.assertRaises(FieldError):intent(PLAN,r,prefix+fp)
        for msg in ('FEATURE_END','FREE_GAME'):
            with self.assertRaises(FieldError):intent(PLAN,r,f'GN={PLAN["runtimeSlug"]}&PID={PID}&MSGID={msg}&CFG=1')
    def test_unknown_response_and_xml_error_cannot_advance(self):
        r=raw(second=True);r['steps'].append(copy.deepcopy(r['steps'][-1]))
        with self.assertRaisesRegex(FieldError,'REVIEW_REQUIRED'):route(PLAN,r)
        for tag in ('<OGS_RC>1</OGS_RC>','<ERROR>rejected</ERROR>'):
            r=raw();r['steps'][-1]['responseXml']=r['steps'][-1]['responseXml'].replace('<OGS_RC>0</OGS_RC>',tag)
            with self.assertRaisesRegex(FieldError,'XML'):route(PLAN,r)
    def test_re_signed_policy_proof_hashes_cannot_hide_changed_evidence(self):
        proof=REG['proofs']['32474'];self.assertTrue(validate_proof(PLAN,proof))
        for k,v in [('ownPrefixRoutesHash','f'*64),('oldAcceptedRecordParity',99),('failedRoundsCredited',1)]:
            bad=copy.deepcopy(proof);bad['carnivalPickEvidence']['wiringEvidence'][k]=v
            with self.subTest(k=k),self.assertRaisesRegex(FieldError,'PROOF'):validate_proof(PLAN,bad)
        bad_policy=copy.deepcopy(policy());bad_policy['pickKeys']['withoutNfg'].append('ABPM')
        with patch('carnival_pick_fields.policy',return_value=bad_policy),self.assertRaisesRegex(FieldError,'BINDING'):
            route({**PLAN,'carnivalPickContractHash':digest(bad_policy)},raw())
