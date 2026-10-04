import copy,json,pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError,derive
from zero_abpm_fields import CONTRACT
ROOT=pathlib.Path(__file__).resolve().parents[2]
REG=json.loads((ROOT/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))
def sample(p):
    end=10000-p['betRaw']+25;text=f'MSGID=BET&IFG=0&ABPM=0&B={end}&AB={end}&TW=25'
    q={**p['requestParams'],'PID':'gdmgcmoffline-zero-abpm','MSGID':'BET'}
    return {'fixtureOnly':False,'protocol':'nextgen','sourceKey':p['sourceKey'],'roundFieldsVersion':'sg-round-fields-v1',
            'zeroAbpmContract':CONTRACT,'startBalanceRaw':10000,'steps':[{'methodName':'processGameMessage','msgId':'BET',
             'requestPayload':'&'.join(k+'='+v for k,v in q.items()),'responsePayload':text,
             'responseXml':'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+text.replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',
             'responseBalance':end,'elapsedMs':0}]}
class ZeroAbpmTests(unittest.TestCase):
    def test_two_base_money_and_mapping(self):
        for key in ('32588','32666'):
            p=REG['plans'][key];r=sample(p);a=NativeNextgenFields(p)
            self.assertEqual(a.next_request({**r,'steps':[]}),{'MSGID':'BET'});self.assertIsNone(a.next_request(r))
            self.assertEqual(a.settled(r),derive(r));self.assertEqual(a.settled(r)['money']['betRaw'],p['betRaw'])
    def test_feature_and_nonzero_mode_not_admitted(self):
        p=REG['plans']['32666'];a=NativeNextgenFields(p)
        for replacement in ('ABPM=1','ABPM=15','ABPM=0&FID=1|','ABPM=0&NFG=1','ABPM=0&CFG=1','ABPM=0&FS_1=0'):
            r=sample(p);s=r['steps'][0];s['responsePayload']=s['responsePayload'].replace('ABPM=0',replacement)
            with self.assertRaisesRegex(FieldError,'UNKNOWN_TRIAL_FEATURE'):a.next_request(r)
        r=sample(p);r['steps'].append(copy.deepcopy(r['steps'][0]))
        with self.assertRaisesRegex(FieldError,'BASE_ONLY'):a.settled(r)
    def test_source_marker_money_and_incomplete_are_enforced(self):
        p=REG['plans']['32588'];a=NativeNextgenFields(p);r=sample(p)
        for other in ({**r,'zeroAbpmContract':None},sample(REG['plans']['32666'])):
            with self.assertRaisesRegex(FieldError,'PROFILE'):a.next_request(other)
        r['steps'][0]['responseBalance']+=1
        with self.assertRaisesRegex(FieldError,'MONEY'):a.settled(r)
        with self.assertRaisesRegex(FieldError,'INCOMPLETE'):a.settled({**sample(p),'steps':[]})
    def test_unmarked_existing_games_still_reject_response_mode(self):
        p=REG['plans']['32441'];r=sample(p);r.pop('zeroAbpmContract')
        with self.assertRaisesRegex(FieldError,'UNKNOWN_TRIAL_FEATURE'):NativeNextgenFields(p).next_request(r)
