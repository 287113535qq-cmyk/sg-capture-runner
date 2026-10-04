import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from drumsexplosion_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="dancingdrumsexplosion" gameID="20454" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+('<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>' if first else '')+H.format(session)+('<Stake total="176"/>' if first else '')+'</GameRequest>' 
def text(msg,session,cash,body=''):
 a='<AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData>' if msg=='Logic' else '<AccountData/>'
 return f'<GameResponse type="{msg}"><Header gameID="20454" versionID="1_0" isRecovering="N" readyForEndGame="{'Y' if msg=='Logic' else 'N'}" sessionID="{session}"/>{a}<Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'

G='<GameResult stake="176" totalWin="10" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" anywayWins="1" scatterWinCount="0" totalSpinWin="10" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><AnywayWin winIndex="0" winVal="10" ways="1" awardIndex="0">0|1|2</AnywayWin></ReelSpin></ReelResults><BGInfo totalWagerWin="10" bgWinnings="10" isMaxWin="0" wildReplace="0|0|0|0|0" bonusReplace="0|0|0|0|0"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,
 steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',834,G),834),step('EndGame',payload('EndGame','paid'),text('EndGame','end',834),834)])
class DrumsExplosionBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(1.76,10/176,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32761'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',177),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20454)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_cumulative_and_anyway_sum_are_all_required(self):
  for a,b in [('winVal="10"', 'winVal="11"'), ('bgWinnings="10"', 'bgWinnings="11"'), ('ways="1"', 'ways="9999"'), ('winIndex="0"', 'winIndex="1"')]:
   r=raw();s=r['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  r=raw();r['steps'][0]['responseBalance']+=1
  with self.assertRaises(FieldError):review(r)
 def test_partial_early_end_and_session_rotation_rejected(self):
  r=raw()
  with self.assertRaises(FieldError):settled({**r,'steps':r['steps'][:1]},mapping_hash())
  with self.assertRaises(FieldError):review({**r,'steps':[r['steps'][1]]})
  with self.assertRaises(FieldError):review({**r,'steps':r['steps']+[r['steps'][1]]})
  changed=copy.deepcopy(r);changed['steps'][1]['responsePayload']=changed['steps'][1]['responseXml']=changed['steps'][1]['responseXml'].replace('readyForEndGame="N"','readyForEndGame="Y"')
  with self.assertRaises(FieldError):review(changed)
  altered=copy.deepcopy(r);altered['steps'][1]['responsePayload']=altered['steps'][1]['responseXml']=altered['steps'][1]['responseXml'].replace('<AccountData/>','<AccountData>unknown</AccountData>')
  with self.assertRaises(FieldError):review(altered)
  r['steps'][1]['requestPayload']=payload('EndGame','wrong')
  with self.assertRaises(FieldError):review(r)
 def test_unknown_ways_positions_and_decision_and_nodes_fail_closed(self):
  for a,b in [('freeSpin="N"', 'freeSpin="Y"'), ('bonusAwarded="N"', 'bonusAwarded="Y"'), ('anywayWins="1"', 'anywayWins="2"'), ('scatterWinCount="0"', 'scatterWinCount="1"'), ('stake="176"', 'stake="177"'), ('isMaxWin="0"', 'isMaxWin="1"'), ('winVal="10"', 'winVal="11"'), ('awardIndex="0"', 'awardIndex="99999"'), ('ways="1"', 'ways="9999"'), ('winIndex="0"', 'winIndex="1"'), ('>0|1|2</AnywayWin>', '>0|1|15</AnywayWin>'), ('totalSpinWin="10"', 'totalSpinWin="20"'), ('totalWin="10"', 'totalWin="20"'), ('<BGInfo', '<UnknownFeature/><BGInfo'), ('</GameResult>', '<DecisionInfo picksAwarded="1" picksUsed="0"/></GameResult>'), ('</GameResult>', '<FSInfo/></GameResult>'), ('spinIndex="0"', 'spinIndex="1"'), ('<CurrencyMultiplier>1</CurrencyMultiplier>', '<CurrencyMultiplier>2</CurrencyMultiplier>'), ('<GameResult stake="176"', '<GameResult stake="176" stakePerLine="176"'), ('readyForEndGame="Y"', 'readyForEndGame="N"'), ('wildReplace="0|0|0|0|0"', 'wildReplace="1|0|0|0|0"'), ('bonusReplace="0|0|0|0|0"', 'bonusReplace="0|1|0|0|0"')]:
   r=raw();r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  with self.assertRaises(FieldError):request(payload('Logic','first',True).replace('total="176"','total="177"'),'Logic',True)
 def test_init_capability_is_not_paid_or_feature_admission(self):
  q=payload('Init','first');p=text('Init','rotated',1000,'<GameInfo><Stakes>176|352|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',q,p,1000)
  self.assertEqual(bootstrap(s,'first'),dict(validated=True,session='rotated',balanceRaw=1000))
  for a,b in [('176|352|','175|352|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   t=copy.deepcopy(s);t['responsePayload']=t['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(t,'first')
 def test_missing_or_tampered_wiring_proof_never_admits_plan(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32761'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified','records','raws','credit','rejected','source_constructor','sample_count','type_credit','policy'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32761']
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
    proof['wiringEvidence']['sourceRoutesValidated' if kind=='count' else 'actualRecordAndVerifyIpc']=1999 if kind=='count' else False
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   if kind not in ('missing','hash'):
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   def read(current,*args,**kwargs):return json.dumps(bad) if current==path else original(current,*args,**kwargs)
   with self.subTest(kind=kind),patch.object(Path,'read_text',read):
    with self.assertRaises(Rejected):validate_rolling_plan(p)
if __name__=='__main__':unittest.main()
