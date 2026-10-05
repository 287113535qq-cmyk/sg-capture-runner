import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from jinjimegaways_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="jjbxmegaways" gameID="20468" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+('<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>' if first else '')+H.format(session)+('<Stake total="88"/>' if first else '')+'</GameRequest>'
def text(msg,session,cash,body=''):
 a='<AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData>' if msg=='Logic' else '<AccountData/>'
 ready=' readyForEndGame="'+('Y' if msg=='Logic' else 'N')+'"' if msg!='Init' else ''
 grid='<SymbolGrids/>' if msg=='Logic' else ''
 return f'<GameResponse type="{msg}"><Header gameID="20468" versionID="1_0" isRecovering="N" sessionID="{session}"{ready}/>{a}<Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}{grid}</GameResponse>'
G='<GameResult stake="88" totalWin="12" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" anywayWins="1" scatterWinCount="0" totalSpinWin="12" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5|6</ReelStops><AnywayWin winIndex="0" winVal="12" ways="1" awardIndex="0">0|19|38</AnywayWin></ReelSpin></ReelResults><BGInfo totalWagerWin="12" bgWinnings="12" reelHeights="2|3|2|4|3|4" isMaxWin="0"/><TopReelInfo reelSetIndex="9" reelStop="0" positions="37|38|39|40"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',924,G),924),step('EndGame',payload('EndGame','paid'),text('EndGame','end',924),924)])

class JinjiMegawaysBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(.88,12/88,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32777'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',89),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20468)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_cumulative_and_anyway_sum_are_all_required(self):
  for a,b in [('winVal="12"', 'winVal="13"'), ('bgWinnings="12"', 'bgWinnings="13"'), ('totalSpinWin="12"', 'totalSpinWin="13"')]:
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
  for a,b in [('freeSpin="N"', 'freeSpin="Y"'), ('bonusAwarded="N"', 'bonusAwarded="Y"'), ('anywayWins="1"', 'anywayWins="2"'), ('scatterWinCount="0"', 'scatterWinCount="1"'), ('stake="88"', 'stake="89"'), ('isMaxWin="0"', 'isMaxWin="1"'), ('winVal="12"', 'winVal="13"'), ('awardIndex="0"', 'awardIndex="99999"'), ('ways="1"', 'ways="99999"'), ('winIndex="0"', 'winIndex="1"'), ('>0|19|38</AnywayWin>', '>0|1|41</AnywayWin>'), ('totalSpinWin="12"', 'totalSpinWin="13"'), ('totalWin="12"', 'totalWin="13"'), ('<BGInfo', '<UnknownFeature/><BGInfo'), ('</GameResult>', '<PickInfo buyPassTrigger="0" picksAwarded="1"/></GameResult>'), ('reelsetIndex="0"', 'reelsetIndex="4"'), ('spinIndex="0"', 'spinIndex="1"'), ('<CurrencyMultiplier>1</CurrencyMultiplier>', '<CurrencyMultiplier>2</CurrencyMultiplier>'), ('readyForEndGame="Y"', 'readyForEndGame="N"'), ('<BGInfo', 'unexpected<BGInfo'), ('reelHeights="2|3|2|4|3|4"', 'reelHeights="8|2|2|2|2|2"'), ('reelSetIndex="9"', 'reelSetIndex="8"'), ('reelStop="0"', 'reelStop="89"'), ('positions="37|38|39|40"', 'positions="37|38|40|39"'), ('<SymbolGrids/>', '<SymbolGrids>0</SymbolGrids>'), ('stake="88"', 'stake="88" stakePerLine="1"'), ('<BGInfo', '<BGInfo isBigBet="0"')]:
   r=raw();r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  with self.assertRaises(FieldError):request(payload('Logic','first',True).replace('total="88"','total="89"'),'Logic',True)
 def test_init_capability_is_not_paid_or_feature_admission(self):
  q=payload('Init','first');p=text('Init','rotated',1000,'<GameInfo><Stakes>88|176|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',q,p,1000)
  self.assertEqual(bootstrap(s,'first'),dict(validated=True,session='rotated',balanceRaw=1000))
  for a,b in [('88|176|','87|176|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   t=copy.deepcopy(s);t['responsePayload']=t['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(t,'first')
 def test_missing_or_tampered_wiring_proof_never_admits_plan(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32777'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified','records','raws','credit','rejected','source_constructor','sample_count','type_credit','policy'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32777']
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
 def test_all_own_heights_and_top_shapes_no_second_award_and_request_boundaries(self):
  policy=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-jinjimegaways-base-contract.json').read_bytes())
  for j in policy['reelHeightJointPatterns']:
   g=f'<GameResult stake="88" totalWin="0" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="{j["reelsetIndex"]}" anywayWins="0" scatterWinCount="0" totalSpinWin="0" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5|6</ReelStops></ReelSpin></ReelResults><BGInfo totalWagerWin="0" bgWinnings="0" reelHeights="{j["reelHeights"]}" isMaxWin="0"/><TopReelInfo reelSetIndex="9" reelStop="88" positions="37|38|39|40"/></GameResult>'
   v=raw();v['steps']=[step('Logic',payload('Logic','first',True),text('Logic','paid',912,g),912),step('EndGame',payload('EndGame','paid'),text('EndGame','end',912),912)];self.assertEqual(review(v)['win'],0);self.assertEqual(review(v)['balance'],912)
  for a,b in [('<Stake','unknown<Stake'),('total="88"','total="89"'),('<Stake','<Stake isBigBet="0"'),('Stake','WagerInfo')]:
   with self.assertRaises(FieldError):request(payload('Logic','first',True).replace(a,b),'Logic',True)
  v=raw();s=v['steps'][1];s['responsePayload']=s['responseXml']=s['responseXml'].replace('readyForEndGame="N"','readyForEndGame="Y"')
  with self.assertRaises(FieldError):review(v)
if __name__=='__main__':unittest.main()
