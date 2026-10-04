import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from unittest.mock import patch
from eighty_fortunes_fields import SOURCE,HEADER,review,settled,bootstrap,mapping_hash
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import digest,Rejected
def payload(msg,session,first=False):
 h='<Header '+''.join(f'{k}="{v}" ' for k,v in {**HEADER,'sessionID':session}.items())+'/>'
 return '<GameRequest type="'+msg+'">'+h+('<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><SpinInfo creditBet="88" betMultiplier="2"/>' if first else '')+'</GameRequest>'
def text(msg,s,cash,body=''):return f'<GameResponse type="{msg}"><Header gameID="20077" versionID="1_0" isRecovering="N" sessionID="{s}"/><Balances><Balance name="CASH_BALANCE" value="{cash}"/></Balances>{body}</GameResponse>'
ATTR='stake="176" creditBet="88" betMultiplier="2" waysCount="243" totalWin="0" betID=""'
def reels(first,free):return f'<ReelResults numSpins="1"><ReelSpin reelsetIndex="{4 if first else 9}" anywayWinCount="0" scatterWinCount="0" totalWayWin="0" totalScatterWin="0" totalSpinWin="0" freeSpin="{"Y" if first and free else "N"}" bonusAwarded="{"Y" if first and free else "N"}"><ReelStops>1|2|3|4|5</ReelStops></ReelSpin></ReelResults>'
def info(win):return f'<GameWinInfo totalWagerWin="{win}" totalBaseGameWin="0" totalFreeSpinsWin="{win}" maxWinValue="25000000" isMaxWin="N"/><GameRtpInfo targetedRtpValue="96.00"/>'
def step(msg,q,p,cash):return dict(msgId=msg,requestPayload=q,responsePayload=p,responseXml=p,responseBalance=cash,elapsedMs=0)
def free_raw(trigger=880):
 raw=dict(fixtureOnly=False,protocol='wms',sourceKey=SOURCE,roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=10000,steps=[])
 for i in range(11):
  f=f'<Feature index="1" name="FreeGame"><data totalFreeSpinsWin="{trigger}" remainingFreeSpins="{10-i}" extraFreeSpinsAwarded="0" freeSpinTriggerWin="{trigger if i==0 else 0}" lastFreeSpin="{"Y" if i==10 else "N"}"/></Feature>'
  ref=f'<BaseGameRecoveryInfo><GameResult {ATTR}>{reels(True,True)}</GameResult></BaseGameRecoveryInfo>' if i else ''
  body=f'<GameResult {ATTR}>{reels(i==0,True)}{f}{info(trigger)}{ref}</GameResult>';cash=9824+(trigger if i else 0)
  raw['steps'].append(step('Logic',payload('Logic','s'+str(i),i==0),text('Logic','s'+str(i+1),cash,body),cash))
 cash=9824+trigger;raw['steps'].append(step('EndGame',payload('EndGame','s11'),text('EndGame','end',cash),cash));return raw
class EightyFortunesTests(unittest.TestCase):
 def test_deferred_trigger_once_independent_full_derivation(self):
  r=free_raw();self.assertEqual(review({**r,'steps':r['steps'][:1]})['balance'],9824);self.assertEqual(review({**r,'steps':r['steps'][:2]})['balance'],10704)
  f=settled(r,mapping_hash());self.assertEqual(f,derive(r));self.assertEqual((f['bet'],f['bonus'],f['money']['totalWinRaw']),(1.76,1,880))
 def test_old_early_end_or_missing_confirm_never_complete(self):
  r=free_raw();r['steps']=[r['steps'][0],step('EndGame',payload('EndGame','s1'),text('EndGame','end',9824),9824)]
  with self.assertRaisesRegex(FieldError,'SEQUENCE'):review(r)
  r=free_raw()
  with self.assertRaisesRegex(FieldError,'INCOMPLETE'):settled({**r,'steps':r['steps'][:-1]},mapping_hash())
 def test_unseen1760_terminal_not_inferred_from880_evidence(self):
  r=free_raw(1760);self.assertEqual(review({**r,'steps':r['steps'][:2]})['next'],'Logic')
  with self.assertRaisesRegex(FieldError,'UNREVIEWED_FREE_TERMINAL'):review(r)
 def test_counter_extra_award_and_original_reference_must_match(self):
  for i,a,b in [(1,'remainingFreeSpins="9"','remainingFreeSpins="8"'),(1,'extraFreeSpinsAwarded="0"','extraFreeSpinsAwarded="1"'),(1,'freeSpinTriggerWin="0"','freeSpinTriggerWin="880"'),
    (1,'<BaseGameRecoveryInfo><GameResult stake="176"','<BaseGameRecoveryInfo><GameResult stake="177"')]:
   r=free_raw();r['steps'][i]['responsePayload']=r['steps'][i]['responseXml']=r['steps'][i]['responseXml'].replace(a,b)
   with self.assertRaises(FieldError):review(r)
 def test_money_session_and_unknown_shapes_do_not_continue(self):
  r=free_raw();r['steps'][1]['responseBalance']+=1
  with self.assertRaisesRegex(FieldError,'BALANCE'):review(r)
  r=free_raw();r['steps'][1]['requestPayload']=payload('Logic','wrong')
  with self.assertRaisesRegex(FieldError,'SESSION'):review(r)
  r=free_raw();r['steps'][0]['responsePayload']=r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace('</GameResult>','<Unknown/></GameResult>')
  with self.assertRaises(FieldError):review(r)
 def test_init_requires_own_capability_without_granting_feature_permission(self):
  p=text('Init','next',10000,'<GameInfo><Stakes>176|352|</Stakes><PageInfo pageCount="1"/></GameInfo>');s=step('Init',payload('Init','first'),p,10000)
  self.assertEqual(bootstrap(s,'first')['balanceRaw'],10000)
  for a,b in [('176|352|','175|352|'),('pageCount="1"','pageCount="2"'),('isRecovering="N"','isRecovering="Y"'),('</GameResponse>','<GameResult/></GameResponse>')]:
   bad=copy.deepcopy(s);bad['responsePayload']=bad['responseXml']=p.replace(a,b)
   with self.assertRaises(FieldError):bootstrap(bad,'first')
 def test_missing_tampered_or_scope_changed_immutable_proof_rejected(self):
  path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';reg=json.loads(path.read_text());plan=reg['plans']['32750'];self.assertEqual(validate_rolling_plan(plan),plan);original=Path.read_text
  for key,value in [('wmsGameId',20442),('runtimeGameId',20077),('maxSteps',13),('betRaw',177)]:
   with self.assertRaises(Rejected):validate_rolling_plan({**plan,key:value})
  for kind in ('missing','hash','counts','not_verified'):
   bad=copy.deepcopy(reg);proof=bad['proofs']['32750']
   if kind=='missing':proof.pop('wiringEvidence')
   elif kind=='hash':proof['wiringEvidence']['evidenceHash']='a'*64
   else:
    proof['wiringEvidence']['rejectedPartialFreeRounds' if kind=='counts' else 'actualRecordAndVerifyIpc']=0 if kind=='counts' else False
    v=proof['wiringEvidence'];v['evidenceHash']=digest({k:v for k,v in v.items() if k!='evidenceHash'})
   def read(current,*args,**kwargs):return json.dumps(bad) if current==path else original(current,*args,**kwargs)
   with patch.object(Path,'read_text',read):
    with self.assertRaises(Rejected):validate_rolling_plan(plan)
if __name__=='__main__':unittest.main()
