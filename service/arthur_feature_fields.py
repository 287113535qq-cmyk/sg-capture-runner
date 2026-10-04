"""Independent versioned Arthur Free/Wild fields. No network or storage writes."""
import json
from pathlib import Path
from pearl_fields import parse,one
from arthur_base_fields import HEADER,SOURCE,review as base_review,settled as base_settled,bootstrap,ArthurBaseFields,mapping_hash as base_mapping
from round_fields import amount,check,type_profile,VERSION
from store import digest,require
CONTRACT='wms-arthur-free-wild-evidence-v2'
FEATURE_MAPPING='arthurandtheroundtable-free-wild-ag-rolling-wms-v2'
PIN='e735f6ab2616ed7eb1f4e4044b634e00f80ac26559e1db19f02979171840072f'
def policy():
 p=json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-arthur-feature-contracts.json').read_bytes())
 policy_check(p);return p
def policy_check(p):
 check(p.get('policyHash')==digest({k:v for k,v in p.items() if k!='policyHash'})==PIN and p.get('contract')==CONTRACT and p.get('historicalCredit')==p.get('sourceAllowance')==0,'ARTHUR_FEATURE_POLICY_REQUIRED')

def shape(n,p,kind,path='GameResponse'):
 check([sorted(n.attrib),[c.tag for c in n]] in p['schemas'][kind].get(path,[]),'ARTHUR_OWN_SHAPE_REVIEW_REQUIRED')
 for c in n:shape(c,p,kind,path+'/'+c.tag)
def canonical(n):return [n.tag,dict(n.attrib),(n.text or '').strip(),[canonical(c) for c in n]]
def request(s,first,session):
 q=parse(s['requestPayload']);msg=s['msgId'];check(q.tag=='GameRequest' and q.attrib=={'type':msg},'ARTHUR_REQUEST_MISMATCH')
 h=one(q,'Header');check({k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER and not len(h),'ARTHUR_REQUEST_MODE')
 value=h.get('sessionID');check(isinstance(value,str) and 0<len(value)<=1024 and (session is None or value==session),'WMS_SESSION_CHAIN_MISMATCH')
 if first:
  check(msg=='Logic' and [n.tag for n in q]==['Header','Stake','PaylineCount','AccountData'],'ARTHUR_REQUEST_MISMATCH')
  check(one(q,'Stake').attrib=={'total':'200'} and not len(one(q,'Stake')) and one(q,'PaylineCount').attrib=={'count':'20'} and not len(one(q,'PaylineCount')),'ARTHUR_REQUEST_MODE')
  a=one(q,'AccountData');c=one(a,'CurrencyMultiplier');check(not a.attrib and len(a)==1 and not c.attrib and not len(c) and c.text=='1','ARTHUR_REQUEST_MODE')
 else:check(msg in ('Logic','EndGame') and [n.tag for n in q]==['Header'],'ARTHUR_REQUEST_MISMATCH')
 return value
def state(f,p):return [f.get(k,'0|0|0' if k in ('remainingFeatureSpins','prevActive','activeFeature') else '1' if k=='currentMultiplier' else '0') for k in p['stateKeys']]
def feature_audit(raw,p,require_complete=True):
 policy_check(p)
 check(raw.get('sourceKey')==SOURCE and raw.get('fixtureOnly') is False and raw.get('protocol')=='wms' and raw.get('roundFieldsVersion')=='sg-round-fields-v1','ARTHUR_PROFILE_REQUIRED')
 steps=raw.get('steps');check(isinstance(steps,list) and 0<len(steps)<=22,'INVALID_ROUND_STEPS')
 start=amount(raw['startBalanceRaw']);session=None;next_msg='Logic';total=0;bgwin=None;freewin=0;lastfs=None;lasttoken=None;firstreels=None;kind=None;traces=[];routes=[]
 for i,s in enumerate(steps):
  check(next_msg is not None and s.get('msgId')==next_msg,'ARTHUR_SEQUENCE_MISMATCH');request(s,i==0,session)
  check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
  root=parse(s['responsePayload']);check(root.tag=='GameResponse' and root.attrib=={'type':next_msg},'ARTHUR_RESPONSE_MISMATCH')
  header=one(root,'Header');session=header.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024 and header.get('gameID')=='20467' and header.get('versionID')=='1_0' and header.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
  if i==0:
   g=one(root,'GameResult');check(g.find('ExcaliburInfo') is None,'ARTHUR_EXCALIBUR_INCOMPLETE')
   kind='free' if g.find('FSInfo') is not None else 'wild';check(kind=='free' or g.find('WildInfo') is not None,'ARTHUR_FEATURE_CANDIDATE_REQUIRED')
  frame_kind='end' if next_msg=='EndGame' else 'trigger' if kind=='free' and i==0 else 'free' if i else 'wild'
  shape(root,p,frame_kind)
  if next_msg=='EndGame':
   check(i==len(steps)-1 and header.get('readyForEndGame')=='N' and len(root)==3,'ARTHUR_ENDGAME_MISMATCH');next_msg=None
  else:
   g=one(root,'GameResult');check(g.get('stake')=='200' and g.get('stakePerLine')=='10' and g.get('paylineCount')=='20' and g.get('betID')=='','ARTHUR_WAGER_MISMATCH')
   win=amount(g.get('totalWin'));reels=one(g,'ReelResults');spin=one(reels,'ReelSpin')
   check(reels.get('numSpins')=='1' and len(reels)==1 and spin.get('spinIndex')=='0','ARTHUR_REEL_STATE_MISMATCH')
   check(spin.get('reelsetIndex') in (('0',) if i==0 else ('2','3','4')) and spin.get('freeSpin')==('N' if i==0 else 'Y'),'ARTHUR_REEL_STATE_MISMATCH')
   stops=one(spin,'ReelStops');check(len((stops.text or '').split('|'))==5,'ARTHUR_REEL_STATE_MISMATCH')
   for value in stops.text.split('|'):amount(value)
   rows=(one(root,'SymbolGrids').text or '').split(';');check(len(rows)==3 and all(len(row.split('|'))==5 and all(amount(v) in p['symbols'] for v in row.split('|')) for row in rows),'ARTHUR_SYMBOL_REVIEW_REQUIRED')
   pays=spin.findall('PaylineWin');scatters=spin.findall('ScatterWin');indices=set();award_sum=0
   check(amount(spin.get('winCountPL'))==len(pays) and len(pays)<=11 and amount(spin.get('winCountSC'))<=1 and len(scatters)<=1,'ARTHUR_REEL_WIN_MISMATCH')
   multiplier=g.find('FSInfo').get('currentMultiplier','1') if g.find('FSInfo') is not None else '1'
   for line in pays:
    index=amount(line.get('index'));check(index<20 and index not in indices and line.get('awardTableIndex')=='0' and amount(line.get('awardIndex')) in p['paylineAwards'],'ARTHUR_PAYLINE_REVIEW_REQUIRED')
    check([multiplier,line.get('awardIndex'),line.get('winVal')] in p['paylineAwardValues'],'ARTHUR_PAYLINE_VALUE_REVIEW_REQUIRED')
    indices.add(index);award_sum+=amount(line.get('winVal'))
   for sc in scatters:check(sc.attrib==dict(awardIndex='0',winVal='0'),'ARTHUR_SCATTER_REVIEW_REQUIRED')
   check(award_sum==amount(spin.get('spinWins'))==win,'ARTHUR_REEL_WIN_MISMATCH')
   if i==0:bgwin=win;firstreels=canonical(reels)
   else:freewin+=win
   total+=win;amount(total);bg=one(g,'BGInfo');check(bg.get('isMaxWin')=='0' and amount(bg.get('bgWinnings'))==bgwin and amount(bg.get('totalWagerWin'))==total,'ARTHUR_CUMULATIVE_WIN_MISMATCH')
   if kind=='wild':
    check(i==0 and header.get('readyForEndGame')=='Y' and spin.get('bonusAwarded')=='N' and spin.get('winCountSC')=='0' and not scatters and one(g,'WildInfo').get('overlay') in p['wildOverlays'],'ARTHUR_WILD_REVIEW_REQUIRED');next_msg='EndGame'
   else:
    f=one(g,'FSInfo');number=amount(f.get('freeSpinNumber'));limit=amount(f.get('freeSpinsTotal'))
    check(number==i and number<=limit<=20 and amount(f.get('fsWinnings'))==freewin,'ARTHUR_FREE_COUNTER_MISMATCH')
    if i==0:
     wheel=one(g,'WheelInfo');check(wheel.get('featureType')=='0' and p['initialWheelFreeTotals'].get(wheel.get('index'))==limit and spin.get('bonusAwarded')=='Y' and spin.get('winCountSC')=='1' and len(scatters)==1,'ARTHUR_WHEEL_REVIEW_REQUIRED')
    else:
     extra=amount(f.get('extraSpinsAwarded'));check(extra in (0,3,5) and limit==amount(lastfs.get('freeSpinsTotal'))+extra and f.get('isMaxWin')=='0','ARTHUR_FREE_COUNTER_MISMATCH')
     token=one(g,'TokenInfo');check(all(amount(v)<=2 for v in token.attrib.values()),'ARTHUR_TOKEN_REVIEW_REQUIRED')
     check(all(token.get('prev'+k)==('0' if lasttoken is None else lasttoken.get('new'+k)) for k in ('Bronze','Silver','Golden')),'ARTHUR_TOKEN_CHAIN_MISMATCH')
     check(state(lastfs,p)+state(f,p)+[token.get(k) for k in p['tokenKeys']] in p['jointStateTransitions'],'ARTHUR_TOKEN_TRANSITION_REVIEW_REQUIRED')
     check(spin.get('bonusAwarded')==('Y' if extra else 'N') and spin.get('winCountSC')==str(int(bool(extra))) and not scatters,'ARTHUR_FREE_AWARD_MISMATCH')
     check(canonical(one(one(g,'BaseGameRecoveryInfo'),'ReelResults'))==firstreels,'ARTHUR_RECOVERY_REFERENCE_MISMATCH');lasttoken=token
    lastfs=f;check(header.get('readyForEndGame')==('N' if number<limit else 'Y'),'ARTHUR_SETTLEMENT_FLAG_MISMATCH');next_msg='Logic' if number<limit else 'EndGame'
  cash=one(one(root,'Balances'),'Balance');balance=start-200+total;amount(balance)
  check(cash.get('name')=='CASH_BALANCE' and amount(cash.get('value'))==amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
  traces.append(dict(frame=i,next=next_msg,totalWin=total,balance=balance));routes.append(dict(msg=s['msgId'],first=i==0))
 if require_complete:check(next_msg is None and start-balance+total==200,'ARTHUR_FEATURE_INCOMPLETE')
 return dict(kind=kind,complete=next_msg is None,next=next_msg,start=start,balance=balance,totalWin=total,freeWin=freewin,frames=len(steps),traces=traces,routes=routes,session=session)


def previous(plan):
 p={k:v for k,v in plan.items() if k not in ('arthurFeatureContract','arthurFeatureContractHash')}
 p['maxSteps']=2;return p
def binding(plan):
 p=policy();check(plan.get('arthurFeatureContract')==CONTRACT and plan.get('arthurFeatureContractHash')==PIN and plan.get('maxSteps')==22
  and digest(previous(plan))==p['previousPlanHash'],'ARTHUR_FEATURE_PLAN_REQUIRED');return p
def review(raw):
 marker=raw.get('arthurFeatureContract')
 if marker is None:return base_review(raw)
 check(marker==CONTRACT,'ARTHUR_FEATURE_MARKER_REQUIRED');p=policy()
 steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=22,'INVALID_ROUND_STEPS')
 if not steps:return base_review(raw)
 first=parse(steps[0]['responsePayload']);g=one(first,'GameResult')
 if not any(g.find(k) is not None for k in ('FSInfo','WildInfo','ExcaliburInfo')):return base_review(raw)
 return feature_audit(raw,p,False)
def mapping_hash():
 profile,h=type_profile(FEATURE_MAPPING);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def settled(raw,mapping=None):
 s=review(raw)
 if 'kind' not in s:return base_settled(raw,base_mapping())
 check(s['complete'] and s['next'] is None and s['start']-s['balance']+s['totalWin']==200,'ARTHUR_FEATURE_INCOMPLETE')
 h=mapping_hash();check(mapping is None or mapping==h,'WMS_MAPPING_REQUIRED')
 return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=2,mul=s['totalWin']/200,buy=0,bonus=1 if s['kind']=='free' else 0,primaryBonusKind='freeGame' if s['kind']=='free' else 'none',typeMappingHash=h,
  money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['totalWin'],betRaw=200))
class ArthurFeatureFields:
 def __init__(self,plan):self.plan=plan;binding(plan);base_mapping();mapping_hash()
 def next_request(self,raw):
  s=review(raw);return {'MSGID':s['next']} if s['next'] is not None else None
 def validate_intent(self,raw,payload):
  s=review(raw);check(s['next'] is not None,'ARTHUR_SEQUENCE_MISMATCH');request(dict(requestPayload=payload,msgId=s['next']),not raw['steps'],s['session']);return {'validated':True}
 def bootstrap(self,step,session):return bootstrap(step,session)
 def settled(self,raw):return settled(raw)
def fields_factory(plan):return ArthurFeatureFields(plan) if plan.get('arthurFeatureContract') is not None else ArthurBaseFields(plan)

TYPE_PROFILE={'fixtureOnly': False, 'protocol': 'wms', 'adapter': 'arthur-base-wms-v1', 'mode': 'demo', 'buy': 0, 'betRaw': 200, 'baseBonus': 0, 'freeTypes': {'free': 1}, 'evidence': {'captureGameId': 32754, 'runtimeGameId': 32976, 'wmsGameId': 20467, 'historyFileSha256': '2b798fbe1dd9728ce22df8df9371203bc34288d57f4aa64ea2d7bacc1d28aae3', 'fullFreeRounds': 6, 'fullWildRounds': 5, 'contractHash': 'e735f6ab2616ed7eb1f4e4044b634e00f80ac26559e1db19f02979171840072f'}}

WIRE_PIN='fda8170a2859ee8a0cffcd1634ffd0ade4742c455e9f78c685afe829ee5c3b1f'
REJECTED=[{'sampleIndex': 243, 'rawHash': 'c8d33c85a328e50f033702aea6238b7c0a57cfcc208bb278615cd11872bc70cc', 'error': 'ARTHUR_EXCALIBUR_INCOMPLETE'}, {'sampleIndex': 365, 'rawHash': '13b257c75cf96637a8646f71bc973812241bd57a898ef431631e87ba28d4c647', 'error': 'ARTHUR_EXCALIBUR_INCOMPLETE'}, {'sampleIndex': 902, 'rawHash': '69799ba05ee9587422edb53b650aaab0ea7e41304cfc0c1675f9233762b4e4bb', 'error': 'ARTHUR_EXCALIBUR_INCOMPLETE'}]
def validate_proof(plan,proof):
 p=binding(plan);e=proof.get('arthurFeatureEvidence',{});old=e.get('previousProof',{});wire=e.get('wiringEvidence',{})
 require(digest(old)==p['previousProofHash'] and old.get('planHash')==p['previousPlanHash']
  and proof.get('planHash')==digest(plan) and {k:v for k,v in proof.items() if k not in ('planHash','arthurFeatureEvidence')}=={k:v for k,v in old.items() if k!='planHash'}
  and e.get('previousPlanHash')==p['previousPlanHash'] and e.get('previousProofHash')==p['previousProofHash'] and e.get('contractHash')==PIN
  and e.get('acceptedOriginalRawSetHash')==wire.get('acceptedOriginalRawSetHash')
  and e.get('rejectedHistoricalPrefixes')==REJECTED
  and wire.get('evidenceHash')==digest({k:v for k,v in wire.items() if k!='evidenceHash'})==WIRE_PIN,
  'ARTHUR_FEATURE_WIRING_PROOF_REQUIRED')
