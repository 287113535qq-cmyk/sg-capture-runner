import copy,json,pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from explicit_request_review import review_explicit_prefix,reviewed_pick_request
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError
REG=json.loads((pathlib.Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))
REG['plans']['32474']={k:v for k,v in REG['plans']['32474'].items() if k not in ('carnivalPickContract','carnivalPickContractHash')}

def frame(p,msg,reply):
    q={**p['requestParams'],'PID':'gdmgcmoffline-explicit','MSGID':msg} if msg=='BET' else {
        'GN':p['runtimeSlug'],'PID':'gdmgcmoffline-explicit','MSGID':msg,'CFG':'1' if p['gameId']==32474 else '0'}
    b=1000-p['betRaw'];payload=f'MSGID={msg}&B={b}&AB={b}&TW=0&IFG=0&{reply}'
    return {'methodName':'processGameMessage','msgId':msg,'requestPayload':'&'.join(f'{k}={v}' for k,v in q.items()),
            'responsePayload':payload,'responseBalance':b,'elapsedMs':0,
            'responseXml':'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'}
def sample(key='32474',start=False):
    p=REG['plans'][key];cfg='1' if key=='32474' else '0';fid='1|0|' if key=='32474' else '0|'
    raw={'fixtureOnly':False,'protocol':'nextgen','sourceKey':p['sourceKey'],'roundFieldsVersion':'sg-round-fields-v1',
         'startBalanceRaw':1000,'steps':[frame(p,'BET',f'NFG=3&FID={fid}&CFG={cfg}&FS_{cfg}=0&NFR_{cfg}=1&CFP_{cfg}=0&FPM_{cfg}=|&FTV_{cfg}=0;1;1;4;|')]}
    if start:raw['steps'].append(frame(p,'FEATURE_START','NFG=3'))
    return raw
def change(raw,i,old,new):
    s=raw['steps'][i];s['responsePayload']=s['responsePayload'].replace(old,new)
    s['responseXml']='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s['responsePayload'].replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'
    return raw
class ExplicitReviewTests(unittest.TestCase):
    def test_bounded_per_game_constructor_with_read_only_prefix_results(self):
        p=REG['plans']['32474'];r=review_explicit_prefix(p,sample('32474',True))
        self.assertTrue(r['diagnosticOnly']);self.assertFalse(r['settlementApproved']);self.assertEqual(r['sourceAllowance'],0)
        self.assertEqual(r['candidateRequest'],{'MSGID':'FEATURE_PICK','CFG':'1','FP':'1|1|0'})
        self.assertEqual([o['position'] for o in r['options']],list(range(15)))
        self.assertEqual(reviewed_pick_request(p,15,14)['FP'],'1|15|14')
        self.assertEqual(reviewed_pick_request(REG['plans']['32497'],1)['FP'],'0|1|1')
        for ordinal,position in [(0,0),(16,0),(1,-1),(1,15),(1,0.5)]:
            with self.assertRaisesRegex(FieldError,'EXPLICIT_PICK'):reviewed_pick_request(p,ordinal,position)
    def test_unreviewed_responses_and_feature_counters_remain_blocked(self):
        p=REG['plans']['32474']
        with self.assertRaisesRegex(FieldError,'UNREVIEWED'):review_explicit_prefix(REG['plans']['32497'],sample('32497',True))
        extra=sample('32474',True);extra['steps'].append(extra['steps'][1])
        with self.assertRaisesRegex(FieldError,'UNREVIEWED'):review_explicit_prefix(p,extra)
        for r in [change(sample(),0,'FS_1=0','FS_1=1'),change(sample(),0,'NFR_1=1','NFR_1=2'),
                  change(sample(),0,'CFG=1','CFG=2'),change(sample(),0,'FTV_1=0;1;1;4','FTV_1=0;2;1;4'),
                  change(sample('32474',True),1,'NFG=3','NFG=0')]:
            with self.assertRaisesRegex(FieldError,'EXPLICIT'):review_explicit_prefix(p,r)
    def test_scope_money_xml_observer_and_session_cannot_be_relaxed(self):
        p=REG['plans']['32474']
        with self.assertRaisesRegex(FieldError,'PLAN_BINDING'):review_explicit_prefix({**p,'betRaw':109},sample())
        r=sample('32474',True);r['steps'][1]['requestPayload']=r['steps'][1]['requestPayload'].replace('gdmgcmoffline-explicit','gdmgcmother')
        with self.assertRaisesRegex(FieldError,'SESSION'):review_explicit_prefix(p,r)
        with self.assertRaisesRegex(FieldError,'MONEY'):review_explicit_prefix(p,change(sample(),0,'B=892','B=893'))
        r=sample();r['steps'][0]['responseBalance']+=1
        with self.assertRaisesRegex(FieldError,'OBSERVER'):review_explicit_prefix(p,r)
        r=sample();r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace('TW=0','TW=1')
        with self.assertRaisesRegex(FieldError,'XML_EVIDENCE'):review_explicit_prefix(p,r)
    def test_review_results_do_not_authorize_old_next_and_settlement(self):
        p=REG['plans']['32474'];raw=sample('32474',True)
        self.assertFalse(review_explicit_prefix(p,raw)['settlementApproved'])
        with self.assertRaisesRegex(FieldError,'FEATURE|REQUEST_MODE'):NativeNextgenFields(p).next_request(raw)
        with self.assertRaisesRegex(FieldError,'FEATURE|REQUEST_MODE'):NativeNextgenFields(p).settled(raw)
if __name__=='__main__':unittest.main()
