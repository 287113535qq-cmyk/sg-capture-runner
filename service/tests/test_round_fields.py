import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from round_fields import derive, FieldError
from store import Store, Rejected, InjectedCrash, SCHEMA
from test_store import MemoryMongo

SAMPLES = json.loads((Path(__file__).resolve().parents[2] / 'fixtures/round-fields.json').read_text())['samples']

class FieldTests(unittest.TestCase):
    def test_all_protocol_samples_and_independent_buy_bonus(self):
        for sample in SAMPLES:
            with self.subTest(sample=sample['id']):
                fields = derive(sample['raw'])
                self.assertEqual({key:fields[key] for key in sample['expected']}, sample['expected'])
        natural = derive(next(s['raw'] for s in SAMPLES if s['id'] == 'ng-natural-free'))
        self.assertEqual((natural['buy'], natural['bonus']), (0, 2))
        feature = derive(next(s['raw'] for s in SAMPLES if s['id'] == 'ng-feature-only'))
        self.assertEqual(feature['bonus'], 0)

    def test_ambiguous_missing_and_unsettled_money_rejected(self):
        original = SAMPLES[0]['raw']
        cases = []
        for start in [99875, 99874, -1, True, 1.25, 9007199254740992]:
            raw=copy.deepcopy(original);raw['startBalanceRaw']=start;cases.append(raw)
        for value in ['NaN', '', '-1', '0.5', '9007199254740992']:
            raw=copy.deepcopy(original);raw['steps'][0]['responsePayload']=raw['steps'][0]['responsePayload'].replace('TW=0','TW='+value);cases.append(raw)
        for suffix in ['&TW=10', '&NFR_1=1']:
            raw=copy.deepcopy(original);raw['steps'][0]['responsePayload']+=suffix;cases.append(raw)
        raw=copy.deepcopy(original);raw['steps'][0]['responsePayload']=raw['steps'][0]['responsePayload'].replace('AB=99875','AB=99876');cases.append(raw)
        for raw in cases:
            with self.assertRaises(FieldError):derive(raw)

    def test_unknown_game_mode_or_free_type_never_defaults_to_zero(self):
        for field,value in [('sourceKey','unreviewed-real-game'),('sourceKey','missing-profile')]:
            raw=copy.deepcopy(SAMPLES[0]['raw']);raw[field]=value
            with self.assertRaisesRegex(FieldError,'TYPE_MAPPING_REQUIRED'):derive(raw)
        raw=copy.deepcopy(SAMPLES[0]['raw']);raw['steps'][0]['requestPayload']+='&ABPM=999'
        with self.assertRaisesRegex(FieldError,'BUY_MAPPING_REQUIRED'):derive(raw)
        raw=copy.deepcopy(SAMPLES[2]['raw']);raw['steps'][-1]['responsePayload']=raw['steps'][-1]['responsePayload'].replace('CFG=2','CFG=99')
        with self.assertRaisesRegex(FieldError,'FREE_TYPE_MAPPING_REQUIRED'):derive(raw)
        raw=copy.deepcopy(SAMPLES[0]['raw']);raw['fixtureOnly']=False
        with self.assertRaisesRegex(FieldError,'FIXTURE_TYPE_PROFILE_ONLY'):derive(raw)

    def test_wms_endgame_continuations_and_aggregation_are_required(self):
        original=next(s['raw'] for s in SAMPLES if s['id']=='wms-free-feature')
        cases=[]
        raw=copy.deepcopy(original);raw['steps'].pop();cases.append(raw)
        raw=copy.deepcopy(original);raw['steps'].pop(1);cases.append(raw)
        raw=copy.deepcopy(original);raw['winAggregation']='cumulative';cases.append(raw)
        raw=copy.deepcopy(original);raw['steps'][1]['responsePayload']=raw['steps'][1]['responsePayload'].replace('hnsSpinsRemaining="0"','hnsSpinsRemaining="1"');cases.append(raw)
        raw=copy.deepcopy(original);raw['steps'][1]['responsePayload']=raw['steps'][1]['responsePayload'].replace('stake="0"','stake="300"');cases.append(raw)
        raw=copy.deepcopy(original);raw['startBalanceRaw']+=1;cases.append(raw)
        raw=copy.deepcopy(original);raw['steps'][1]['responsePayload']='<!DOCTYPE x [<!ENTITY y "x">]>'+raw['steps'][1]['responsePayload'];cases.append(raw)
        for raw in cases:
            with self.assertRaises(FieldError):derive(raw)

class FieldStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='sg-field-test-')
        self.root=Path(self.temp.name).resolve()
        self.assertEqual(self.root.parent,Path(tempfile.gettempdir()).resolve())
        self.mongo=MemoryMongo();self.store=Store(self.root,self.mongo)
        self.case='fixture_fields_unit'
        self.call('initialize',games=[{'gameId':'fixture-one','target':1}])
        lease=self.call('claim',gameId='fixture-one',owner='field-worker')
        self.owned={'gameId':'fixture-one','owner':'field-worker','epoch':lease['epoch']}
    def tearDown(self):
        self.assertEqual(self.root.parent,Path(tempfile.gettempdir()).resolve())
        self.assertTrue(self.root.name.startswith('sg-field-test-'))
        self.temp.cleanup()
    def call(self,op,**kw):return self.store.dispatch({'schema':SCHEMA,'caseId':self.case,'op':op,**kw})
    def value(self,sample=None):
        raw=copy.deepcopy((sample or SAMPLES[2])['raw'])
        return {'sequence':1,'sourceRoundId':'fixture-one:round:1','raw':raw,
                'normalized':{'fixtureOnly':True,'gameKey':'fixture-one','sequence':1,**derive(raw)}}
    def test_four_business_fields_reach_top_level_mongo_files_and_acceptance(self):
        value=self.value();self.call('commit',**self.owned,round=value)
        record=next(iter(self.mongo.data.values()))
        for key in ('bet','mul','buy','bonus'):self.assertEqual(record[key],value['normalized'][key])
        self.call('release',**self.owned,status='complete')
        self.assertEqual(self.call('verify')['businessFieldsVerified'],1)
        self.assertEqual(self.call('promote')['inserted'],1)
        self.assertEqual(self.call('promote')['inserted'],0)
        self.assertEqual(self.mongo.data,self.mongo.accepted)
    def test_tampered_fields_rejected_before_any_persistence(self):
        for field in ('bet','mul','buy','bonus','primaryBonusKind','typeMappingHash'):
            value=self.value();value['normalized'][field]=99
            with self.assertRaisesRegex(Rejected,'ROUND_FIELDS_MISMATCH'):self.call('commit',**self.owned,round=value)
        for field in ('buy','bonus'):
            value=self.value();value['normalized'][field]=True
            with self.assertRaisesRegex(Rejected,'ROUND_FIELDS_MISMATCH'):self.call('commit',**self.owned,round=value)
        self.assertEqual(self.call('status')['tasks'][0]['checkpoint'],0)
        self.assertEqual(self.call('status')['receipts'],{})
        self.assertEqual(self.mongo.data,{})
    def test_fields_profile_cannot_be_downgraded_to_transport_only(self):
        value=self.value();value['raw']={'fixtureOnly':True};value['normalized']={'fixtureOnly':True,'gameKey':'fixture-one','sequence':1}
        with self.assertRaisesRegex(Rejected,'ROUND_FIELDS_VERSION_REQUIRED'):self.call('commit',**self.owned,round=value)
    def test_unknown_free_type_does_not_save_an_ordinary_record(self):
        value=self.value();value['raw']['steps'][-1]['responsePayload']=value['raw']['steps'][-1]['responsePayload'].replace('CFG=2','CFG=99')
        with self.assertRaisesRegex(Rejected,'FREE_TYPE_MAPPING_REQUIRED'):self.call('commit',**self.owned,round=value)
        self.assertEqual(self.call('status')['receipts'],{})
    def test_fields_survive_mongo_crash_recovery_and_duplicate(self):
        value=self.value()
        with self.assertRaises(InjectedCrash):self.call('commit',**self.owned,round=value,failpoint='after_mongo')
        self.store=Store(self.root,self.mongo)
        result=self.call('commit',**self.owned,round=value)
        self.assertEqual(result['mongoInserted'],0);self.assertEqual(result['recovered'],1)
        self.assertEqual(self.call('verify')['businessFieldsVerified'],1)
        self.assertEqual(self.call('commit',**self.owned,round=value)['mongoInserted'],0)

if __name__=='__main__':unittest.main()
