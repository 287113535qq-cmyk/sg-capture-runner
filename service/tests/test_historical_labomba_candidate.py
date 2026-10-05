"""Synthetic converter cases; no private historical raw or native credit."""
import copy,json,pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/runner-v2'))
from historical_labomba_business_candidate import candidate

class HistoricalLaBombaCandidateTests(unittest.TestCase):
 def setUp(self):
  m=json.loads((ROOT/'config/ag-historical-labomba-manifest.json').read_text(encoding='utf8'))
  self.p=m['plan'];self.b=m['binding']
  f={'sourceKey':self.p['sourceKey'],'typeMappingHash':self.b['typeMappingHash'],'roundFieldsVersion':'sg-round-fields-v1','bet':1.25,'mul':2,'buy':0,'bonus':0,'primaryBonusKind':'none',
   'money':{'startBalanceRaw':10000,'endBalanceRaw':10125,'betRaw':125,'totalWinRaw':250}}
  self.r={'_id':'a'*64,'contentHash':'b'*64,'fixtureOnly':False,'trialId':self.p['trialId'],'gameId':32723,'runtimeGameId':33123,'sequence':1968,'batchId':21,'shardId':18,
   'raw':{'fixtureOnly':False,'sourceKey':self.p['sourceKey'],'steps':[{'msgId':'BET','responseBalance':10125}]},'normalized':f,**{k:f[k] for k in ['bet','mul','buy','bonus','roundFieldsVersion']}}
 def test_historical_identity_and_money_are_preserved(self):
  before=copy.deepcopy(self.r);d=candidate(self.r,self.b,self.p)
  self.assertEqual(d['data']['captureSourceCampaignId'],'sg_round_one_20260928');self.assertEqual(d['data']['captureSequence'],1968)
  self.assertEqual(d['data']['captureNativeShardId'],18);self.assertEqual(d['data']['captureBatchId'],21)
  self.assertNotIn('captureWorkerIndex',d['data']);self.assertNotIn('captureCampaignId',d['data'])
  d['data']['steps'][0]['msgId']='mutated';self.assertEqual(self.r,before)
 def test_foreign_rolling_cash_type_and_shard_are_rejected(self):
  for alter in [lambda r:r.update(gameId=32731),lambda r:r['normalized'].update(primaryBonusKind='feature'),lambda r:r['normalized']['money'].update(endBalanceRaw=10126),lambda r:r.update(shardId=20)]:
   r=copy.deepcopy(self.r);alter(r)
   with self.assertRaises(AssertionError):candidate(r,self.b,self.p)
  with self.assertRaises(AssertionError):candidate(self.r,{**self.b,'queueId':'rolling'},self.p)
 def test_only_own_free_game_mapping_is_accepted(self):
  self.r['bonus']=self.r['normalized']['bonus']=1;self.r['normalized']['primaryBonusKind']='freeGame'
  self.assertEqual(candidate(self.r,self.b,self.p)['data']['specialKinds'],['freeGame'])
if __name__=='__main__':unittest.main()
