import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from firequeen_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="firequeen_prt" gameID="20192" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+H.format(session)+('<WagerInfo totalStake="50"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>' if first else '')+'</GameRequest>'
def text(msg,session,cash,body=''):
 a='<AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData>' if msg=='Logic' else '<AccountData/>'
 return f'<GameResponse type="{msg}"><Header gameID="20192" versionID="1_0" isRecovering="N" sessionID="{session}"/>{a}<Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'
G='<GameResult stake="50" stakePerLine="1" paylineCount="100" totalWin="2" betID=""><WildTransformedReels>1|5</WildTransformedReels><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="2" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5|6|7|8|9|10|11</ReelStops><PaylineWin index="0" winVal="2" awardIndex="0" awardTableIndex="0">19|22|24</PaylineWin></ReelSpin></ReelResults><GameWinInfo totalWagerWin="2" totalBGWin="2" totalFSWin="0" maxWinValue="25000000" isMaxWin="N" isEndGame="Y"/><GameVariantInfo rtp="95.95"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,
 steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',952,G),952),step('EndGame',payload('EndGame','paid'),text('EndGame','end',952),952)])

class FireQueenBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(0.5,2/50,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32767'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',51),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20192)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_cumulative_and_anyway_sum_are_all_required(self):
  for a,b in [('winVal="2"', 'winVal="3"'), ('totalBGWin="2"', 'totalBGWin="3"'), ('spinWins="2"', 'spinWins="3"')]:
   r=raw();s=r['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  r=raw();r['steps'][0]['responseBalance']+=1
  with self.assertRaises(FieldError):review(r)
 def test_partial_early_end_and_session_rotation_rejected(self):
  r=raw()
  with self.assertRaises(FieldError):settled({**r,'steps':r['steps'][:1]},mapping_hash())
  with self.assertRaises(FieldError):review({**r,'steps':[r['steps'][1]]})
  with self.assertRaises(FieldError):review({**r,'steps':r['steps']+[r['steps'][1]]})
  altered=copy.deepcopy(r);altered['steps'][1]['responsePayload']=altered['steps'][1]['responseXml']=altered['steps'][1]['responseXml'].replace('<AccountData/>','<AccountData>unknown</AccountData>')
  with self.assertRaises(FieldError):review(altered)
  r['steps'][1]['requestPayload']=payload('EndGame','wrong')
  with self.assertRaises(FieldError):review(r)
 def test_unknown_quickhits_positions_and_feature_and_nodes_fail_closed(self):
  for a,b in [('freeSpin="N"', 'freeSpin="Y"'), ('bonusAwarded="N"', 'bonusAwarded="Y"'), ('winCountPL="1"', 'winCountPL="2"'), ('winCountSC="0"', 'winCountSC="1"'), ('stake="50"', 'stake="51"'), ('stakePerLine="1"', 'stakePerLine="2"'), ('paylineCount="100"', 'paylineCount="101"'), ('isMaxWin="N"', 'isMaxWin="Y"'), ('winVal="2"', 'winVal="3"'), ('awardIndex="0"', 'awardIndex="99999"'), ('awardTableIndex="0"', 'awardTableIndex="1"'), ('index="0"', 'index="100"'), ('>19|22|24</PaylineWin>', '>0|1|66</PaylineWin>'), ('spinWins="2"', 'spinWins="3"'), ('totalWin="2"', 'totalWin="3"'), ('<GameWinInfo', '<UnknownFeature/><GameWinInfo'), ('</GameResult>', '<FSInfo/></GameResult>'), ('</GameResult>', '<Feature index="1" name="FreeSpins3"/></GameResult>'), ('</ReelSpin>', '<ScatterWin awardIndex="39" winVal="50">0|1|2</ScatterWin></ReelSpin>'), ('reelsetIndex="0"', 'reelsetIndex="1"'), ('spinIndex="0"', 'spinIndex="1"'), ('<CurrencyMultiplier>1</CurrencyMultiplier>', '<CurrencyMultiplier>2</CurrencyMultiplier>'), ('isEndGame="Y"', 'isEndGame="N"'), ('<GameWinInfo', 'unexpected<GameWinInfo'), ('<GameWinInfo', '<BGInfo/><GameWinInfo'), ('rtp="95.95"', 'rtp="96"'), ('maxWinValue="25000000"', 'maxWinValue="1"'), ('totalFSWin="0"', 'totalFSWin="50"'), ('>1|5</WildTransformedReels>', '>9|9</WildTransformedReels>'), ('<Header gameID', '<Header readyForEndGame="Y" gameID'), ('1|2|3|4|5|6|7|8|9|10|11', '1|2|3|4|5')]:
   r=raw();self.assertIn(a,r['steps'][0]['responseXml']);r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  with self.assertRaises(FieldError):request(payload('Logic','first',True).replace('totalStake="50"','totalStake="51"'),'Logic',True)
 def test_init_capability_is_not_paid_or_feature_admission(self):
  q=payload('Init','first');p=text('Init','rotated',1000,'<GameInfo><Stakes>50|100|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',q,p,1000)
  self.assertEqual(bootstrap(s,'first'),dict(validated=True,session='rotated',balanceRaw=1000))
  for a,b in [('50|100|','49|100|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   t=copy.deepcopy(s);t['responsePayload']=t['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(t,'first')
 def test_missing_or_tampered_wiring_proof_never_admits_plan(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32767'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified','records','raws','credit','rejected','source_constructor','sample_count','type_credit','policy'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32767']
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
    proof['wiringEvidence']['sourceRoutesValidated' if kind=='count' else 'actualRecordAndVerifyIpc']=1977 if kind=='count' else False
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   if kind not in ('missing','hash'):
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   def read(current,*args,**kwargs):return json.dumps(bad) if current==path else original(current,*args,**kwargs)
   with self.subTest(kind=kind),patch.object(Path,'read_text',read):
    with self.assertRaises(Rejected):validate_rolling_plan(p)
 def test_optional_wild_text_and_own_terminal_are_distinct_from_free(self):
  r=raw();s=r['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace('<WildTransformedReels>1|5</WildTransformedReels>','');self.assertEqual(review(r)['win'],2)
  for a,b in [('<Header gameID','<Header readyForEndGame="N" gameID'),('<AccountData/>','')]:
   t=copy.deepcopy(r);t['steps'][1]['responsePayload']=t['steps'][1]['responseXml']=t['steps'][1]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(t)
  s['responsePayload']=s['responseXml']=s['responseXml'].replace('</GameResult>','<Feature index="1" name="FreeSpins3"/></GameResult>')
  with self.assertRaises(FieldError):review(r)
  for value in (payload('Logic','first',True).replace('<WagerInfo','unknown<WagerInfo'),payload('Logic','first',True).replace('totalStake="50"','totalStake="51"'),payload('Logic','first',True).replace('<WagerInfo totalStake="50"/>','<Stake total="50"/>')):
   with self.assertRaises(FieldError):request(value,'Logic',True)
if __name__=='__main__':unittest.main()
