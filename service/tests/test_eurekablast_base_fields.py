import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from eurekablast_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="eurekareelsblastsuperlock" gameID="20400" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+('<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>' if first else '')+H.format(session)+('<Stake total="50"/>' if first else '')+'</GameRequest>'
def text(msg,session,cash,body=''):
 a='<AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData>' if msg=='Logic' else '<AccountData/>'
 ready='Y' if msg=='Logic' else 'N'
 return f'<GameResponse type="{msg}"><Header gameID="20400" versionID="1_0" isRecovering="N" readyForEndGame="{ready}" sessionID="{session}"/>{a}<Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'
G='<GameResult stake="50" stakePerLine="1" paylineCount="50" totalWin="5" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="5" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><PaylineWin index="0" winVal="5" awardIndex="0" awardTableIndex="0">0|11|12</PaylineWin></ReelSpin></ReelResults><BGInfo totalWagerWin="5" bgWinnings="5" baseGameSpinsRemaining="0" isMaxWin="0"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,
 steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',955,G),955),step('EndGame',payload('EndGame','paid'),text('EndGame','end',955),955)])

class EurekaBlastBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(0.5,5/50,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32766'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',51),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20400)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_cumulative_and_anyway_sum_are_all_required(self):
  for a,b in [('winVal="5"', 'winVal="6"'), ('bgWinnings="5"', 'bgWinnings="6"'), ('spinWins="5"', 'spinWins="6"')]:
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
  for a,b in [('freeSpin="N"', 'freeSpin="Y"'), ('bonusAwarded="N"', 'bonusAwarded="Y"'), ('winCountPL="1"', 'winCountPL="2"'), ('winCountSC="0"', 'winCountSC="1"'), ('stake="50"', 'stake="51"'), ('stakePerLine="1"', 'stakePerLine="2"'), ('paylineCount="50"', 'paylineCount="51"'), ('isMaxWin="0"', 'isMaxWin="1"'), ('winVal="5"', 'winVal="6"'), ('awardIndex="0"', 'awardIndex="99999"'), ('awardTableIndex="0"', 'awardTableIndex="1"'), ('index="0"', 'index="50"'), ('>0|11|12</PaylineWin>', '>0|1|15</PaylineWin>'), ('spinWins="5"', 'spinWins="6"'), ('totalWin="5"', 'totalWin="6"'), ('<BGInfo', '<UnknownFeature/><BGInfo'), ('</GameResult>', '<FSInfo/></GameResult>'), ('</GameResult>', '<DynamiteFeature spinIndex="0" numSpins="5" triggered="1" ended="0"/></GameResult>'), ('</ReelSpin>', '<ScatterWin awardIndex="27" winVal="0">0|1|2</ScatterWin></ReelSpin>'), ('reelsetIndex="0"', 'reelsetIndex="2"'), ('spinIndex="0"', 'spinIndex="1"'), ('<CurrencyMultiplier>1</CurrencyMultiplier>', '<CurrencyMultiplier>2</CurrencyMultiplier>'), ('readyForEndGame="Y"', 'readyForEndGame="N"'), ('<BGInfo', 'unexpected<BGInfo'), ('<BGInfo', '<BonusSymValues>-1</BonusSymValues><BGInfo'), ('<BGInfo', '<BGInfo isBigBet="0"'), ('baseGameSpinsRemaining="0"', 'baseGameSpinsRemaining="1"')]:
   r=raw();self.assertIn(a,r['steps'][0]['responseXml']);r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  with self.assertRaises(FieldError):request(payload('Logic','first',True).replace('total="50"','total="51"'),'Logic',True)
 def test_init_capability_is_not_paid_or_feature_admission(self):
  q=payload('Init','first');p=text('Init','rotated',1000,'<GameInfo><Stakes>50|100|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',q,p,1000)
  self.assertEqual(bootstrap(s,'first'),dict(validated=True,session='rotated',balanceRaw=1000))
  for a,b in [('50|100|','49|100|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   t=copy.deepcopy(s);t['responsePayload']=t['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(t,'first')
 def test_missing_or_tampered_wiring_proof_never_admits_plan(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32766'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified','records','raws','credit','rejected','source_constructor','sample_count','type_credit','policy'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32766']
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
    proof['wiringEvidence']['sourceRoutesValidated' if kind=='count' else 'actualRecordAndVerifyIpc']=1949 if kind=='count' else False
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   if kind not in ('missing','hash'):
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   def read(current,*args,**kwargs):return json.dumps(bad) if current==path else original(current,*args,**kwargs)
   with self.subTest(kind=kind),patch.object(Path,'read_text',read):
    with self.assertRaises(Rejected):validate_rolling_plan(p)
 def test_own_ordinary_reelset1_and_ready_are_distinct_from_dynamite_or_free(self):
  r=raw();s=r['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace('reelsetIndex="0"','reelsetIndex="1"');self.assertEqual(review(r)['win'],5)
  for a,b in [('readyForEndGame="N"','readyForEndGame="Y"'),('<AccountData/>','')]:
   t=copy.deepcopy(r);t['steps'][1]['responsePayload']=t['steps'][1]['responseXml']=t['steps'][1]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(t)
  s['responsePayload']=s['responseXml']=s['responseXml'].replace('</GameResult>','<DynamiteFeature triggered="1" ended="0"/></GameResult>')
  with self.assertRaises(FieldError):review(r)
  for value in (payload('Logic','first',True).replace('<Stake','unknown<Stake'),payload('Logic','first',True).replace('total="50"','total="51"')):
   with self.assertRaises(FieldError):request(value,'Logic',True)
if __name__=='__main__':unittest.main()
