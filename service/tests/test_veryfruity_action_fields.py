import copy, unittest
import xml.etree.ElementTree as E
from round_fields import FieldError
from veryfruity_action_fields import VeryFruityActionFields, CONTRACT_HASH, SOURCE, ACTION_VERSION
from test_veryfruity_cash_review import sample, HEADER


def fixture():
    header = HEADER | {'gameCodeRGI':'veryfruity', 'gameID':'20206', 'versionID':'1_0'}
    plan = {'gameId':32812, 'runtimeGameId':33172, 'sourceKey':SOURCE, 'adapter':SOURCE,
            'featureProfile':ACTION_VERSION, 'actionContractHash':CONTRACT_HASH,
            'requestHeader':header, 'betRaw':20, 'buy':0, 'mode':'demo'}
    raw = sample(20) | {'sourceKey':SOURCE,'protocol':'wms','fixtureOnly':False,
                       'roundFieldsVersion':'sg-round-fields-v1','requestFlowVersion':ACTION_VERSION,
                       'actionContractHash':CONTRACT_HASH}
    for s in raw['steps']:
        for key in ('requestPayload','responsePayload','responseXml'):
            s[key] = s[key].replace('gameCodeRGI="FIXTURE"','gameCodeRGI="veryfruity"').replace(
                'gameID="FIXTURE"','gameID="20206"').replace('versionID="FIXTURE"','versionID="1_0"')
    return plan, raw


class VeryFruityEvidenceTests(unittest.TestCase):
    def test_init_checks_advertised_wager_and_preserves_original_xml(self):
        plan,raw=fixture();adapter=VeryFruityActionFields(plan)
        q=E.Element('GameRequest',type='Init');E.SubElement(q,'Header',plan['requestHeader']|{'sessionID':'new'})
        r=E.Element('GameResponse',type='Init')
        E.SubElement(r,'Header',gameID='20206',versionID='1_0',ccyCode='',lang='en_US',isRecovering='N',sessionID='next')
        b=E.SubElement(r,'Balances');E.SubElement(b,'Balance',name='CASH_BALANCE',value='1000')
        E.SubElement(r,'Stakes',count='15',defaultIndex='3',type='0').text='20|40|80|100|200|400|500|1000|2000|4000|5000|10000|20000|40000|50000'
        E.SubElement(r,'AccountData')
        lines=E.SubElement(E.SubElement(r,'Paylines',gameMode='0'),'PaylineInfo',paylineCount='20',default='19')
        for i in range(20):E.SubElement(lines,'Payline',index=str(i),selectable='Y' if i==19 else 'N')
        text=E.tostring(r,encoding='unicode')
        step={'msgId':'Init','requestPayload':E.tostring(q,encoding='unicode'),'responsePayload':text,'responseXml':text,'responseBalance':1000}
        self.assertEqual(adapter.bootstrap(step),{'validated':True})
        for bad in (text.replace('20|40|','1|40|'),text.replace('count="15"','count="14"'),text.replace('defaultIndex="3"','defaultIndex="15"'),text.replace('<AccountData />','<AccountData><CurrencyInformation/></AccountData>'),text.replace('<AccountData />','<AccountData><CurrencyInformation><CurrencyMultiplier>2</CurrencyMultiplier></CurrencyInformation></AccountData>'),text.replace('value="1000"','value="999"'),text.replace('isRecovering="N"','isRecovering="Y"'),text.replace('</GameResponse>','<Recovery/></GameResponse>')):
            with self.assertRaises(FieldError):adapter.bootstrap({**step,'responseXml':bad,'responsePayload':bad})

    def test_original_xml_round_only_completes_after_ack_and_preserves_pending_classification(self):
        plan,raw=fixture(); before=copy.deepcopy(raw); adapter=VeryFruityActionFields(plan)
        empty={**raw,'steps':[]}
        self.assertEqual(adapter.next_request(empty), {'MSGID':'Logic'})
        self.assertEqual(adapter.validate_intent(empty,raw['steps'][0]['requestPayload']),{'validated':True})
        prefix={**raw,'steps':raw['steps'][:1]}
        self.assertEqual(adapter.next_request(prefix),{'MSGID':'EndGame'})
        with self.assertRaisesRegex(FieldError,'INCOMPLETE'):adapter.settled(prefix)
        self.assertEqual(adapter.next_request(raw),None)
        fields=adapter.settled(raw)
        self.assertEqual(fields['money'],{'startBalanceRaw':1000,'endBalanceRaw':1000,'totalWinRaw':20,'betRaw':20})
        self.assertIsNone(fields['bonus']);self.assertEqual(fields['classificationStatus'],'pending')
        self.assertEqual(raw,before)

    def test_wrong_intent_cannot_debit_or_end_early_and_cached_balance_cannot_forge_proof(self):
        plan,raw=fixture();adapter=VeryFruityActionFields(plan);empty={**raw,'steps':[]}
        for payload in [raw['steps'][1]['requestPayload'],raw['steps'][0]['requestPayload'].replace('total="20"','total="40"')]:
            with self.assertRaises(FieldError):adapter.validate_intent(empty,payload)
        for change in ({'actionContractHash':'a'*64},{'fixtureOnly':True},{'protocol':'nextgen'}):
            with self.assertRaises(FieldError):adapter.settled({**raw,**change})
        r=copy.deepcopy(raw);r['steps'][0]['responseBalance']=999
        with self.assertRaises(FieldError):adapter.settled(r)
        with self.assertRaises(FieldError):VeryFruityActionFields({**plan,'requestHeader':{**plan['requestHeader'],'gameID':'20327'}})


if __name__=='__main__':unittest.main()
