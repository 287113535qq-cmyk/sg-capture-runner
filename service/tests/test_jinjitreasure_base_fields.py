import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from jinjitreasure_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="jinjibaoxiendlesstreasure" gameID="20322" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+H.format(session)+('<Stake total="16" gameMode="0"/><PaylineCount count="1"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>' if first else '')+'</GameRequest>'
def text(msg,session,cash,body=''):
 a='<AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData>' if msg=='Logic' else '<AccountData/>'
 return f'<GameResponse type="{msg}"><Header gameID="20322" versionID="1_0" isRecovering="N" sessionID="{session}"/>{a}<Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'
G='<GameResult stake="16" totalWin="10" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" anywayWins="1" scatterWinCount="0" totalSpinWin="10" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><AnywayWin winIndex="0" winVal="10" ways="1" awardIndex="3">0|11|12</AnywayWin></ReelSpin></ReelResults><BGInfo totalWagerWin="10" bgWinnings="10" baseGameSpinsRemaining="0" isMaxWin="0" goldChanceAwarded="0" jackpotAwarded="0" gameMode="0"/><MysterySymbol replacementSym="6"/><ScatterInfo totalValue="48" numScatters="3" values="0|0|16|0|16|0|0|16|0|0|0|0|0|0|0"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',994,G),994),step('EndGame',payload('EndGame','paid'),text('EndGame','end',994),994)])

class JinjiTreasureBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(.16,10/16,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32778'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',17),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20322)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_cumulative_and_anyway_sum_are_all_required(self):
  for a,b in [('winVal="10"', 'winVal="11"'), ('bgWinnings="10"', 'bgWinnings="11"'), ('totalSpinWin="10"', 'totalSpinWin="11"')]:
   r=raw();s=r['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  r=raw();r['steps'][0]['responseBalance']+=1
  with self.assertRaises(FieldError):review(r)
 def test_partial_early_end_and_session_rotation_rejected(self):
  r=raw()
  with self.assertRaises(FieldError):settled({**r,'steps':r['steps'][:1]},mapping_hash())
  with self.assertRaises(FieldError):review({**r,'steps':[r['steps'][1]]})
  with self.assertRaises(FieldError):review({**r,'steps':r['steps']+[r['steps'][1]]})
  altered=copy.deepcopy(r);altered['steps'][1]['responsePayload']=altered['steps'][1]['responseXml']=altered['steps'][1]['responseXml'].replace('<AccountData/>','<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>')
  with self.assertRaises(FieldError):review(altered)
  r['steps'][1]['requestPayload']=payload('EndGame','wrong')
  with self.assertRaises(FieldError):review(r)
 def test_unknown_quickhits_positions_and_feature_and_nodes_fail_closed(self):
  for a,b in [('freeSpin="N"', 'freeSpin="Y"'), ('bonusAwarded="N"', 'bonusAwarded="Y"'), ('anywayWins="1"', 'anywayWins="2"'), ('scatterWinCount="0"', 'scatterWinCount="1"'), ('stake="16"', 'stake="17"'), ('isMaxWin="0"', 'isMaxWin="1"'), ('goldChanceAwarded="0"', 'goldChanceAwarded="1"'), ('jackpotAwarded="0"', 'jackpotAwarded="1"'), ('gameMode="0"', 'gameMode="1"'), ('baseGameSpinsRemaining="0"', 'baseGameSpinsRemaining="1"'), ('winVal="10"', 'winVal="11"'), ('awardIndex="3"', 'awardIndex="99999"'), ('ways="1"', 'ways="99999"'), ('winIndex="0"', 'winIndex="1"'), ('>0|11|12</AnywayWin>', '>0|1|15</AnywayWin>'), ('totalSpinWin="10"', 'totalSpinWin="11"'), ('totalWin="10"', 'totalWin="11"'), ('<BGInfo', '<UnknownFeature/><BGInfo'), ('</GameResult>', '<DecisionInfo picksAwarded="1" picksUsed="0"/></GameResult>'), ('reelsetIndex="0"', 'reelsetIndex="1"'), ('spinIndex="0"', 'spinIndex="1"'), ('<CurrencyMultiplier>1</CurrencyMultiplier>', '<CurrencyMultiplier>2</CurrencyMultiplier>'), ('isRecovering="N"', 'isRecovering="N" readyForEndGame="Y"'), ('<BGInfo', 'unexpected<BGInfo'), ('replacementSym="6"', 'replacementSym="99999"'), ('totalValue="48"', 'totalValue="99999"'), ('numScatters="3"', 'numScatters="99"'), ('values="0|0|16|0|16|0|0|16|0|0|0|0|0|0|0"', 'values="0|16"'), ('stake="16"', 'stake="16" stakePerLine="1"'), ('<BGInfo', '<BGInfo isBigBet="0"')]:
   r=raw();r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  with self.assertRaises(FieldError):request(payload('Logic','first',True).replace('total="16"','total="17"'),'Logic',True)
 def test_init_capability_is_not_paid_or_feature_admission(self):
  q=payload('Init','first');p=text('Init','rotated',1000,'<GameInfo><Stakes>16|32|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',q,p,1000)
  self.assertEqual(bootstrap(s,'first'),dict(validated=True,session='rotated',balanceRaw=1000))
  for a,b in [('16|32|','15|32|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   t=copy.deepcopy(s);t['responsePayload']=t['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(t,'first')
 def test_missing_or_tampered_wiring_proof_never_admits_plan(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32778'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified','records','raws','credit','rejected','source_constructor','sample_count','type_credit','policy'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32778']
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
 def test_all_own_joint_states_do_not_add_scatter_rewards_and_request_order_stops(self):
  policy=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-jinjitreasure-base-contract.json').read_bytes())
  for j in policy['stateJointPatterns']:
   g=f'<GameResult stake="16" totalWin="0" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" anywayWins="0" scatterWinCount="0" totalSpinWin="0" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops></ReelSpin></ReelResults><BGInfo totalWagerWin="0" bgWinnings="0" baseGameSpinsRemaining="0" isMaxWin="0" goldChanceAwarded="0" jackpotAwarded="0" gameMode="0"/><MysterySymbol replacementSym="{j['mystery']['replacementSym']}"/><ScatterInfo totalValue="{j['scatter']['totalValue']}" numScatters="{j['scatter']['numScatters']}" values="{j['scatter']['values']}"/></GameResult>'
   v=raw();v['steps']=[step('Logic',payload('Logic','first',True),text('Logic','paid',984,g),984),step('EndGame',payload('EndGame','paid'),text('EndGame','end',984),984)];self.assertEqual(review(v)['win'],0);self.assertEqual(review(v)['balance'],984)
  for a,b in [('<Stake','unknown<Stake'),('total="16"','total="17"'),('gameMode="0"','gameMode="1"'),('count="1"','count="2"'),('<Stake','<Stake isBigBet="0"'),('Stake','WagerInfo')]:
   with self.assertRaises(FieldError):request(payload('Logic','first',True).replace(a,b),'Logic',True)
  v=raw();s=v['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace('winIndex="0"','winIndex="1"')
  with self.assertRaises(FieldError):review(v)
if __name__=='__main__':unittest.main()
