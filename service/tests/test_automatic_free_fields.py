import copy,json,pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from automatic_free_fields import CONTRACT,settled
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError,derive
REGISTRY=json.loads((pathlib.Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))
PLAN=REGISTRY['plans']['32500']
def sample(p=PLAN):
    steps=[];held=1000-p['betRaw']
    for i,(msg,nfg,win) in enumerate([('BET',2,0),('FREE_GAME',1,20),('FREE_GAME',0,50)]):
        fid=('1|0|' if i==1 else '0|') if p['gameId']==32486 else '1|'
        ab=held+win if i==2 else held
        q='&'.join(f'{k}={v}' for k,v in {**p['requestParams'],'PID':'gdmgcmoffline-automatic','MSGID':msg}.items())
        payload=f'MSGID={msg}&IFG={int(i>0)}&NFG={nfg}&FID={fid}&B={held+win}&AB={ab}&TW={win}'
        steps.append({'methodName':'processGameMessage','msgId':msg,'requestPayload':q,'responsePayload':payload,
            'responseXml':'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',
            'responseBalance':ab,'elapsedMs':0})
    return {'fixtureOnly':False,'protocol':'nextgen','sourceKey':p['sourceKey'],'roundFieldsVersion':'sg-round-fields-v1',
            'automaticFreeContract':CONTRACT,**({'balanceContract':p['balanceContract']} if p.get('balanceContract') else {}),
            'startBalanceRaw':1000,'steps':steps}
def change(raw,i,old,new):
    step=raw['steps'][i];step['responsePayload']=step['responsePayload'].replace(old,new)
    step['responseXml']='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+step['responsePayload'].replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'
    return raw
class AutomaticFreeTests(unittest.TestCase):
    def test_known_per_game_automatic_ids_route_to_original_free_request_and_complete(self):
        for p in [REGISTRY['plans'][g] for g in ['32486','32500','32501']]:
            a=NativeNextgenFields(p);r=sample(p)
            self.assertEqual(a.next_request({**r,'steps':[]}),{'MSGID':'BET'})
            self.assertEqual(a.next_request({**r,'steps':r['steps'][:1]}),{'MSGID':'FREE_GAME'})
            self.assertIsNone(a.next_request(r));f=a.settled(r)
            self.assertEqual(f['money']['betRaw'],p['betRaw']);self.assertEqual(f['bonus'],1)
            self.assertEqual(derive(r),f)
    def test_partial_feature_prefix_cannot_be_recorded_or_counted(self):
        r=sample();r['steps'].pop()
        self.assertEqual(NativeNextgenFields(PLAN).next_request(r),{'MSGID':'FREE_GAME'})
        with self.assertRaisesRegex(FieldError,'INCOMPLETE'):settled(r)
    def test_explicit_choice_unknown_ids_and_unsupported_terminal_id_are_rejected(self):
        for old,new in [('FID=1|','FID=2|'),('FID=1|','FID=1|&FS_1=0'),('FID=1|','FID=1|&NFR_1=1'),
                        ('FID=1|','FID=1|&CFG=1'),('FID=1|','FID=1|&ABPM=1')]:
            with self.assertRaisesRegex(FieldError,'FEATURE'):settled(change(sample(),0,old,new))
        p=REGISTRY['plans']['32486']
        with self.assertRaisesRegex(FieldError,'FEATURE'):settled(change(sample(p),2,'FID=0|','FID=1|0|'))
    def test_financial_fields_available_credit_and_observer_are_checked_on_every_frame(self):
        for r in [change(sample(),1,'B=920','B=921'),change(sample(),1,'AB=900','AB=920'),
                  change(sample(),2,'TW=50','TW=49')]:
            with self.assertRaisesRegex(FieldError,'MONEY'):settled(r)
        r=sample();r['steps'][1]['responseBalance']+=1
        with self.assertRaisesRegex(FieldError,'OBSERVER'):settled(r)
    def test_source_request_session_xml_and_pinned_plan_cannot_be_changed(self):
        r=sample();r['steps'][1]['requestPayload']+='&REC=1'
        with self.assertRaisesRegex(FieldError,'REQUEST_MODE'):settled(r)
        r=sample();r['steps'][1]['requestPayload']=r['steps'][1]['requestPayload'].replace('gdmgcmoffline-automatic','gdmgcmother')
        with self.assertRaisesRegex(FieldError,'SESSION'):settled(r)
        r=sample();r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace('TW=0','TW=1')
        with self.assertRaisesRegex(FieldError,'XML_EVIDENCE'):settled(r)
        with self.assertRaisesRegex(FieldError,'PLAN_BINDING'):NativeNextgenFields({**PLAN,'betRaw':101}).settled(sample())
    def test_unmarked_historical_feature_is_not_silently_approved_by_a_new_plan(self):
        r=sample();r.pop('automaticFreeContract');r.pop('balanceContract')
        with self.assertRaisesRegex(FieldError,'UNKNOWN_TRIAL_FEATURE'):NativeNextgenFields(PLAN).settled(r)
if __name__=='__main__':unittest.main()
