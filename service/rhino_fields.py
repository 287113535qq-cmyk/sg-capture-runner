"""Offline, original-XML Raging Rhino boundary. No networking or source permission."""
import xml.etree.ElementTree as E,re
from round_fields import check, VERSION, type_profile
SOURCE="ragingrhino-wms-v1"
def need(v,code):
 check(v,'RHINO_'+code)
def uint(v):
 need(isinstance(v,(int,str)) and re.fullmatch(r'(0|[1-9][0-9]*)',str(v)),'INVALID_INTEGER');n=int(v);need(n<=2**53-1,'UNSAFE_INTEGER');return n
def one(n,tag):
 a=n.findall(tag);need(len(a)==1,'XML_STRUCTURE');return a[0]
def xml(s):
 need(isinstance(s,str) and 0<len(s)<262144 and not re.search(r'<!DOCTYPE|<!ENTITY',s,re.I),'XML_INVALID');return E.fromstring(s)
SCHEMA={
 'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake totalWin betID betMultiplier creditBet waysCount','ReelResults GameWinInfo GameRtpInfo Feature BaseGameRecoveryInfo'),
 'ReelResults':('numSpins','ReelSpin'),'ReelSpin':('anywayWinCount bonusAwarded freeSpin reelsetIndex scatterWinCount totalScatterWin totalSpinWin totalWayWin','ReelStops AnywayWin ScatterWin'),
 'ReelStops':('',''),'AnywayWin':('awardIndex ways winIndex winVal',''),'ScatterWin':('awardIndex winIndex winVal',''),
 'GameWinInfo':('isMaxWin maxWinValue totalBaseGameWin totalFreeSpinsWin totalWagerWin',''),'GameRtpInfo':('targetedRtpValue',''),
 'Feature':('index name','data'),'data':('extraFreeSpinsAwarded freeSpinsTriggerWin lastFreeSpin multiplier remainingFreeSpins totalFreeSpinsTriggered',''),
 'BaseGameRecoveryInfo':('','GameResult')}
def shape(n):
 need(n.tag in SCHEMA,'UNKNOWN_FEATURE');a,c=SCHEMA[n.tag];need(set(n.attrib)<=set(a.split()) and all(x.tag in c.split() for x in n),'UNKNOWN_FEATURE')
 for x in n:shape(x)
def review(raw,legacy=False):
 need(raw.get('sourceKey')=='ragingrhino-wms-v1' and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'PROFILE')
 steps=raw.get('steps');need(isinstance(steps,list) and len(steps)<=1026,'STEP_LIMIT');balance=start=uint(raw['startBalanceRaw']);win=0;session=None;identity=None;free=None;total=0;first=0;next='Logic';retriggers=0
 for i,s in enumerate(steps):
  if not legacy:request(s['requestPayload'],next)
  need(next is not None and s['msgId']==next,'SEQUENCE');q=xml(s['requestPayload']);need(q.tag=='GameRequest' and q.attrib=={'type':next},'REQUEST')
  header=one(q,'Header');h=header.attrib;need(set(h)==set('affiliate ccyCode channel freePlay gameCodeRGI gameID glsID lang promotions sessionID userID userType versionID'.split()) and len(header)==0,'REQUEST')
  mode={'freePlay':'Y','gameID':'20124','gameCodeRGI':'ragingrhino_prt','versionID':'1_0','promotions':'N','channel':'I','lang':'en_US','userType':'C'}
  need(all(h.get(k)==v for k,v in mode.items()),'REQUEST_MODE');need(0<len(h.get('sessionID',''))<=1024,'SESSION')
  ident={k:v for k,v in h.items() if k!='sessionID'};need(identity is None or identity==ident,'IDENTITY');identity=ident
  need(session is None or h['sessionID']==session,'SESSION');tags=[n.tag for n in q]
  if next=='EndGame' or legacy and i>0 and tags==['Header']:need(tags==['Header'],'REQUEST')
  else:
   need(sorted(tags)==['AccountData','Header','WagerInfo'] and one(q,'WagerInfo').attrib=={'betMultiplier':'1'},'WAGER')
   a=one(q,'AccountData');need(not a.attrib,'REQUEST');need(legacy and not len(a) or one(a,'CurrencyMultiplier').text=='1','CURRENCY')
  need(uint(s.get('elapsedMs'))<=300000,'TIMING');root=xml(s['responseXml']);need(E.tostring(root)==E.tostring(xml(s['responsePayload'])),'XML_EVIDENCE');shape(root)
  need(root.tag=='GameResponse' and root.attrib=={'type':next},'RESPONSE');rh=one(root,'Header').attrib
  need(rh.get('gameID')=='20124' and rh.get('versionID')=='1_0' and rh.get('isRecovering')=='N','RESPONSE_IDENTITY');session=rh.get('sessionID');need(isinstance(session,str) and 0<len(session)<=1024,'SESSION')
  if next=='EndGame':need(i==len(steps)-1 and not root.findall('GameResult'),'END');next=None
  else:
   g=one(root,'GameResult');need(all(g.get(k)==v for k,v in {'stake':'40','creditBet':'40','betMultiplier':'1','waysCount':'4096'}.items()),'WAGER');award=uint(g.get('totalWin'))
   if i==0:balance-=40;first=award
   balance+=award;win+=award;uint(balance);uint(win)
   if i==0:base_attrs=dict(g.attrib);base_reels=E.tostring(one(g,'ReelResults'))
   recovery=g.findall('BaseGameRecoveryInfo');need(len(recovery)<=1 and (not recovery or i>0),'BASE_RECOVERY')
   if recovery:
    b=one(recovery[0],'GameResult');need(len(recovery[0])==1 and len(b)==1 and b.attrib==base_attrs and E.tostring(one(b,'ReelResults'))==base_reels,'BASE_RECOVERY')
   info=one(g,'GameWinInfo');need(info.get('isMaxWin')=='N','FEATURE');need(uint(info.get('totalBaseGameWin'))==first and uint(info.get('totalFreeSpinsWin'))==win-first and uint(info.get('totalWagerWin'))==win,'TOTAL')
   features=g.findall('Feature');need(len({n.get('index') for n in features})==len(features),'FEATURE_DUPLICATE');fs=[n for n in features if n.get('index')=='1']
   if free is None:free=bool(fs)
   for f in features:
    need(len(f)==1,'FEATURE');d=one(f,'data')
    if f.get('index')=='1':need(f.get('name')=='FreeSpins','FEATURE')
    else:
     need(f.attrib=={'index':'2','name':'WildInfo'} and set(d.attrib)=={'multiplier'} and i>0 and free,'FEATURE')
     values=d.get('multiplier').split(',');need(all(re.fullmatch(r'(0|[1-9][0-9]*)\|[23]',v) and int(v.split('|')[0])<24 for v in values) and len(set(v.split('|')[0] for v in values))==len(values),'WILD_MULTIPLIER')
   if free:
    need(len(fs)==1,'FREE_FEATURE');d=one(fs[0],'data');added=uint(d.get('totalFreeSpinsTriggered')) if i==0 else uint(d.get('extraFreeSpinsAwarded'))
    need((i==0 and d.attrib.keys()=={'freeSpinsTriggerWin','totalFreeSpinsTriggered','lastFreeSpin'}) or (i>0 and set(d.attrib)=={'totalFreeSpinsTriggered','remainingFreeSpins','extraFreeSpinsAwarded','freeSpinsTriggerWin','lastFreeSpin'}),'FREE_SHAPE')
    uint(d.get('freeSpinsTriggerWin'));need(i==0 or i<=total,'FREE_AFTER_END');need((i>0 or added>0) and added<=1024,'RETRIGGER');total+=added;retriggers+=int(i>0 and added>0)
    need(total<=1024 and uint(d.get('totalFreeSpinsTriggered'))==total,'FREE_TOTAL');pending=i<total
    need(d.get('lastFreeSpin')==('N' if pending else 'Y'),'FREE_TERMINAL')
    if i:need(uint(d.get('remainingFreeSpins'))==total-i,'FREE_REMAINING')
   else:need(i==0 and not features,'BASE_FEATURE');pending=False;added=0
   reels=one(g,'ReelResults');spins=reels.findall('ReelSpin');need(uint(reels.get('numSpins'))==len(spins)==1,'REELS');spin=spins[0]
   need(spin.get('freeSpin')==('Y' if i else 'N') and spin.get('bonusAwarded')==('Y' if added else 'N'),'FREE_FLAG')
   need(uint(spin.get('totalSpinWin'))==award and uint(spin.get('totalScatterWin'))+uint(spin.get('totalWayWin'))==award,'REEL_MONEY')
   need(len(spin.findall('AnywayWin'))==uint(spin.get('anywayWinCount')) and len(spin.findall('ScatterWin'))==uint(spin.get('scatterWinCount')),'WIN_COUNT')
   need(sum(uint(n.get('winVal')) for n in spin.findall('AnywayWin'))==uint(spin.get('totalWayWin')) and sum(uint(n.get('winVal')) for n in spin.findall('ScatterWin'))==uint(spin.get('totalScatterWin')),'WIN_MONEY')
   next='Logic' if pending else 'EndGame'
  b=one(root,'Balances');need(len(b)==1 and one(b,'Balance').get('name')=='CASH_BALANCE' and uint(one(b,'Balance').get('value'))==balance and uint(s['responseBalance'])==balance,'BALANCE')
 return {'next':next,'session':session,'start':start,'end':balance,'win':win,'betRaw':40,'bonus':int(bool(free)),'retriggers':retriggers}


def request(payload,msg):
 q=xml(payload);need(q.tag=='GameRequest' and q.attrib=={'type':msg},'REQUEST')
 h=one(q,'Header');need(len(h)==0 and set(h.attrib)==set('affiliate ccyCode channel freePlay gameCodeRGI gameID glsID lang promotions sessionID userID userType versionID'.split()),'REQUEST')
 mode={'freePlay':'Y','gameCodeRGI':'ragingrhino_prt','gameID':'20124','versionID':'1_0','promotions':'N','channel':'I','lang':'en_US','userType':'C'}
 need(all(h.get(k)==v for k,v in mode.items()) and 0<len(h.get('sessionID',''))<=1024,'REQUEST_MODE')
 if msg in ('Init','EndGame'):need([n.tag for n in q]==['Header'],'REQUEST')
 else:
  need(msg=='Logic' and sorted(n.tag for n in q)==['AccountData','Header','WagerInfo'],'REQUEST')
  w=one(q,'WagerInfo');a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
  need(w.attrib=={'betMultiplier':'1'} and len(w)==0 and not a.attrib and len(a)==1
       and not c.attrib and len(c)==0 and c.text=='1','WAGER')
 return h.attrib

class RhinoFields:
 def __init__(self,plan):
  need(plan.get('gameId')==32799 and plan.get('runtimeGameId')==33159 and plan.get('sourceKey')==SOURCE and plan.get('betRaw')==40,'PROFILE');self.plan=plan
 def next_request(self,raw):
  msg=review(raw)['next'];return {'MSGID':msg} if msg else None
 def bootstrap(self,step):
  request(step.get('requestPayload'),'Init');r=xml(step.get('responseXml'))
  need(ET_equivalent(r,xml(step.get('responsePayload'))),'XML_EVIDENCE')
  need(r.tag=='GameResponse' and r.attrib=={'type':'Init'},'MESSAGE')
  h=one(r,'Header');need(h.get('gameID')=='20124' and h.get('versionID')=='1_0' and h.get('isRecovering')=='N' and 0<len(h.get('sessionID',''))<=1024,'RESPONSE_IDENTITY')
  need(not any(n.tag in ('GameResult','BaseGameRecoveryInfo','Feature') for n in r.iter()),'INIT_REQUIRES_REVIEW')
  multipliers=list(r.iter('BetMultipliers'));credits=list(r.iter('CreditBets'));need(len(multipliers)==len(credits)==1,'INIT_REQUIRES_REVIEW')
  values=[uint(v) for v in (multipliers[0].text or '').split('|')]
  need(0<len(values)<=100 and 1 in values and uint(multipliers[0].get('defaultIndex'))<len(values) and credits[0].text=='40','INIT_REQUIRES_REVIEW')
  pages=list(r.iter('PageInfo'));need(len(pages)<=1 and (not pages or uint(pages[0].get('pageCount'))<=1),'INIT_REQUIRES_REVIEW')
  b=one(r,'Balances');need(len(b)==1 and one(b,'Balance').get('name')=='CASH_BALANCE' and uint(one(b,'Balance').get('value'))==uint(step.get('responseBalance')),'BALANCE')
  return {'validated':True}
 def validate_intent(self,raw,payload):
  s=review(raw);need(s['next'] is not None,'AFTER_END');h=request(payload,s['next'])
  need(s['session'] is None or s['session']==h['sessionID'],'SESSION')
  if raw['steps']:
   before=request(raw['steps'][0]['requestPayload'],'Logic')
   need({k:v for k,v in before.items() if k!='sessionID'}=={k:v for k,v in h.items() if k!='sessionID'},'IDENTITY')
  return {'validated':True}
 def settled(self,raw):
  s=review(raw);need(s['next'] is None and s['start']-s['end']+s['win']==40,'INCOMPLETE')
  profile,mapping_hash=type_profile(SOURCE)
  need(profile=={'fixtureOnly':False,'protocol':'wms','adapter':'rhino-wms-v1','gameId':32799,'betRaw':40,'buy':0,'ordinaryBonus':0,'freeBonus':1,'feature':'counter-driven-free-retrigger-v1'},'MAPPING')
  return {'roundFieldsVersion':VERSION,'protocol':'wms','sourceKey':SOURCE,'bet':0.4,'mul':s['win']/40,'buy':0,'bonus':s['bonus'],
   'primaryBonusKind':'freeGame' if s['bonus'] else 'none','money':{'startBalanceRaw':s['start'],'endBalanceRaw':s['end'],'totalWinRaw':s['win'],'betRaw':40},'typeMappingHash':mapping_hash}

def ET_equivalent(a,b):
 return E.tostring(a)==E.tostring(b)
