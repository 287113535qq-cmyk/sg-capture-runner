import copy,json,unittest
from pathlib import Path
from xml.sax.saxutils import escape
from explicit_request_dragon import CONTRACT,route,intent
from explicit_request_probe import route as old_route
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError
PLAN=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))['plans']['32497']
PID='gdmgcmoffline-python-dragon'
def sample():
    common={'B':'900','AB':'900','TW':'0','IFG':'0','SID':'offline-fixed','FRBAL':'0','GA':'0','GSD':'','VER':'1'}
    def frame(msg,p):
        q={**PLAN['requestParams'],'PID':PID,'MSGID':msg} if msg=='BET' else {'GN':PLAN['runtimeSlug'],'PID':PID,'MSGID':msg,'CFG':'0'}
        payload='&'.join(f'{k}={v}' for k,v in {**common,'MSGID':msg,**p}.items())
        return {'methodName':'processGameMessage','msgId':msg,'requestPayload':'&'.join(f'{k}={v}' for k,v in q.items()),'responsePayload':payload,'responseXml':'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+escape(payload)+'</PAYLOAD></GDMRESPONSE>','responseBalance':900,'elapsedMs':0}
    return {'fixtureOnly':False,'protocol':'nextgen','sourceKey':PLAN['sourceKey'],'roundFieldsVersion':'sg-round-fields-v1','explicitProbeContract':PLAN['explicitProbeContract'],'explicitDragonContract':CONTRACT,'startBalanceRaw':1000,
      'steps':[frame('BET',{'NFG':'0','FID':'0|','CFG':'0','FS_0':'0','NFR_0':'1','CFP_0':'0','FPM_0':'|','FTV_0':'0;1;1;1;|'}),frame('FEATURE_START',{'PD':'rid_100~0#stops_100~0,1,2,3,4,5,6#totalBet_100~100#va_100~'+('0,'*26)+'#'})]}
def alter(raw,key,value):
    s=raw['steps'][-1];p=dict(pair.split('=',1) for pair in s['responsePayload'].split('&'))
    if value is None:p.pop(key,None)
    else:p[key]=value
    s['responsePayload']='&'.join(f'{k}={v}' for k,v in p.items());s['responseXml']='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+escape(s['responsePayload'])+'</PAYLOAD></GDMRESPONSE>'
class ExplicitDragonTests(unittest.TestCase):
    def test_fixed_frontend_pick_and_trigger_route(self):
        self.assertEqual(route(PLAN,sample()),{'request':{'MSGID':'FEATURE_PICK','CFG':'0','FP':'0|1|1'},'options':[],'settlementApproved':False})
        raw=sample();raw['steps'].pop();self.assertEqual(route(PLAN,raw)['request']['MSGID'],'FEATURE_START')
    def test_start_missing_nfg_scope_and_pd_unknowns(self):
        for key,value in [('NFG','0'),('CFG','0'),('ABPM','0'),('PD',None),('PD','rid_100~0#'),('PD','rid_100~NaN#'),('PD',sample()['steps'][1]['responsePayload'].split('PD=')[1].replace('totalBet_100~100','totalBet_100~101'))]:
            raw=sample();alter(raw,key,value)
            with self.subTest(key=key),self.assertRaisesRegex(FieldError,'RESPONSE_REVIEW_REQUIRED'):route(PLAN,raw)
    def test_money_session_and_xml_remain_strict(self):
        for key,value in [('B','901'),('AB','899'),('TW','1'),('SID','other')]:
            raw=sample();alter(raw,key,value)
            with self.subTest(key=key),self.assertRaises(FieldError):route(PLAN,raw)
        raw=sample();raw['steps'][-1]['responseXml']=raw['steps'][-1]['responseXml'].replace('</GDMRESPONSE>','<ERROR>rejected</ERROR></GDMRESPONSE>')
        with self.assertRaisesRegex(FieldError,'XML_EVIDENCE'):route(PLAN,raw)
    def test_unknown_response_end_free_and_wrong_pick_refused(self):
        raw=sample();raw['steps'].append(copy.deepcopy(raw['steps'][-1]))
        with self.assertRaisesRegex(FieldError,'RESPONSE_REVIEW_REQUIRED'):route(PLAN,raw)
        for request in ['MSGID=FEATURE_PICK&CFG=0&FP=0|1|0','MSGID=FEATURE_END&CFG=0','MSGID=FREE_GAME']:
            with self.subTest(request=request),self.assertRaisesRegex(FieldError,'INTENT_CHANGED'):intent(PLAN,sample(),f'GN={PLAN["runtimeSlug"]}&PID={PID}&{request}')
    def test_old_marker_still_stops_and_no_special_credit(self):
        raw=sample()
        with self.assertRaisesRegex(FieldError,'INCOMPLETE_EXPLICIT_PROBE'):NativeNextgenFields(PLAN).settled(raw)
        del raw['explicitDragonContract']
        with self.assertRaisesRegex(FieldError,'EXPLICIT_PROBE_RESPONSE_REVIEW_REQUIRED'):old_route(PLAN,raw)
    def test_game_wager_contract_and_marker_boundaries(self):
        for key,value in [('gameId',32474),('betRaw',101),('runtimeGameId',33027),('explicitDragonContractHash','a'*64)]:
            with self.subTest(key=key),self.assertRaisesRegex(FieldError,'BINDING'):route({**PLAN,key:value},sample())
        raw=sample();raw['explicitDragonContract']='unknown'
        with self.assertRaisesRegex(FieldError,'PROFILE'):route(PLAN,raw)
