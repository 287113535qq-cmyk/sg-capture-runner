import copy,json,unittest
from pathlib import Path
from xml.sax.saxutils import escape
from explicit_request_continuation import CONTRACT,route,intent
from explicit_request_probe import route as old_route
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError

ROOT=Path(__file__).resolve().parents[2]
PLAN=json.loads((ROOT/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))['plans']['32474']
PID='gdmgcmoffline-python-continuation'
def sample(missing=False,picked=True):
    held=1000-PLAN['betRaw'];common={'B':str(held),'AB':str(held),'TW':'0','IFG':'0','SID':'offline-test','FRBAL':'0','GA':'0','GSD':'','VER':'1'}
    def frame(msg,reply,fp=None):
        q={**PLAN['requestParams'],'PID':PID,'MSGID':msg} if msg=='BET' else {'GN':PLAN['runtimeSlug'],'PID':PID,'MSGID':msg,'CFG':'1',**({'FP':fp} if fp else {})}
        payload='&'.join(f'{k}={v}' for k,v in {**common,'MSGID':msg,**reply}.items())
        return {'methodName':'processGameMessage','msgId':msg,'requestPayload':'&'.join(f'{k}={v}' for k,v in q.items()),'responsePayload':payload,'responseXml':'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+escape(payload)+'</PAYLOAD></GDMRESPONSE>','responseBalance':held,'elapsedMs':0}
    ftv='0;6;6;1;2;3;4;5;1;|'
    steps=[frame('BET',{'NFG':'3','FID':'1|0|','CFG':'1','FS_1':'0','NFR_1':'1','CFP_1':'0','FPM_1':'|','FTV_1':ftv}),frame('FEATURE_START',{} if missing else {'NFG':'3','TFG':'3','FGT':'3','FGTW':'0','CW':'0','CFGG':'0'})]
    if picked:steps.append(frame('FEATURE_PICK',{'NFG':'3','TFG':'3','FGT':'3','FGTW':'0','CW':'0','CFGG':'0','FID':'1|0|','CFG':'1','CFP_1':'1','CFR_1':'1','FS_1':'1','NFR_1':'1','FPM_1':'0;|','FTV_1':ftv},'1|1|0'))
    return {'fixtureOnly':False,'protocol':'nextgen','sourceKey':PLAN['sourceKey'],'roundFieldsVersion':'sg-round-fields-v1','explicitProbeContract':PLAN['explicitProbeContract'],'explicitContinuationContract':CONTRACT,'startBalanceRaw':1000,'steps':steps}
def alter(raw,key,value):
    step=raw['steps'][-1];p=dict(pair.split('=',1) for pair in step['responsePayload'].split('&'))
    if value is None:p.pop(key,None)
    else:p[key]=value
    step['responsePayload']='&'.join(f'{k}={v}' for k,v in p.items());step['responseXml']='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+escape(step['responsePayload'])+'</PAYLOAD></GDMRESPONSE>'
class ExplicitContinuationTests(unittest.TestCase):
    def test_known_start_shapes_and_next_pick(self):
        for missing in [False,True]:
            self.assertEqual(route(PLAN,sample(missing,False))['request']['FP'],'1|1|0')
            result=route(PLAN,sample(missing));self.assertEqual(result['request']['FP'],'1|2|1');self.assertEqual(len(result['options']),14)
            self.assertNotIn(0,[o['position'] for o in result['options']]);self.assertFalse(result['settlementApproved'])
    def test_missing_counter_has_exact_shape_boundary(self):
        for key,value in [('NFG','0'),('NFG','2'),('CFG','1'),('ABPM','0'),('B',None)]:
            raw=sample(True,False);alter(raw,key,value)
            with self.subTest(key=key),self.assertRaises(FieldError):route(PLAN,raw)
        raw=sample();alter(raw,'NFG',None)
        with self.assertRaises(FieldError):route(PLAN,raw)
    def test_counter_money_session_and_xml_errors_are_not_accepted(self):
        for key,value in [('CFP_1','2'),('FS_1','0'),('FID','2|'),('FTV_1','0;1;1;1;|'),('TW','1'),('SID','other')]:
            raw=sample();alter(raw,key,value)
            with self.subTest(key=key),self.assertRaises(FieldError):route(PLAN,raw)
        raw=sample();raw['steps'][-1]['responseXml']=raw['steps'][-1]['responseXml'].replace('</GDMRESPONSE>','<ERROR>rejected</ERROR></GDMRESPONSE>')
        with self.assertRaises(FieldError):route(PLAN,raw)
    def test_old_markers_keep_stops_and_neither_marker_can_credit_partial(self):
        for missing in [False,True]:
            raw=sample(missing,not missing)
            with self.assertRaisesRegex(FieldError,'INCOMPLETE_EXPLICIT_PROBE'):NativeNextgenFields(PLAN).settled(raw)
            del raw['explicitContinuationContract']
            with self.assertRaisesRegex(FieldError,'INVALID_MONEY_EVIDENCE' if missing else 'EXPLICIT_PROBE_RESPONSE_REVIEW_REQUIRED'):old_route(PLAN,raw)
    def test_second_response_end_free_or_repeated_position_are_unreviewed(self):
        raw=sample();raw['steps'].append(copy.deepcopy(raw['steps'][-1]))
        with self.assertRaisesRegex(FieldError,'RESPONSE_REVIEW_REQUIRED'):route(PLAN,raw)
        for fp in ['1|2|0','1|1|1','1|3|1','1|2|15']:
            with self.subTest(fp=fp),self.assertRaises(FieldError):intent(PLAN,sample(),f'GN={PLAN["runtimeSlug"]}&PID={PID}&MSGID=FEATURE_PICK&CFG=1&FP={fp}')
        for msg in ['FEATURE_END','FREE_GAME']:
            with self.subTest(msg=msg),self.assertRaises(FieldError):intent(PLAN,sample(),f'GN={PLAN["runtimeSlug"]}&PID={PID}&MSGID={msg}&CFG=1')
    def test_plan_contract_source_wager_and_raw_marker_binding(self):
        for key,value in [('betRaw',109),('sourceKey','foreign'),('explicitContinuationContractHash','a'*64)]:
            p={**PLAN,key:value}
            with self.subTest(key=key),self.assertRaisesRegex(FieldError,'BINDING'):route(p,sample())
        raw=sample();raw['explicitContinuationContract']='unknown'
        with self.assertRaisesRegex(FieldError,'PROFILE'):route(PLAN,raw)
