import copy,json,unittest
from pathlib import Path
from acorn_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="acornpixie" gameID="20174" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+H.format(session)+('<Stake total="100" lines="30" fsOn="1" isBuyABonus="0"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>' if first else '')+'</GameRequest>'
def text(msg,session,cash,body=''):return f'<GameResponse type="{msg}"><Header gameID="20174" versionID="1_0" isRecovering="N" sessionID="{session}"/><Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'
G='<GameResult stake="100" stakePerLine="2" paylineCount="30" totalWin="50" betID=""><ReelResults numSpins="1"><WildClusterMask>0</WildClusterMask><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="50" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><PaylineWin index="0" winVal="50" awardIndex="12" awardTableIndex="0"/></ReelSpin></ReelResults><BGInfo totalWagerWin="50" bgWinnings="50" isMaxWin="0" isBuyABonus="0"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,
 steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',950,G),950),step('EndGame',payload('EndGame','paid'),text('EndGame','end',950),950)])
class AcornBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(1,0.5,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32752'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',101),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20174)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_cumulative_and_payline_sum_are_all_required(self):
  for a,b in [('winVal="50"','winVal="49"'),('bgWinnings="50"','bgWinnings="51"'),('paylineCount="30"','paylineCount="29"'),('index="0"','index="30"')]:
   r=raw();s=r['steps'][0];s['responsePayload']=s['responseXml']=s['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  r=raw();r['steps'][0]['responseBalance']+=1
  with self.assertRaises(FieldError):review(r)
 def test_partial_early_end_and_session_rotation_rejected(self):
  r=raw()
  with self.assertRaises(FieldError):settled({**r,'steps':r['steps'][:1]},mapping_hash())
  with self.assertRaises(FieldError):review({**r,'steps':[r['steps'][1]]})
  r['steps'][1]['requestPayload']=payload('EndGame','wrong')
  with self.assertRaises(FieldError):review(r)
 def test_unknown_free_purchase_mask_and_nodes_fail_closed(self):
  for a,b in [('freeSpin="N"','freeSpin="Y"'),('bonusAwarded="N"','bonusAwarded="Y"'),('isBuyABonus="0"','isBuyABonus="1"'),
    ('isMaxWin="0"','isMaxWin="1"'),('<WildClusterMask>0','<WildClusterMask>1'),('</GameResult>','<FSInfo/></GameResult>')]:
   r=raw();r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  with self.assertRaises(FieldError):request(payload('Logic','first',True).replace('fsOn="1"','fsOn="0"'),'Logic',True)
 def test_init_capability_is_not_paid_or_feature_admission(self):
  q=payload('Init','first');p=text('Init','rotated',1000,'<GameInfo><Stakes>100|200|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',q,p,1000)
  self.assertEqual(bootstrap(s,'first'),dict(validated=True,session='rotated',balanceRaw=1000))
  for a,b in [('100|200|','99|200|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   t=copy.deepcopy(s);t['responsePayload']=t['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(t,'first')
 def test_missing_or_tampered_wiring_proof_never_admits_plan(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32752'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32752']
   if kind=='missing':proof.pop('wiringEvidence')
   elif kind=='hash':proof['wiringEvidence']['evidenceHash']='a'*64
   else:
    proof['wiringEvidence']['sourceRoutesValidated' if kind=='count' else 'actualRecordAndVerifyIpc']=1999 if kind=='count' else False
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   def read(current,*args,**kwargs):return json.dumps(bad) if current==path else original(current,*args,**kwargs)
   with patch.object(Path,'read_text',read):
    with self.assertRaises(Rejected):validate_rolling_plan(p)
if __name__=='__main__':unittest.main()
