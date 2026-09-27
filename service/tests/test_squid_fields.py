import copy
import json
from pathlib import Path
import sys
import unittest
import tempfile
import xml.etree.ElementTree as ET
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from squid_fields import SquidFields, SOURCE, EXTENSION
from round_fields import VERSION, FieldError, type_profile
from trial_store import TrialStore
from store import digest, Rejected
from test_trial import MemoryMongo
from protocol_recovery import verify_pending

PLAN=json.loads((Path(__file__).resolve().parents[2]/'config/round-one-plans.json').read_text())['32651']


def exchange(msg, response, extra=None):
    p={**(PLAN['requestParams'] if msg in {'BET','FREE_GAME'} else {'GN':PLAN['runtimeSlug'],'CFG':'1'}),
       'PID':'gdmgcmfixture', 'MSGID':msg, **(extra or {})}
    payload='&'.join(f'{k}={v}' for k,v in {'MSGID':msg,'IFG':int(msg=='FREE_GAME'), **response}.items())
    root=ET.Element('GDMRESPONSE');ET.SubElement(root,'SUCCESS').text='true';ET.SubElement(root,'PAYLOAD').text=payload
    return {'msgId':msg,'requestPayload':'&'.join(f'{k}={v}' for k,v in p.items()),'responsePayload':payload,
            'responseXml':ET.tostring(root,encoding='unicode'),'elapsedMs':1}


def sample(combined=False):
    # Synthetic protocol test only, never a captured sample or production count.
    trigger={'B':98283,'AB':97783,'TW':500,'FID':'1|0|' if combined else '1|','CFG':1,
             'FS_1':0,'NFR_1':1,'FPM_1':'|','FTV_1':'2500;3;3;4;4;4;|'}
    if combined:trigger['NFG']=3
    balance={'B':98283,'AB':97783,'TW':500}
    steps=[exchange('BET',trigger),exchange('FEATURE_START',balance)]
    steps += [exchange('FEATURE_PICK',balance,{'FP':f'1|{i+1}|{i}'}) for i in range(3)]
    steps.append(exchange('FEATURE_END',{'B':100783,'AB':97783 if combined else 100783,'TW':3000,**({'NFG':3} if combined else {})}))
    if combined:
        steps += [exchange('FREE_GAME',{'B':100783,'AB':97783 if n else 100783,'TW':3000,'NFG':n,'FID':'0|'}) for n in [2,1,0]]
    return {'fixtureOnly':False,'protocol':'nextgen','sourceKey':SOURCE,'roundFieldsVersion':VERSION,'startBalanceRaw':97891,'steps':steps}


class SquidTests(unittest.TestCase):
    def setUp(self):self.adapter=SquidFields(PLAN)
    def test_feature_only_and_combined_settle_exact_cost_and_separate_bonus(self):
        for combined,bonus in [(False,2),(True,3)]:
            raw=sample(combined);fields=self.adapter.settled(raw)
            self.assertEqual(fields['money']['betRaw'],108);self.assertEqual(fields['money']['totalWinRaw'],3000)
            self.assertEqual(fields['bonus'],bonus);self.assertEqual(fields['typeMappingHash'],type_profile(EXTENSION)[1])
    def test_missing_start_tags_do_not_end_round_and_pick_numbers_are_one_based(self):
        raw=sample();raw['steps']=raw['steps'][:2]
        self.assertEqual(self.adapter.next_request(raw),{'MSGID':'FEATURE_PICK','CFG':'1','FP':'1|1|0'})
        with self.assertRaises(FieldError):self.adapter.settled(raw)
    def test_repeated_pick_wrong_round_or_early_end_rejected(self):
        for mutation in ['1|1|0','0|2|1','1|2|0']:
            raw=sample();raw['steps'][3]['requestPayload']=raw['steps'][3]['requestPayload'].replace('1|2|1',mutation)
            with self.assertRaises(FieldError):self.adapter.settled(raw)
        raw=sample();del raw['steps'][2:5]
        with self.assertRaises(FieldError):self.adapter.settled(raw)
    def test_changed_session_unknown_feature_and_final_money_mismatch_rejected(self):
        for kind in ['session','feature','balance']:
            raw=sample()
            if kind=='session':raw['steps'][1]['requestPayload']=raw['steps'][1]['requestPayload'].replace('gdmgcmfixture','gdmgcmother')
            elif kind=='feature':raw['steps'][0]=exchange('BET',{'B':98283,'AB':97783,'TW':500,'FID':'9|'})
            else:raw['steps'][-1]=exchange('FEATURE_END',{'B':100783,'AB':100782,'TW':3000})
            with self.assertRaises(FieldError):self.adapter.settled(raw)
    def test_native_only_hash_and_bonus_remain_compatible(self):
        raw=sample();raw['steps']=[exchange('BET',{'B':97783,'AB':97783,'TW':0,'FID':'0|'})]
        fields=self.adapter.settled(raw)
        self.assertEqual(fields['bonus'],0);self.assertEqual(fields['typeMappingHash'],type_profile(SOURCE)[1])

    def test_durable_intents_full_settlement_and_pending_recovery_guards(self):
        with tempfile.TemporaryDirectory() as directory:
            mongo=MemoryMongo();store=TrialStore(directory,mongo,plan=PLAN,batch={'id':5,'worker':14,'start':401,'end':500})
            try:
                base={'schema':PLAN['schema'],'trialId':PLAN['trialId']}
                def call(op,**data):return store.dispatch({**base,'op':op,**data})
                lease=call('claim',owner='fixture-owner',sessionHash='a'*64,commitSha='b'*40)
                owned={'owner':'fixture-owner','epoch':lease['epoch']}
                raw=sample();steps=raw['steps'];raw={**raw,'steps':[]}
                call('begin',**owned,sequence=401,attempt='00000000-0000-0000-0000-000000000401',
                     startBalanceRaw=raw['startBalanceRaw'],requestPayload=steps[0]['requestPayload'])
                for i,step in enumerate(steps):
                    if i:call('intent',**owned,sequence=401,requestPayload=step['requestPayload'])
                    raw['steps'].append(step)
                    extra={'normalized':self.adapter.settled(raw)} if i==len(steps)-1 else {}
                    result=call('exchange_journal',**owned,sequence=401,step=step,**extra)
                    if i==0:
                        expected={'rawHash':digest(raw),'expectedNext':'FEATURE_START'}
                        self.assertEqual(verify_pending(store,expected)['next']['MSGID'],'FEATURE_START')
                        with self.assertRaises(Rejected):verify_pending(store,{**expected,'rawHash':'0'*64})
                        store.db.execute("UPDATE pending SET awaiting='unknown-source-request'")
                        with self.assertRaises(Rejected):verify_pending(store,expected)
                        store.db.execute('UPDATE pending SET awaiting=NULL')
                    self.assertEqual(result['complete'],i==len(steps)-1)
                self.assertEqual(store.journaled(),401)
                call('release',**owned)
                self.assertEqual(len(mongo.rows),1)
                record=next(iter(mongo.rows.values()))
                self.assertEqual(record['bonus'],2);self.assertEqual(record['raw'],raw)
                self.assertEqual(store.state()['checkpoint'],401)
            finally:store.close()

if __name__=='__main__':unittest.main()
