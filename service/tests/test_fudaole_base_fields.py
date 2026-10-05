import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fudaole_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="fudaole" gameID="20135" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+H.format(session)+('<WagerInfo totalStake="200" featureBet="0"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>' if first else '')+'</GameRequest>'
def text(msg,session,cash,body=''):
 a='<AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData>' if msg=='Logic' else '<AccountData/>'
 return f'<GameResponse type="{msg}"><Header gameID="20135" versionID="1_0" isRecovering="N" sessionID="{session}"/>{a}<Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'
G='<GameResult totalStake="200" waysCount="243" totalWin="25" betID=""><MysteryRepSymbol isNudgingWild="N" isRedEnvlpJkpt="N" isSymPresent="N" replacementSymbolIndex="0"/><ReelResults numSpins="1"><ReelSpin reelsetIndex="0" anywayWinCount="1" scatterWinCount="0" totalWayWin="25" totalScatterWin="0" totalSpinWin="25" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><AnywayWin winIndex="0" winVal="25" ways="1" awardIndex="0">0|11|12</AnywayWin></ReelSpin></ReelResults><GameWinInfo totalWagerWin="25" totalBaseGameWin="25" totalFreeSpinsWin="0" totalPickJkptWin="0" maxWinValue="25000000" isMaxWin="N"/><GameRtpInfo targetedRtpValue="96.06"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,
 steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',825,G),825),step('EndGame',payload('EndGame','paid'),text('EndGame','end',825),825)])

class FuDaoLeBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(2,25/200,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32769'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',201),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20135)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_cumulative_and_anyway_sum_are_all_required(self):
  for a,b in [('winVal="25"', 'winVal="26"'), ('totalBaseGameWin="25"', 'totalBaseGameWin="26"'), ('totalWayWin="25"', 'totalWayWin="26"')]:
   r=raw();s=r['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  r=raw();r['steps'][0]['responseBalance']+=1
  with self.assertRaises(FieldError):review(r)
 def test_partial_early_end_and_session_rotation_rejected(self):
  r=raw()
  with self.assertRaises(FieldError):settled({**r,'steps':r['steps'][:1]},mapping_hash())
  with self.assertRaises(FieldError):review({**r,'steps':[r['steps'][1]]})
  with self.assertRaises(FieldError):review({**r,'steps':r['steps']+[r['steps'][1]]})
  altered=copy.deepcopy(r);altered['steps'][1]['responsePayload']=altered['steps'][1]['responseXml']=altered['steps'][1]['responseXml'].replace('<Balances>','<AccountData/><Balances>')
  with self.assertRaises(FieldError):review(altered)
  r['steps'][1]['requestPayload']=payload('EndGame','wrong')
  with self.assertRaises(FieldError):review(r)
 def test_unknown_mystery_positions_wager_and_feature_nodes_fail_closed(self):
  for a,b in [('freeSpin="N"', 'freeSpin="Y"'), ('bonusAwarded="N"', 'bonusAwarded="Y"'), ('anywayWinCount="1"', 'anywayWinCount="2"'), ('scatterWinCount="0"', 'scatterWinCount="1"'), ('totalStake="200"', 'totalStake="201"'), ('waysCount="243"', 'waysCount="244"'), ('isMaxWin="N"', 'isMaxWin="Y"'), ('totalFreeSpinsWin="0"', 'totalFreeSpinsWin="1"'), ('totalPickJkptWin="0"', 'totalPickJkptWin="1"'), ('winVal="25"', 'winVal="26"'), ('ways="1"', 'ways="99999"'), ('awardIndex="0"', 'awardIndex="99999"'), ('winIndex="0"', 'winIndex="1"'), ('>0|11|12</AnywayWin>', '>0|1|15</AnywayWin>'), ('totalWayWin="25"', 'totalWayWin="26"'), ('totalSpinWin="25"', 'totalSpinWin="26"'), ('totalScatterWin="0"', 'totalScatterWin="1"'), ('totalWin="25"', 'totalWin="26"'), ('totalBaseGameWin="25"', 'totalBaseGameWin="26"'), ('totalWagerWin="25"', 'totalWagerWin="26"'), ('</GameResult>', '<Feature index="1" name="FreeGame"><data remainingFreeSpins="8" extraFreeSpinsAwarded="0" totalFreeSpinsPlayed="0" freeSpinTriggerWin="400"/></Feature></GameResult>'), ('</GameResult>', '<Feature index="2" name="PickGame"/></GameResult>'), ('</ReelSpin>', '<ScatterWin winIndex="0" awardIndex="30" winVal="3800">0|1|2</ScatterWin></ReelSpin>'), ('reelsetIndex="0"', 'reelsetIndex="1"'), ('<CurrencyMultiplier>1</CurrencyMultiplier>', '<CurrencyMultiplier>2</CurrencyMultiplier>'), ('<Header gameID', '<Header readyForEndGame="Y" gameID'), ('<GameWinInfo', 'unexpected<GameWinInfo'), ('maxWinValue="25000000"', 'maxWinValue="1"'), ('targetedRtpValue="96.06"', 'targetedRtpValue="96.07"'), ('isRedEnvlpJkpt="N"', 'isRedEnvlpJkpt="Y"'), ('<MysteryRepSymbol', '<MysteryRepSymbol unknown="1"'), ('replacementSymbolIndex="0"', 'replacementSymbolIndex="10"'), ('</GameResult>', '<BGInfo/></GameResult>')]:
   r=raw();r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  with self.assertRaises(FieldError):request(payload('Logic','first',True).replace('totalStake="200"','totalStake="201"'),'Logic',True)
 def test_init_capability_is_not_paid_or_feature_admission(self):
  q=payload('Init','first');p=text('Init','rotated',1000,'<GameInfo><Stakes>200|400|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',q,p,1000)
  self.assertEqual(bootstrap(s,'first'),dict(validated=True,session='rotated',balanceRaw=1000))
  for a,b in [('200|400|','199|400|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   t=copy.deepcopy(s);t['responsePayload']=t['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(t,'first')
 def test_missing_or_tampered_wiring_proof_never_admits_plan(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32769'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified','records','raws','credit','rejected','source_constructor','sample_count','type_credit','policy'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32769']
   if kind=='missing':proof.pop('wiringEvidence')
   elif kind=='hash':proof['wiringEvidence']['evidenceHash']='a'*64
   elif kind=='records':
    proof['wiringEvidence']['fullRecordsHash']='a'*64
   elif kind=='raws':proof['acceptedRawHashes'][0]='a'*64
   elif kind=='credit':proof['wiringEvidence']['failedOrHistoricalRoundsCredited']=1
   elif kind=='rejected':proof['rejectedHistoricalPrefixes'].append({'index':0,'rawHash':'a'*64})
   elif kind=='source_constructor':proof['wiringEvidence']['ownSourcePayloadSemanticHash']='a'*64
   elif kind=='sample_count':proof['sampledRounds']=999
   elif kind=='type_credit':proof['wiringEvidence']['acceptedFreeRounds']=1
   elif kind=='policy':proof['wiringEvidence']['ordinaryContractHash']='a'*64
   else:
    proof['wiringEvidence']['sourceRoutesValidated' if kind=='count' else 'actualRecordAndVerifyIpc']=1983 if kind=='count' else False
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   if kind not in ('missing','hash'):
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   def read(current,*args,**kwargs):return json.dumps(bad) if current==path else original(current,*args,**kwargs)
   with self.subTest(kind=kind),patch.object(Path,'read_text',read):
    with self.assertRaises(Rejected):validate_rolling_plan(p)
 def test_own_mystery_joint_never_adds_an_award_and_feature_bet_stops(self):
  r=raw();self.assertEqual(review(r)['win'],25);s=r['steps'][0]
  s['responsePayload']=s['responseXml']=s['responseXml'].replace('<MysteryRepSymbol isNudgingWild="N" isRedEnvlpJkpt="N" isSymPresent="N" replacementSymbolIndex="0"/>','<MysteryRepSymbol isNudgingWild="Y" isRedEnvlpJkpt="N" isSymPresent="Y" nudgingWildPositions="7|12" replacementSymbolIndex="9"/>');self.assertEqual(review(r)['win'],25)
  s['responsePayload']=s['responseXml']=s['responseXml'].replace('nudgingWildPositions="7|12"','nudgingWildPositions="0"')
  with self.assertRaises(FieldError):review(r)
  for a,b in [('<WagerInfo','unknown<WagerInfo'),('totalStake="200"','totalStake="201"'),('featureBet="0"','featureBet="1"'),('WagerInfo','Stake')]:
   with self.assertRaises(FieldError):request(payload('Logic','first',True).replace(a,b),'Logic',True)
if __name__=='__main__':unittest.main()
