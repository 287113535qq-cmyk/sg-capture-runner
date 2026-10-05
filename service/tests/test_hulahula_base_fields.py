import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from hulahula_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="hulahulanights" gameID="20188" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+H.format(session)+('<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><Stake total="100" isBigBet="0"/>' if first else '')+'</GameRequest>'
def text(msg,session,cash,body=''):
 a='<AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData>' if msg=='Logic' else '<AccountData/>'
 return f'<GameResponse type="{msg}"><Header gameID="20188" versionID="1_0" isRecovering="N" sessionID="{session}"/>{a}<Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'
G='<GameResult stake="100" stakePerLine="10" paylineCount="10" totalWin="50" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="50" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><PaylineWin index="0" winVal="50" awardIndex="1" awardTableIndex="0">0|1|2</PaylineWin></ReelSpin></ReelResults><BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="0"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,
 steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',950,G),950),step('EndGame',payload('EndGame','paid'),text('EndGame','end',950),950)])

class HulaHulaBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(1,50/100,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32775'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',101),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20188)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_cumulative_and_anyway_sum_are_all_required(self):
  for a,b in [('winVal="50"', 'winVal="51"'), ('bgWinnings="50"', 'bgWinnings="51"'), ('spinWins="50"', 'spinWins="51"')]:
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
  for a,b in [('freeSpin="N"', 'freeSpin="Y"'), ('bonusAwarded="N"', 'bonusAwarded="Y"'), ('winCountPL="1"', 'winCountPL="2"'), ('winCountSC="0"', 'winCountSC="1"'), ('stake="100"', 'stake="101"'), ('stakePerLine="10"', 'stakePerLine="11"'), ('paylineCount="10"', 'paylineCount="11"'), ('isMaxWin="0"', 'isMaxWin="1"'), ('isBigBet="0"', 'isBigBet="1"'), ('baseGameSpinsRemaining="0"', 'baseGameSpinsRemaining="1"'), ('winVal="50"', 'winVal="51"'), ('awardIndex="1"', 'awardIndex="99999"'), ('awardTableIndex="0"', 'awardTableIndex="1"'), ('index="0"', 'index="10"'), ('>0|1|2</PaylineWin>', '>0|1|15</PaylineWin>'), ('spinWins="50"', 'spinWins="51"'), ('totalWin="50"', 'totalWin="51"'), ('<BGInfo', '<UnknownFeature/><BGInfo'), ('</GameResult>', '<FSInfo/></GameResult>'), ('</ReelSpin>', '<ScatterWin awardIndex="0" winVal="0">0|1</ScatterWin></ReelSpin>'), ('reelsetIndex="0"', 'reelsetIndex="2"'), ('spinIndex="0"', 'spinIndex="1"'), ('<CurrencyMultiplier>1</CurrencyMultiplier>', '<CurrencyMultiplier>2</CurrencyMultiplier>'), ('isRecovering="N"', 'isRecovering="N" readyForEndGame="Y"'), ('<BGInfo', 'unexpected<BGInfo'), ('stackedSymbolIndex="0"', 'stackedSymbolIndex="10"'), ('<BGInfo', '<BGInfo clumpSymbols="0"')]:
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
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32775'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified','records','raws','credit','rejected','source_constructor','sample_count','type_credit','policy'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32775']
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
 def test_all_own_joint_states_do_not_add_rewards(self):
  for v in [{'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="0"/>', 'reel': '0'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="1"/>', 'reel': '0'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="2"/>', 'reel': '0'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="3"/>', 'reel': '0'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="4"/>', 'reel': '0'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="5"/>', 'reel': '0'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="6"/>', 'reel': '0'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="7"/>', 'reel': '0'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="8"/>', 'reel': '0'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="9"/>', 'reel': '0'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="0"/>', 'reel': '1'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="1"/>', 'reel': '1'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="2"/>', 'reel': '1'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="3"/>', 'reel': '1'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="4"/>', 'reel': '1'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="5"/>', 'reel': '1'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="6"/>', 'reel': '1'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="7"/>', 'reel': '1'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="8"/>', 'reel': '1'}, {'bg': '<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="9"/>', 'reel': '1'}]:
   r=raw();s=r['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace('<BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0" stackedSymbolIndex="0"/>',v['bg']).replace('reelsetIndex="0"','reelsetIndex="'+v['reel']+'"');self.assertEqual(review(r)['win'],50)
  for a,b in [('<Stake','unknown<Stake'),('total="100"','total="101"'),('isBigBet="0"','isBigBet="1"'),('Stake','WagerInfo')]:
   with self.assertRaises(FieldError):request(payload('Logic','first',True).replace(a,b),'Logic',True)
if __name__=='__main__':unittest.main()
