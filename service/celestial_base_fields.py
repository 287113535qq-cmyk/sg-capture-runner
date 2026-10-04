"""Independent, ordinary-only Celestial King WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
SOURCE='celestialking-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='celestialking',gameID='20210',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'celestial-base-wms-v1','mode':'demo','buy':0,'betRaw':100,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32756,'runtimeGameId':32978,'wmsGameId':20210,
 'historyFileSha256':'9f3da6af4e7b8e8375bba0f3512273726995b5c134b95f9a796c834f871190f0','fullBaseRounds':994,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo'),'ReelResults':('numSpins','WildIndex ReelSpin'),
 'WildIndex':('',''),'ReelSpin':('spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin'),
 'ReelStops':('',''),'PaylineWin':('index winVal awardIndex awardTableIndex',''),'BGInfo':('totalWagerWin bgWinnings baseGameSpinsRemaining isMaxWin','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'CELESTIAL_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'CELESTIAL_REQUEST_MISMATCH')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'CELESTIAL_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['AccountData','Header','Stake'],'CELESTIAL_REQUEST_MISMATCH')
        check(stake.attrib==dict(total='100',lines='30') and not len(stake),'CELESTIAL_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and len(a)==1 and not c.attrib and not len(c) and c.text=='1','CELESTIAL_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'CELESTIAL_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20210'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'CELESTIAL_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 100 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'CELESTIAL_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'CELESTIAL_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'CELESTIAL_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and [n.tag for n in root]==['Header','AccountData','Balances'] and not any(n.tag=='GameResult' for n in root),'CELESTIAL_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult'],'CELESTIAL_SEQUENCE_MISMATCH');g=one(root,'GameResult');check([n.tag for n in g]==['ReelResults','BGInfo'],'CELESTIAL_FEATURE_NOT_ADAPTED')
            check(g.get('stake')=='100' and g.get('stakePerLine')=='3' and g.get('paylineCount')=='30' and g.get('betID')=='','CELESTIAL_WAGER_MISMATCH');win=amount(g.get('totalWin'))
            bg=one(g,'BGInfo');check(bg.get('isMaxWin')=='0' and bg.get('baseGameSpinsRemaining')=='0' and amount(bg.get('totalWagerWin'))==win and amount(bg.get('bgWinnings'))==win,'CELESTIAL_CUMULATIVE_WIN_MISMATCH')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');check(reels.get('numSpins')=='1' and sum(n.tag=='ReelSpin' for n in reels)==1,'CELESTIAL_REEL_STATE_MISMATCH')
            check(spin.get('spinIndex')=='0' and spin.get('reelsetIndex')=='0' and spin.get('winCountSC')=='0' and spin.get('freeSpin')=='N' and spin.get('bonusAwarded')=='N','CELESTIAL_FEATURE_NOT_ADAPTED')
            wild=one(reels,'WildIndex');check(not len(wild) and wild.text=='11|11|11|11|11' and [n.tag for n in reels]==['WildIndex','ReelSpin'],'CELESTIAL_WILD_INDEX_NOT_REVIEWED')
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==5,'CELESTIAL_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            pays=[n for n in spin if n.tag=='PaylineWin'];lines=set();total=0
            check(amount(spin.get('winCountPL'))==len(pays) and len(pays)<=12 and amount(spin.get('spinWins'))==win,'CELESTIAL_REEL_WIN_MISMATCH')
            for p in pays:
                line=amount(p.get('index'));check(line<30 and line not in lines and p.get('awardTableIndex')=='0' and amount(p.get('awardIndex')) in (0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27, 30),'CELESTIAL_PAYLINE_NOT_REVIEWED')
                lines.add(line);total+=amount(p.get('winVal'));amount(total)
            check(total==win,'CELESTIAL_REEL_WIN_MISMATCH');balance=start-100+win;amount(balance);next_msg='EndGame'
        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==100,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=1,mul=s['win']/100,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=100))
class CelestialBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32756 and plan.get('runtimeGameId')==32978 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='celestial-base-wms-v1'
              and plan.get('betRaw')==100 and plan.get('buy')==0 and plan.get('maxSteps')==2,'CELESTIAL_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'CELESTIAL_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
