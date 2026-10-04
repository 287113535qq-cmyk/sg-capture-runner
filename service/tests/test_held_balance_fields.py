import copy,json,pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from held_balance_fields import CONTRACT,settled
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError,validate,type_profile
from store import digest

PLAN=json.loads((pathlib.Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))['plans']['32500']


def sample(free=True):
    steps=[]
    for msg,nfg,win in ([('BET',2,0),('FREE_GAME',1,20),('FREE_GAME',0,50)] if free else [('BET',0,50)]):
        q='&'.join(f'{k}={v}' for k,v in {**PLAN['requestParams'],'PID':'gdmgcmoffline-held','MSGID':msg}.items())
        p=f'MSGID={msg}&IFG={int(msg=="FREE_GAME")}&NFG={nfg}&FID=0|&B={900+win}&AB=900&TW={win}'
        steps.append({'methodName':'processGameMessage','msgId':msg,'requestPayload':q,'responsePayload':p,
                      'responseXml':'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+p.replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',
                      'responseBalance':900,'elapsedMs':0})
    return {'fixtureOnly':False,'protocol':'nextgen','sourceKey':PLAN['sourceKey'],'roundFieldsVersion':'sg-round-fields-v1',
            'balanceContract':CONTRACT,'startBalanceRaw':1000,'steps':steps}


def response(raw,i,old,new):
    step=raw['steps'][i];step['responsePayload']=step['responsePayload'].replace(old,new)
    step['responseXml']='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+step['responsePayload'].replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'
    return raw


class HeldBalanceTests(unittest.TestCase):
    def test_paid_cost_cumulative_awards_and_terminal_state_reconcile_independently(self):
        raw=sample();f=NativeNextgenFields(PLAN).settled(raw)
        self.assertEqual(f['money'],dict(startBalanceRaw=1000,endBalanceRaw=950,totalWinRaw=50,betRaw=100))
        self.assertEqual(f['bonus'],1);self.assertEqual(f['mul'],.5)
        self.assertEqual(validate(raw,f)['bet'],1.0)
        self.assertEqual(NativeNextgenFields(PLAN).settled(sample(False))['bonus'],0)

    def test_each_cash_field_and_cumulative_award_are_required(self):
        cases=[response(sample(),1,'AB=900','AB=901'),response(sample(),1,'B=920','B=921'),
               response(sample(),2,'B=950&AB=900&TW=50','B=910&AB=900&TW=10')]
        wrong=sample();wrong['steps'][1]['responseBalance']=901;cases.append(wrong)
        for raw in cases:
            with self.subTest(rawHash=digest(raw)),self.assertRaises(FieldError):settled(raw)

    def test_unfinished_feature_or_extra_paid_round_cannot_be_counted(self):
        raw=sample();raw['steps'].pop()
        with self.assertRaisesRegex(FieldError,'INCOMPLETE'):settled(raw)
        raw=sample();raw['steps'][1]['msgId']='BET'
        with self.assertRaises(FieldError):settled(raw)
        raw=sample(False);raw['steps'].append(copy.deepcopy(raw['steps'][0]))
        with self.assertRaises(FieldError):settled(raw)

    def test_unknown_feature_identity_mode_and_changed_session_still_fail(self):
        cases=[response(sample(),0,'FID=0|','FID=1|'),response(sample(),0,'FID=0|','FID=0|&FS_0=1'),
               response(sample(),0,'FID=0|','FID=0|&CFG=0'),response(sample(),0,'FID=0|','FID=0|&GSD=#lives~1')]
        raw=sample();raw['steps'][1]['requestPayload']=raw['steps'][1]['requestPayload'].replace('gdmgcmoffline-held','gdmgcmother');cases.append(raw)
        for raw in cases:
            with self.assertRaises(FieldError):settled(raw)

    def test_contract_requires_evidenced_source_and_exact_plan_binding(self):
        raw=sample();raw['sourceKey']='other'
        with self.assertRaisesRegex(FieldError,'SOURCE_NOT_REVIEWED'):settled(raw)
        for key,value in [('betRaw',101),('balanceContractHash','f'*64),('balanceContract','unknown')]:
            p={**PLAN,key:value}
            with self.assertRaisesRegex(FieldError,'PLAN_BINDING'):NativeNextgenFields(p).settled(sample())

    def test_previously_accepted_unmarked_record_and_mapping_hash_remain_identical(self):
        raw=sample(False);raw.pop('balanceContract');response(raw,0,'AB=900','AB=950');raw['steps'][0]['responseBalance']=950
        legacy={k:v for k,v in PLAN.items() if k not in ('balanceContract','balanceContractHash')}
        before=NativeNextgenFields(legacy).settled(raw);after=NativeNextgenFields(PLAN).settled(raw)
        self.assertEqual(before,after);self.assertEqual(digest(before),digest(after))
        self.assertEqual(after['typeMappingHash'],type_profile(PLAN['sourceKey'])[1])


if __name__=='__main__':unittest.main()
