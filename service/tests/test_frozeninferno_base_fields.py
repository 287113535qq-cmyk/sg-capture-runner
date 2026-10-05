import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from frozeninferno_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="frozeninferno" gameID="20090" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+H.format(session)+('<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><SpinInfo perLine="125" total="5000" mode="0" isReset="0" modeChange="0"/>' if first else '')+'</GameRequest>'
def text(msg,session,cash,body=''):
 a='<AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData>' if msg=='Logic' else ''
 return f'<GameResponse type="{msg}"><Header gameID="20090" versionID="1_0" isRecovering="N" sessionID="{session}"/>{a}<Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'
G='<GameResult stake="5000" stakePerLine="125" paylineCount="40" totalWin="625" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="625" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><PaylineWin index="0" winVal="625" awardIndex="0" awardTableIndex="0">0|1|2</PaylineWin></ReelSpin></ReelResults><WildInfo><WildData mode="0" wildCount="1" previousWild="0" CurrentWild="-1" direction="1">5</WildData></WildInfo><BaseGame gameMode="0" isMaxWin="N" maxWinValue="25000000"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=10000,
 steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',5625,G),5625),step('EndGame',payload('EndGame','paid'),text('EndGame','end',5625),5625)])

class FrozenInfernoBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(50,625/5000,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32768'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',5001),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20090)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_payline_sum_and_spin_total_are_all_required(self):
  for a,b in [('winVal="625"', 'winVal="626"'), ('totalWin="625"', 'totalWin="626"'), ('spinWins="625"', 'spinWins="626"')]:
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
 def test_unknown_wild_positions_modes_and_feature_nodes_fail_closed(self):
  for a,b in [('freeSpin="N"', 'freeSpin="Y"'), ('bonusAwarded="N"', 'bonusAwarded="Y"'), ('winCountPL="1"', 'winCountPL="2"'), ('winCountSC="0"', 'winCountSC="1"'), ('stake="5000"', 'stake="5001"'), ('stakePerLine="125"', 'stakePerLine="126"'), ('paylineCount="40"', 'paylineCount="41"'), ('isMaxWin="N"', 'isMaxWin="Y"'), ('winVal="625"', 'winVal="626"'), ('awardIndex="0"', 'awardIndex="99999"'), ('awardTableIndex="0"', 'awardTableIndex="1"'), ('index="0"', 'index="40"'), ('>0|1|2</PaylineWin>', '>0|1|20</PaylineWin>'), ('spinWins="625"', 'spinWins="626"'), ('totalWin="625"', 'totalWin="626"'), ('<BaseGame', '<UnknownFeature/><BaseGame'), ('</GameResult>', '<FSInfo/></GameResult>'), ('</GameResult>', '<Feature index="1" name="FreeGames"><data mode="0" bonusPos="9"/></Feature></GameResult>'), ('</ReelSpin>', '<ScatterWin awardIndex="0" winVal="0">0|1</ScatterWin></ReelSpin>'), ('reelsetIndex="0"', 'reelsetIndex="1"'), ('spinIndex="0"', 'spinIndex="1"'), ('<CurrencyMultiplier>1</CurrencyMultiplier>', '<CurrencyMultiplier>2</CurrencyMultiplier>'), ('<Header gameID', '<Header readyForEndGame="Y" gameID'), ('<BaseGame', 'unexpected<BaseGame'), ('maxWinValue="25000000"', 'maxWinValue="1"'), ('gameMode="0"', 'gameMode="1"'), ('<WildData', '<WildData unknown="1"'), ('CurrentWild="-1"', 'CurrentWild="-2"'), ('direction="1"', 'direction="4"'), ('<WildInfo><WildData mode="0" wildCount="1" previousWild="0" CurrentWild="-1" direction="1">5</WildData></WildInfo>', '<WildInfo><WildData mode="0" wildCount="1" previousWild="999" CurrentWild="-1" direction="1">5</WildData></WildInfo>')]:
   r=raw();r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  with self.assertRaises(FieldError):request(payload('Logic','first',True).replace('total="5000"','total="5001"'),'Logic',True)
 def test_init_capability_is_not_paid_or_feature_admission(self):
  q=payload('Init','first');p=text('Init','rotated',1000,'<GameInfo><Stakes>5000|10000|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',q,p,1000)
  self.assertEqual(bootstrap(s,'first'),dict(validated=True,session='rotated',balanceRaw=1000))
  for a,b in [('5000|10000|','4999|10000|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   t=copy.deepcopy(s);t['responsePayload']=t['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(t,'first')
 def test_missing_or_tampered_wiring_proof_never_admits_plan(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32768'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified','records','raws','credit','rejected','source_constructor','sample_count','type_credit','policy'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32768']
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
    proof['wiringEvidence']['sourceRoutesValidated' if kind=='count' else 'actualRecordAndVerifyIpc']=1353 if kind=='count' else False
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   if kind not in ('missing','hash'):
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   def read(current,*args,**kwargs):return json.dumps(bad) if current==path else original(current,*args,**kwargs)
   with self.subTest(kind=kind),patch.object(Path,'read_text',read):
    with self.assertRaises(Rejected):validate_rolling_plan(p)
 def test_own_wild_joint_never_adds_an_award_and_spin_info_modes_stop(self):
  r=raw();self.assertEqual(review(r)['win'],625);s=r['steps'][0]
  s['responsePayload']=s['responseXml']=s['responseXml'].replace('<WildInfo><WildData mode="0" wildCount="1" previousWild="0" CurrentWild="-1" direction="1">5</WildData></WildInfo>','<WildInfo><WildData mode="0" wildCount="4" previousWild="9|14|13|18" CurrentWild="-1" direction="2">8|13|12|17</WildData></WildInfo>');self.assertEqual(review(r)['win'],625)
  s['responsePayload']=s['responseXml']=s['responseXml'].replace('direction="2"','direction="4"')
  with self.assertRaises(FieldError):review(r)
  for a,b in [('<SpinInfo','unknown<SpinInfo'),('total="5000"','total="5001"'),('mode="0"','mode="1"'),('isReset="0"','isReset="1"'),('modeChange="0"','modeChange="1"'),('perLine="125"','perLine="126"')]:
   with self.assertRaises(FieldError):request(payload('Logic','first',True).replace(a,b),'Logic',True)
if __name__=='__main__':unittest.main()
