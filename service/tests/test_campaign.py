import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from campaign import Campaign, CONFIG
from native_nextgen_fields import NativeNextgenFields
from pool_plan import validate_pool_plan
from round_fields import FieldError,VERSION
from store import Rejected,canonical,digest
from work_pool import WorkPool


class CampaignTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.free=100*1024**3
        self.c=Campaign(self.temp.name,disk_free=lambda:self.free);self.addCleanup(self.c.close)
    def test_disabled_default_phase_two_forbidden_and_completed_game_skipped(self):
        self.assertEqual(self.c.select('runner')['action'],'stop')
        self.c.enable_by_operator();selected=self.c.select('runner')
        self.assertEqual(selected['action'],'capture');self.assertNotEqual(selected['plan']['gameId'],32471)
        self.assertEqual(selected['plan']['buy'],0)
        modified=copy.deepcopy(selected['plan']);modified['phase']=2
        with self.assertRaises(Rejected):validate_pool_plan(modified)
        with self.assertRaises(Rejected):self.c.dispatch({'schema':'sg-round-one-v1','trialId':self.c.config['campaignId'],'op':'enable'})
    def test_disk_reserve_stops_new_rounds_but_allows_settlement_then_requires_manual_review(self):
        self.c.enable_by_operator();self.free=29*1024**3
        self.assertFalse(self.c.allowed(new_round=True));self.assertTrue(self.c.allowed())
        self.assertEqual(self.c.select('runner')['action'],'stop')
        self.free=24*1024**3;self.assertFalse(self.c.allowed())
        self.free=100*1024**3
        with self.assertRaises(Rejected):self.c.enable_by_operator()
    def test_game_cannot_advance_without_full_audit_receipt(self):
        self.c.enable_by_operator();plan=self.c.select('runner')['plan']
        pool=WorkPool(Path(self.temp.name)/'trials'/plan['trialId'],plan['trialId'],plan['target'])
        lease=pool.register(0,'a'*64,'runner');batch=pool.take(lease)
        pool.db.execute('UPDATE batches SET end=?,completed=1 WHERE id=?',(plan['target'],batch['id']))
        pool.db.execute('UPDATE workers SET active_batch=NULL,lease_until=0')
        pool.close()
        self.assertEqual(self.c.select('auditor')['action'],'audit')
        self.assertEqual(self.c.select('peer')['action'],'wait')
        receipt=Path(self.temp.name)/'trials'/plan['trialId']/'campaign-audit.json'
        receipt.write_bytes(canonical({'planHash':digest(plan),'verifiedFileRounds':plan['target']}))
        next_plan=self.c.select('auditor')['plan'];self.assertNotEqual(next_plan['gameId'],plan['gameId'])
    def test_partial_batch_suspension_keeps_original_range_and_session(self):
        pool=WorkPool(Path(self.temp.name)/'test_pool','test_pool',400)
        self.addCleanup(pool.close);pool.enable_by_operator()
        old=pool.register(0,'a'*64,'old');batch=pool.take(old)
        pool.suspend_worker(old,{'status':'pending','pending':None,'journaled':5,'durable':5,'checkpoint':5})
        new=pool.register(0,'a'*64,'new');resumed=pool.take(new)
        self.assertEqual(batch['id'],resumed['id']);self.assertGreater(new['epoch'],old['epoch'])
        with self.assertRaises(Rejected):pool.register(0,'b'*64,'changed')
        with self.assertRaises(Rejected):pool.owned(old)


class NativeAdapterTests(unittest.TestCase):
    def setUp(self):
        self.plan=next(iter(json.loads((CONFIG/'round-one-plans.json').read_text(encoding='utf-8')).values()))
        self.adapter=NativeNextgenFields(self.plan)
    def step(self,msg,begin,end,win,remaining=0):
        request='&'.join(f'{k}={v}' for k,v in {**self.plan['requestParams'],'PID':'gdmgcmfixture','MSGID':msg}.items())
        payload=f'MSGID={msg}&B={end}&AB={end}&TW={win}&NFG={remaining}&IFG={int(msg=="FREE_GAME")}&FID=0|'
        import xml.etree.ElementTree as ET
        xml=ET.Element('GDMRESPONSE');ET.SubElement(xml,'SUCCESS').text='true';ET.SubElement(xml,'PAYLOAD').text=payload
        return {'msgId':msg,'requestPayload':request,'responsePayload':payload,'responseXml':ET.tostring(xml,encoding='unicode'),'elapsedMs':1}
    def test_native_free_big_round_settlement_and_mode_rejection(self):
        cost=self.plan['betRaw'];start=100000
        raw={'fixtureOnly':False,'protocol':'nextgen','sourceKey':self.plan['sourceKey'],'roundFieldsVersion':VERSION,
            'startBalanceRaw':start,'steps':[self.step('BET',start,start-cost,0,1),self.step('FREE_GAME',start-cost,start-cost+100,100)]}
        fields=self.adapter.settled(raw)
        self.assertEqual((fields['bet'],fields['mul'],fields['buy'],fields['bonus']),(cost/100,100/cost,0,1))
        raw['steps'][0]['requestPayload']+='&ABPM=1'
        with self.assertRaises(FieldError):self.adapter.settled(raw)
    def test_unknown_feature_and_unfinished_free_are_not_counted(self):
        step=self.step('BET',100000,100000-self.plan['betRaw'],0,1)
        raw={'fixtureOnly':False,'protocol':'nextgen','sourceKey':self.plan['sourceKey'],'roundFieldsVersion':VERSION,
            'startBalanceRaw':100000,'steps':[step]}
        with self.assertRaises(FieldError):self.adapter.settled(raw)
        step['responsePayload']=step['responsePayload'].replace('FID=0|','FID=9|')
        with self.assertRaises(FieldError):self.adapter.frame(step)

if __name__=='__main__':unittest.main()
