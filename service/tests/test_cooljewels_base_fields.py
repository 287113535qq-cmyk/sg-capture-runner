import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cooljewels_base_fields import SOURCE,request,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
from unittest.mock import patch

H='<Header affiliate="0" ccyCode="" channel="I" freePlay="Y" gameCodeRGI="cooljewels_prt" gameID="20150" glsID="65535" lang="en_US" promotions="N" userID="null" userType="C" versionID="1_0" sessionID="{}"/>'
def payload(msg,session,first=False):return '<GameRequest type="'+msg+'">'+H.format(session)+('<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><Stake multiplier="1" total="50"/>' if first else '')+'</GameRequest>' 
def text(msg,session,cash,body=''):
 a='<AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData>' if msg=='Logic' else ''
 return f'<GameResponse type="{msg}"><Header gameID="20150" versionID="1_0" isRecovering="N" sessionID="{session}"/>{a}<Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'

G='<GameResult stake="50" stakePerLine="0" paylineCount="0" totalWin="4" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="0" winCountSC="0" spinWins="0" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5|6</ReelStops></ReelSpin></ReelResults><ReactorChain num_drops="2"><ReactorDrop drop_order="0" num_clusters="1"><ReactorLayout symbols="4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4"/><ReactorCluster id="0" cluster_positions="4,3|5,3|5,4|5,5" cluster_awards="1|1|1|1" rootSymbol="4" rootSymbolPos="0,0" watermark="0"/></ReactorDrop><ReactorDrop drop_order="1" num_clusters="0"><ReactorLayout symbols="4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4"/></ReactorDrop></ReactorChain><MaxWin_Info maxWinValue="25000000" maxWin="false" cappedWins="0"/></GameResult>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def raw():return dict(sourceKey=SOURCE,protocol='wms',fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=1000,
 steps=[step('Logic',payload('Logic','first',True),text('Logic','paid',954,G),954),step('EndGame',payload('EndGame','paid'),text('EndGame','end',954),954)])
class CoolJewelsBaseTests(unittest.TestCase):
 def test_complete_independent_derivation_and_exact_plan(self):
  r=raw();self.assertEqual(review(r)['next'],None);f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['mul'],f['bonus']),(0.5,4/50,0))
  reg=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text());p=reg['plans']['32758'];self.assertEqual(validate_rolling_plan(p),p)
  for k,v in [('betRaw',51),('maxSteps',3),('wmsGameId',20442),('runtimeGameId',20150)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**p,k:v})
 def test_money_reactor_award_sum_and_terminal_drop_are_all_required(self):
  for a,b in [('totalWin="4"', 'totalWin="5"'), ('cluster_awards="1|1|1|1"', 'cluster_awards="1|1|1|2"'), ('num_drops="2"', 'num_drops="3"'), ('drop_order="1"', 'drop_order="2"')]:
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
 def test_unknown_reactor_clusters_positions_and_nodes_fail_closed(self):
  for a,b in [('freeSpin="N"', 'freeSpin="Y"'), ('bonusAwarded="N"', 'bonusAwarded="Y"'), ('paylineCount="0"', 'paylineCount="1"'), ('stake="50"', 'stake="51"'), ('maxWin="false"', 'maxWin="true"'), ('cappedWins="0"', 'cappedWins="1"'), ('maxWinValue="25000000"', 'maxWinValue="24000000"'), ('num_drops="2"', 'num_drops="3"'), ('drop_order="1"', 'drop_order="2"'), ('num_clusters="1"', 'num_clusters="2"'), ('cluster_awards="1|1|1|1"', 'cluster_awards="1|1|1|999"'), ('cluster_positions="4,3|5,3|5,4|5,5"', 'cluster_positions="4,3|5,3|5,4|6,5"'), ('rootSymbol="4"', 'rootSymbol="15"'), ('rootSymbolPos="0,0"', 'rootSymbolPos="5,5"'), ('watermark="0"', 'watermark="4"'), ('totalWin="4"', 'totalWin="5"'), ('spinWins="0"', 'spinWins="4"'), ('<ReactorChain', '<Feature index="0"><FS_Info fsAwarded="8"/></Feature><ReactorChain'), ('</GameResult>', '<Unknown/></GameResult>'), ('<CurrencyMultiplier>1</CurrencyMultiplier>', '<CurrencyMultiplier>2</CurrencyMultiplier>'), ('4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4', '4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4')]:
   r=raw();r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
  with self.assertRaises(FieldError):request(payload('Logic','first',True).replace('total="50"','total="51"'),'Logic',True)
 def test_init_capability_is_not_paid_or_feature_admission(self):
  q=payload('Init','first');p=text('Init','rotated',1000,'<GameInfo><Stakes>50|100|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',q,p,1000)
  self.assertEqual(bootstrap(s,'first'),dict(validated=True,session='rotated',balanceRaw=1000))
  for a,b in [('50|100|','49|100|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   t=copy.deepcopy(s);t['responsePayload']=t['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(t,'first')
 def test_missing_or_tampered_wiring_proof_never_admits_plan(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());p=reg['plans']['32758'];original=Path.read_text
  for kind in ('missing','hash','count','not_verified','records','raws','credit','rejected','source_constructor','sample_count','type_credit','policy'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32758']
   if kind=='missing':proof.pop('wiringEvidence')
   elif kind=='hash':proof['wiringEvidence']['evidenceHash']='a'*64
   elif kind=='records':
    proof['wiringEvidence']['fullRecordsHash']='a'*64
   elif kind=='raws':proof['acceptedRawHashes'][0]='a'*64
   elif kind=='credit':proof['wiringEvidence']['failedOrHistoricalRoundsCredited']=1
   elif kind=='rejected':proof['rejectedHistoricalPrefixes'][0]['rawHash']='a'*64
   elif kind=='source_constructor':proof['wiringEvidence']['ownSourcePayloadSemanticHash']='a'*64
   elif kind=='sample_count':proof['sampledRounds']=999
   elif kind=='type_credit':proof['wiringEvidence']['acceptedFreeRounds']=1
   elif kind=='policy':proof['wiringEvidence']['ordinaryContractHash']='a'*64
   else:
    proof['wiringEvidence']['sourceRoutesValidated' if kind=='count' else 'actualRecordAndVerifyIpc']=1987 if kind=='count' else False
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   if kind not in ('missing','hash'):
    value=proof['wiringEvidence'];value['evidenceHash']=digest({k:v for k,v in value.items() if k!='evidenceHash'})
   def read(current,*args,**kwargs):return json.dumps(bad) if current==path else original(current,*args,**kwargs)
   with self.subTest(kind=kind),patch.object(Path,'read_text',read):
    with self.assertRaises(Rejected):validate_rolling_plan(p)
if __name__=='__main__':unittest.main()
