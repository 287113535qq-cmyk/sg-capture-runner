import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from goldenchief_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="goldenchief" gameID="20125" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+H.format(session)+('<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><Stake total="100" isBigBet="0"/>' if first else '')+'</GameRequest>'
def text(msg,session,cash,body=''):
 a='<AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData>' if msg=='Logic' else ''
 return f'<GameResponse type="{msg}"><Header gameID="20125" versionID="1_0" isRecovering="N" sessionID="{session}"/>{a}<Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'
G='<GameResult stake="100" stakePerLine="5" paylineCount="100" totalWin="10" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="10" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><PaylineWin index="0" winVal="10" awardIndex="0" awardTableIndex="0">0|1|2</PaylineWin></ReelSpin></ReelResults><BGInfo totalWagerWin="10" bgWinnings="10" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" chiefWin="0"/><PaylineCountInfo normalPaylineCount="20" bonusPaylineCount="100" activePaylineCount="100"/><WildExpansion originalWildPositions="6" wildReels="1"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,
 steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',910,G),910),step('EndGame',payload('EndGame','paid'),text('EndGame','end',910),910)])

class GoldenChiefBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(1,10/100,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32771'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',101),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20125)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_cumulative_and_anyway_sum_are_all_required(self):
  for a,b in [('winVal="10"', 'winVal="11"'), ('bgWinnings="10"', 'bgWinnings="11"'), ('spinWins="10"', 'spinWins="11"')]:
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
 def test_unknown_quickhits_positions_and_feature_and_nodes_fail_closed(self):
  for a,b in [('freeSpin="N"', 'freeSpin="Y"'), ('bonusAwarded="N"', 'bonusAwarded="Y"'), ('winCountPL="1"', 'winCountPL="2"'), ('winCountSC="0"', 'winCountSC="1"'), ('stake="100"', 'stake="101"'), ('stakePerLine="5"', 'stakePerLine="6"'), ('paylineCount="100"', 'paylineCount="101"'), ('isMaxWin="0"', 'isMaxWin="1"'), ('isBigBet="0"', 'isBigBet="1"'), ('chiefWin="0"', 'chiefWin="1"'), ('baseGameSpinsRemaining="0"', 'baseGameSpinsRemaining="1"'), ('winVal="10"', 'winVal="11"'), ('awardIndex="0"', 'awardIndex="99999"'), ('awardTableIndex="0"', 'awardTableIndex="1"'), ('index="0"', 'index="100"'), ('>0|1|2</PaylineWin>', '>0|1|20</PaylineWin>'), ('spinWins="10"', 'spinWins="11"'), ('totalWin="10"', 'totalWin="11"'), ('<BGInfo', '<UnknownFeature/><BGInfo'), ('</GameResult>', '<FSInfo/></GameResult>'), ('</GameResult>', '<BonusWheel stopPosition="11"/><GambleInfo previousFSCount="-1" currentFSCount="5"/></GameResult>'), ('</GameResult>', '<TotemBonus gameMode="1" totemType="0" numLives="0" winAmount="600" steps="0|1|2"/></GameResult>'), ('</ReelSpin>', '<ScatterWin awardIndex="0" winVal="0">0|1</ScatterWin></ReelSpin>'), ('reelsetIndex="0"', 'reelsetIndex="1"'), ('spinIndex="0"', 'spinIndex="1"'), ('<CurrencyMultiplier>1</CurrencyMultiplier>', '<CurrencyMultiplier>2</CurrencyMultiplier>'), ('isRecovering="N"', 'isRecovering="N" readyForEndGame="Y"'), ('<BGInfo', 'unexpected<BGInfo'), ('normalPaylineCount="20"', 'normalPaylineCount="21"'), ('bonusPaylineCount="100"', 'bonusPaylineCount="101"'), ('activePaylineCount="100"', 'activePaylineCount="20"'), ('originalWildPositions="6"', 'originalWildPositions="0"'), ('wildReels="1"', 'wildReels="4"'), ('<WildExpansion', '<WildExpansion foreign="1"')]:
   r=raw();r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  with self.assertRaises(FieldError):request(payload('Logic','first',True).replace('total="100"','total="101"'),'Logic',True)
 def test_init_capability_is_not_paid_or_feature_admission(self):
  q=payload('Init','first');p=text('Init','rotated',1000,'<GameInfo><Stakes>100|200|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',q,p,1000)
  self.assertEqual(bootstrap(s,'first'),dict(validated=True,session='rotated',balanceRaw=1000))
  for a,b in [('100|200|','99|200|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   t=copy.deepcopy(s);t['responsePayload']=t['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(t,'first')
 def test_missing_or_tampered_wiring_proof_never_admits_plan(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32771'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified','records','raws','credit','rejected','source_constructor','sample_count','type_credit','policy'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32771']
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
    proof['wiringEvidence']['sourceRoutesValidated' if kind=='count' else 'actualRecordAndVerifyIpc']=1973 if kind=='count' else False
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   if kind not in ('missing','hash'):
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   def read(current,*args,**kwargs):return json.dumps(bad) if current==path else original(current,*args,**kwargs)
   with self.subTest(kind=kind),patch.object(Path,'read_text',read):
    with self.assertRaises(Rejected):validate_rolling_plan(p)
 def test_own_joint_does_not_add_rewards_and_twenty_lines_are_ordinary(self):
  r=raw();s=r['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace('<WildExpansion originalWildPositions="6" wildReels="1"/>','<SymbolUpgrade replacementSymbol="3" positions="0|11|16"/><WildExpansion originalWildPositions="7" wildReels="2"/>');self.assertEqual(review(r)['win'],10)
  s['responsePayload']=s['responseXml']=s['responseXml'].replace('replacementSymbol="3"','replacementSymbol="4"')
  with self.assertRaises(FieldError):review(r)
  r=raw();s=r['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace('<WildExpansion originalWildPositions="6" wildReels="1"/>','').replace('paylineCount="100"','paylineCount="20"').replace('activePaylineCount="100"','activePaylineCount="20"');self.assertEqual(review(r)['win'],10)
  for a,b in [('<Stake','unknown<Stake'),('total="100"','total="101"'),('isBigBet="0"','isBigBet="1"'),('Stake','WagerInfo')]:
   with self.assertRaises(FieldError):request(payload('Logic','first',True).replace(a,b),'Logic',True)
if __name__=='__main__':unittest.main()
