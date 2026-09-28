"""Synthetic protocol/settlement fixtures; these are never capture records."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'service'))
from huff_fields import HuffFields, SOURCE, EXTENSION
from round_fields import FieldError, VERSION, type_profile
from native_nextgen_fields import NativeNextgenFields
from trial_store import TrialStore
from test_trial import MemoryMongo

PLAN=json.loads((ROOT/'config/round-one-plans.json').read_text())['32714']


def exchange(msg, remaining=None, fid='', gsd='', win=0, **extra):
    request={**PLAN['requestParams'],'MSGID':msg,'PID':'gdmgcmhuff-fixture'}
    values={'MSGID':msg,'IFG':int(msg=='FREE_GAME'),'FID':fid,'GSD':gsd,
            'B':99500+win,'AB':99500+win,'TW':win}
    if remaining is not None:values.update(NFG=remaining,TFG=6,CFGG=6-remaining)
    values.update(extra)
    payload='&'.join(f'{k}={v}' for k,v in values.items())
    root=ET.Element('GDMRESPONSE');ET.SubElement(root,'SUCCESS').text='true';ET.SubElement(root,'PAYLOAD').text=payload
    return {'msgId':msg,'requestPayload':'&'.join(f'{k}={v}' for k,v in request.items()),
            'responsePayload':payload,'responseXml':ET.tostring(root,encoding='unicode'),'elapsedMs':1}


def raw(steps):
    return {'fixtureOnly':False,'protocol':'nextgen','sourceKey':SOURCE,'roundFieldsVersion':VERSION,
            'startBalanceRaw':100000,'steps':steps}


def sample(combined=False):
    steps=[exchange('BET',6,'1|0|' if combined else '1|')]
    steps += [exchange('FREE_GAME',n,'1|','FEAT~HARDHAT',win=(6-n)*100) for n in (5,4,3,2,1)]
    if combined:
        # Client's nested Money Mansion intro has no result yet: NFG alone
        # cannot close the round. The following result makes MMBG terminal.
        steps.append(exchange('FREE_GAME',0,'0|','FEAT~HARDHAT#PCFID~1|#MMBG~1',win=600))
        steps.append(exchange('FREE_GAME',0,'0|','FEAT~MMANSION#MMBG~1#MMW~1;8;-1;-1;10000',win=10600))
    else:steps.append(exchange('FREE_GAME',0,'1|','FEAT~HARDHAT',win=600))
    return raw(steps)


class HuffFieldsTests(unittest.TestCase):
    def setUp(self):self.adapter=HuffFields(PLAN)

    def test_hard_hat_and_nested_money_mansion_have_separate_types(self):
        for combined,bonus in [(False,2),(True,3)]:
            value=sample(combined)
            for n in range(1,len(value['steps'])):
                partial={**value,'steps':value['steps'][:n]}
                self.assertEqual(self.adapter.next_request(partial),{'MSGID':'FREE_GAME'})
                with self.assertRaises(FieldError):self.adapter.settled(partial)
            fields=self.adapter.settled(value)
            self.assertEqual(fields['bonus'],bonus)
            self.assertEqual(fields['money']['betRaw'],500)
            self.assertEqual(fields['typeMappingHash'],type_profile(EXTENSION)[1])
            self.assertIsNone(self.adapter.next_request(value))

    def test_base_and_old_fid_zero_normalization_remains_byte_equivalent(self):
        for value in [raw([exchange('BET')]), raw([exchange('BET',1,'0|',TFG=1,CFGG=0),
            exchange('FREE_GAME',0,'0|','FEAT~MMANSION#MMBG~1#MMW~1;8;-1;-1;10000',win=10000,TFG=1,CFGG=1)])]:
            self.assertEqual(self.adapter.settled(value),NativeNextgenFields(PLAN).settled(value))
            self.assertEqual(self.adapter.settled(value)['typeMappingHash'],type_profile(SOURCE)[1])

    def test_counters_can_increase_on_retrigger(self):
        value=sample();value['steps'].insert(1,exchange('FREE_GAME',6,'1|','FEAT~HARDHAT',TFG=7,CFGG=1))
        self.assertEqual(self.adapter.settled(value)['bonus'],2)

    def test_unreviewed_named_feature_is_still_rejected(self):
        for fid,gsd in [('2|',''),('1|','FEAT~PAINT'),('1|','PCFID~3|'),('9|','')]:
            with self.subTest(fid=fid,gsd=gsd),self.assertRaises(FieldError):
                self.adapter.next_request(raw([exchange('BET',6,fid,gsd)]))

    def test_changed_session_extra_bet_and_spin_after_settlement_rejected(self):
        for which in range(3):
            value=sample()
            if which==0:value['steps'][1]['requestPayload']=value['steps'][1]['requestPayload'].replace('gdmgcmhuff-fixture','gdmgcmother')
            elif which==1:value['steps'][1]=exchange('BET',5,'1|')
            else:value['steps'].append(exchange('FREE_GAME',0,'1|','FEAT~HARDHAT'))
            with self.assertRaises(FieldError):self.adapter.settled(value)

    def test_missing_counters_false_xml_and_wrong_stake_rejected(self):
        for which in range(4):
            value=sample()
            if which==0:value['steps'][-1]=exchange('FREE_GAME',None,'1|','FEAT~HARDHAT',win=600)
            elif which==1:value['steps'][-1]['responseXml']=value['steps'][-1]['responseXml'].replace('<SUCCESS>true','<SUCCESS>false')
            elif which==2:value['steps'][-1]=exchange('FREE_GAME',0,'1|','FEAT~HARDHAT',win=600,AB=100099)
            else:value['startBalanceRaw']+=1
            with self.assertRaises(FieldError):self.adapter.settled(value)

    def test_missing_hard_hat_replay_is_not_ordinary_free(self):
        value=raw([exchange('BET',1,'1|'),exchange('FREE_GAME',0,'0|','FEAT~MMANSION',win=100)])
        with self.assertRaisesRegex(FieldError,'HUFF_MISSING_HARD_HAT_REPLAY'):self.adapter.settled(value)
        value=sample();value['steps'][0]=exchange('BET',6,'1|0|')
        with self.assertRaisesRegex(FieldError,'HUFF_MISSING_MANSION_REPLAY'):self.adapter.settled(value)
        value=sample();value['steps'][-1]=exchange('FREE_GAME',0,'0|',win=600)
        self.assertEqual(self.adapter.settled(value)['bonus'],2)

    def test_successful_bet_is_resumed_after_reopening_without_another_bet(self):
        with tempfile.TemporaryDirectory() as directory:
            mongo=MemoryMongo();batch={'id':5,'worker':14,'start':401,'end':500}
            store=TrialStore(directory,mongo,plan=PLAN,batch=batch)
            base={'schema':PLAN['schema'],'trialId':PLAN['trialId']}
            def call(op,**data):return store.dispatch({**base,'op':op,**data})
            try:
                lease=call('claim',owner='huff-fixture',sessionHash='a'*64,commitSha='b'*40)
                owned={'owner':'huff-fixture','epoch':lease['epoch']}
                value=sample();steps=value['steps'];value={**value,'steps':[]}
                call('begin',**owned,sequence=401,attempt='00000000-0000-0000-0000-000000000401',
                     startBalanceRaw=100000,requestPayload=steps[0]['requestPayload'])
                value['steps'].append(steps[0]);call('exchange_journal',**owned,sequence=401,step=steps[0])
                saved=store.pending();store.close();store=TrialStore(directory,mongo,plan=PLAN,batch=batch)
                self.assertEqual(store.pending(),saved)
                self.assertEqual(store.field_next(saved['raw']),{'MSGID':'FREE_GAME'})
                for step in steps[1:]:
                    call('intent',**owned,sequence=401,requestPayload=step['requestPayload'])
                    value['steps'].append(step)
                    extra={'normalized':self.adapter.settled(value)} if step is steps[-1] else {}
                    call('exchange_journal',**owned,sequence=401,step=step,**extra)
                call('release',**owned)
                self.assertIsNone(store.pending());self.assertEqual(len(mongo.rows),1)
                record=next(iter(mongo.rows.values()))
                self.assertEqual(record['raw'],value);self.assertEqual(record['bonus'],2)
            finally:store.close()
