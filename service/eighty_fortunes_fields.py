"""Independent WMS decoder for 88 Fortunes, including its deferred trigger award."""
from pearl_fields import parse,one
from round_fields import amount,check,VERSION,type_profile
SOURCE='eightyeightfortunes-deferred-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='eightyeightfortunes',gameID='20077',
 glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE=dict(fixtureOnly=False,protocol='wms',adapter='eighty-fortunes-wms-v1',mode='demo',buy=0,betRaw=176,
 baseBonus=0,freeTypes={'ten-free-deferred-trigger880':1},featureTypes={'fu-bat-type0-or1-fixed-shape':1},
 evidence=dict(captureGameId=32750,runtimeGameId=32972,wmsGameId=20077,
  historyFileSha256='4d0715cb7c6b9569aeefc6c94751701c21dfdb3184a287588238ab94c55bf669',
  fullFreeProbeSha256='1876bda693a79a8a4a0324240913657f1d3c806edc0f5d4a5950a04705f25188',
  fullBaseRounds=992,fullJackpotRounds=4,fullFreeRounds=1,rejectedPartialFreeRounds=4))
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake creditBet betMultiplier waysCount totalWin betID','ReelResults Feature GameWinInfo GameRtpInfo BaseGameRecoveryInfo'),
 'ReelResults':('numSpins','ReelSpin'),'ReelSpin':('reelsetIndex anywayWinCount scatterWinCount totalWayWin totalScatterWin totalSpinWin freeSpin bonusAwarded','ReelStops AnywayWin ScatterWin'),
 'ReelStops':('',''),'AnywayWin':('winIndex winVal ways awardIndex',''),'ScatterWin':('winIndex winVal awardIndex',''),
 'Feature':('index name','data'),'data':('totalFreeSpinsWin remainingFreeSpins extraFreeSpinsAwarded freeSpinTriggerWin lastFreeSpin pickLength jackpotWin jackpotType',''),
 'GameWinInfo':('totalWagerWin totalBaseGameWin totalFreeSpinsWin maxWinValue isMaxWin',''),'GameRtpInfo':('targetedRtpValue',''),'BaseGameRecoveryInfo':('','GameResult')}
def shape(n,schema=SCHEMA):
 spec=schema.get(n.tag);check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'EIGHTY_FEATURE_NOT_ADAPTED')
 for c in n:shape(c,schema)
def structure(n):return n.tag,n.attrib,n.text or '',[structure(c) for c in n]
def keys(n,names):check(set(n.attrib)==set(names.split()),'EIGHTY_FEATURE_SHAPE')
def request(payload,msg,first=False):
 q=parse(payload);h=one(q,'Header');check(q.tag=='GameRequest' and q.attrib=={'type':msg},'EIGHTY_REQUEST_MISMATCH')
 check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'EIGHTY_REQUEST_MODE')
 session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
 if first:
  check(msg=='Logic' and [n.tag for n in q]==['Header','AccountData','SpinInfo'],'EIGHTY_REQUEST_MODE')
  a=one(q,'AccountData');c=one(a,'CurrencyMultiplier');s=one(q,'SpinInfo')
  check(not a.attrib and len(a)==1 and not c.attrib and not len(c) and c.text=='1' and s.attrib==dict(creditBet='88',betMultiplier='2') and not len(s),'EIGHTY_REQUEST_MODE')
 else:check(msg in ('Init','Logic','EndGame') and [n.tag for n in q]==['Header'],'EIGHTY_REQUEST_MODE')
 return session
def response(payload,msg):
 root=parse(payload);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20077'
  and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
 session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
 b=one(root,'Balances');c=one(b,'Balance');check(len(b)==1 and c.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
 return root,session,amount(c.get('value'))
def bootstrap(step,session):
 check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'EIGHTY_REQUEST_MISMATCH')
 check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
 root,value,balance=response(step['responsePayload'],'Init');shape(root,{**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
  'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')})
 stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
 check(len(stakes)==1 and 176 in [amount(x) for x in (stakes[0].text or '').split('|') if x] and len(pages)<=1
  and (not pages or amount(pages[0].get('pageCount'))<=1),'EIGHTY_INIT_REQUIRES_REVIEW')
 check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH');return dict(validated=True,session=value,balanceRaw=balance)
def mapping_hash():
 profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def reels(g,first,free,feature):
 r=one(g,'ReelResults');s=one(r,'ReelSpin');check(r.get('numSpins')=='1' and len(r)==1 and s.get('reelsetIndex')==('4' if first else '9')
  and s.get('freeSpin')==('Y' if free and first else 'N') and s.get('bonusAwarded')==('Y' if first and feature else 'N'),'EIGHTY_REEL_STATE_MISMATCH')
 stops=one(s,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==5,'EIGHTY_REEL_STATE_MISMATCH')
 for v in stops.text.split('|'):amount(v)
 totals={}
 for tag,count in [('AnywayWin','anywayWinCount'),('ScatterWin','scatterWinCount')]:
  wins=[n for n in s if n.tag==tag];check(len(wins)==amount(s.get(count)) and len(wins)<=(3 if tag=='AnywayWin' else 1),'EIGHTY_REEL_WIN_MISMATCH');total=0
  for i,n in enumerate(wins):
   check(amount(n.get('winIndex'))==i and not len(n),'EIGHTY_REEL_WIN_MISMATCH')
   if tag=='AnywayWin':check(amount(n.get('awardIndex'))<=46 and amount(n.get('ways')) in (1,2,3,4,6,8,9,12),'EIGHTY_REEL_WIN_NOT_REVIEWED')
   else:check(amount(n.get('awardIndex')) in (48,49,50) and n.get('winVal')=='0','EIGHTY_REEL_WIN_NOT_REVIEWED')
   total+=amount(n.get('winVal'));amount(total)
  totals[tag]=total
 check(amount(s.get('totalWayWin'))==totals['AnywayWin'] and amount(s.get('totalScatterWin'))==totals['ScatterWin']
  and amount(s.get('totalSpinWin'))==sum(totals.values()),'EIGHTY_REEL_WIN_MISMATCH');return sum(totals.values())
def review(raw):
 check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'EIGHTY_PROFILE_REQUIRED')
 steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=12,'INVALID_ROUND_STEPS');start=balance=amount(raw.get('startBalanceRaw'))
 win=base=trigger=0;left=session=None;next_msg='Logic';kind='none';first_result=None
 for i,step in enumerate(steps):
  check(next_msg is not None and step.get('msgId')==next_msg,'EIGHTY_SEQUENCE_MISMATCH');prior=request(step.get('requestPayload'),next_msg,i==0)
  check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH');check(step.get('responsePayload')==step.get('responseXml')
   and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
  root,session,cash=response(step['responsePayload'],next_msg);shape(root)
  if next_msg=='EndGame':
   check(i==len(steps)-1 and not any(n.tag=='GameResult' for n in root),'EIGHTY_ENDGAME_MISMATCH');next_msg=None
  else:
   g=one(root,'GameResult');check(g.get('stake')=='176' and g.get('creditBet')=='88' and g.get('betMultiplier')=='2' and g.get('waysCount')=='243' and g.get('betID')=='','EIGHTY_WAGER_MISMATCH')
   award=amount(g.get('totalWin'));features=g.findall('Feature');check(len(features)<=1,'EIGHTY_FEATURE_SHAPE')
   if i==0:
    base=award;balance-=176;amount(balance);first_result=g
    if features:kind={'FreeGame':'freeGame','BG_FuBat_Jackpot':'feature'}.get(features[0].get('name'),'unreviewed')
    check(kind!='unreviewed','EIGHTY_FEATURE_NOT_ADAPTED')
   else:check(kind=='freeGame','EIGHTY_SEQUENCE_MISMATCH')
   jackpot=0
   if kind=='freeGame':
    f=one(g,'Feature');d=one(f,'data');check(f.attrib==dict(index='1',name='FreeGame') and len(f)==1,'EIGHTY_FEATURE_SHAPE')
    keys(d,'totalFreeSpinsWin remainingFreeSpins extraFreeSpinsAwarded freeSpinTriggerWin lastFreeSpin');remaining=amount(d.get('remainingFreeSpins'))
    check(d.get('extraFreeSpinsAwarded')=='0' and remaining==(10 if i==0 else left-1) and d.get('lastFreeSpin')==('Y' if remaining==0 else 'N'),'EIGHTY_FREE_COUNTER_MISMATCH')
    if i==0:
     trigger=amount(d.get('freeSpinTriggerWin'));check(trigger in (880,1760),'EIGHTY_FREE_TRIGGER_NOT_REVIEWED')
    else:
     check(d.get('freeSpinTriggerWin')=='0','EIGHTY_FREE_COUNTER_MISMATCH')
     if i==1:balance+=trigger
     ref=one(g,'BaseGameRecoveryInfo');old=one(ref,'GameResult');check(len(ref)==1 and old.attrib==first_result.attrib
      and [n.tag for n in old]==['ReelResults'] and structure(one(old,'ReelResults'))==structure(one(first_result,'ReelResults')),'EIGHTY_RECOVERY_REFERENCE_MISMATCH')
    left=remaining;check(amount(d.get('totalFreeSpinsWin'))==win+award+trigger-base,'EIGHTY_CUMULATIVE_WIN_MISMATCH')
   elif kind=='feature':
    f=one(g,'Feature');d=one(f,'data');check(i==0 and f.attrib==dict(index='2',name='BG_FuBat_Jackpot') and len(f)==1,'EIGHTY_FEATURE_SHAPE')
    keys(d,'pickLength jackpotWin jackpotType');check((d.get('pickLength'),d.get('jackpotWin'),d.get('jackpotType')) in [('7','4000','0'),('8','4000','0'),('9','7500','1')],'EIGHTY_JACKPOT_NOT_REVIEWED');jackpot=amount(d.get('jackpotWin'))
   else:check(i==0 and not features,'EIGHTY_FEATURE_SHAPE')
   check((i==0 or kind!='freeGame') and not g.findall('BaseGameRecoveryInfo') or i>0 and kind=='freeGame','EIGHTY_RECOVERY_REFERENCE_MISMATCH')
   check(reels(g,i==0,kind=='freeGame',kind!='none')+jackpot==award,'EIGHTY_REEL_WIN_MISMATCH');win+=award;balance+=award;amount(win);amount(balance)
   wi=one(g,'GameWinInfo');check(wi.get('isMaxWin')=='N' and wi.get('maxWinValue')=='25000000' and amount(wi.get('totalWagerWin'))==win+trigger
    and amount(wi.get('totalBaseGameWin'))==base and amount(wi.get('totalFreeSpinsWin'))==(win+trigger-base if kind=='freeGame' else 0),'EIGHTY_CUMULATIVE_WIN_MISMATCH')
   check(one(g,'GameRtpInfo').attrib=={'targetedRtpValue':'96.00'},'EIGHTY_RESPONSE_MODE')
   if kind=='freeGame' and left==0:check(trigger==880,'EIGHTY_UNREVIEWED_FREE_TERMINAL')
   next_msg='Logic' if kind=='freeGame' and left>0 else 'EndGame'
  check(cash==balance and amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
 return dict(next=next_msg,session=session,kind=kind,start=start,balance=balance,win=win+trigger)
def settled(raw,mapping):
 s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==176,'INCOMPLETE_ROUND')
 check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
 return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=1.76,mul=s['win']/176,buy=0,bonus=int(s['kind']!='none'),
  primaryBonusKind=s['kind'],typeMappingHash=mapping,money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=176))
class EightyFortunesFields:
 def __init__(self,plan):
  check(plan.get('gameId')==32750 and plan.get('runtimeGameId')==32972 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='eighty-fortunes-wms-v1'
   and plan.get('betRaw')==176 and plan.get('buy')==0 and plan.get('maxSteps')==12,'EIGHTY_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
 def next_request(self,raw):
  msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
 def validate_intent(self,raw,payload):
  s=review(raw);check(s['next'] is not None,'EIGHTY_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
  check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
 def bootstrap(self,step,session):return bootstrap(step,session)
 def settled(self,raw):return settled(raw,mapping_hash())
