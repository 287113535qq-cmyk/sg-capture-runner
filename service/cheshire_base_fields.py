"""Independent, ordinary-only Cheshire Cat WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
SOURCE='cheshirecat-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='cheshirecat',gameID='20132',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'cheshire-base-wms-v1','mode':'demo','buy':0,'betRaw':240,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32757,'runtimeGameId':32979,'wmsGameId':20132,
 'historyFileSha256':'5558724ad866381308c379b32726423d5af90489d974f8301a72b4866244d66f','fullBaseRounds':1000,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo'),'ReelResults':('numSpins','ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin'),
 'ReelStops':('',''),'PaylineWin':('index winVal awardIndex awardTableIndex',''),'BGInfo':('totalWagerWin bgWinnings mysterySymbol isMaxWin maxWin','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'CHESHIRE_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'CHESHIRE_REQUEST_MISMATCH')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'CHESHIRE_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['AccountData','Header','Stake'],'CHESHIRE_REQUEST_MISMATCH')
        check(stake.attrib==dict(total='240',lines='40') and not len(stake),'CHESHIRE_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and len(a)==1 and not c.attrib and not len(c) and c.text=='1','CHESHIRE_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'CHESHIRE_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20132'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'CHESHIRE_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 240 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'CHESHIRE_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'CHESHIRE_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'CHESHIRE_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and [n.tag for n in root]==['Header','AccountData','Balances'] and not len(one(root,'AccountData')) and not any(n.tag=='GameResult' for n in root),'CHESHIRE_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult'],'CHESHIRE_SEQUENCE_MISMATCH')
            account=one(root,'AccountData');check([n.tag for n in account]==['AccountData'],'CHESHIRE_RESPONSE_CURRENCY');inner=one(account,'AccountData');c=one(inner,'CurrencyMultiplier')
            check(not inner.attrib and len(inner)==1 and not c.attrib and not len(c) and c.text=='1','CHESHIRE_RESPONSE_CURRENCY')
            g=one(root,'GameResult');check([n.tag for n in g]==['ReelResults','BGInfo'],'CHESHIRE_FEATURE_NOT_ADAPTED')
            check(g.get('stake')=='240' and g.get('stakePerLine')=='6' and g.get('paylineCount')=='40' and g.get('betID')=='','CHESHIRE_WAGER_MISMATCH');win=amount(g.get('totalWin'))
            bg=one(g,'BGInfo');check(bg.get('isMaxWin')=='0' and 1<=amount(bg.get('mysterySymbol'))<=10 and bg.get('maxWin')=='25000000' and amount(bg.get('totalWagerWin'))==win and amount(bg.get('bgWinnings'))==win,'CHESHIRE_CUMULATIVE_WIN_MISMATCH')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');check(reels.get('numSpins')=='1' and sum(n.tag=='ReelSpin' for n in reels)==1,'CHESHIRE_REEL_STATE_MISMATCH')
            check(spin.get('spinIndex')=='0' and spin.get('reelsetIndex')=='0' and spin.get('winCountSC')=='0' and spin.get('freeSpin')=='N' and spin.get('bonusAwarded')=='N','CHESHIRE_FEATURE_NOT_ADAPTED')
            check([n.tag for n in reels]==['ReelSpin'],'CHESHIRE_REEL_STATE_MISMATCH')
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==5,'CHESHIRE_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            pays=[n for n in spin if n.tag=='PaylineWin'];lines=set();total=0
            check(amount(spin.get('winCountPL'))==len(pays) and len(pays)<=40 and amount(spin.get('spinWins'))==win,'CHESHIRE_REEL_WIN_MISMATCH')
            for p in pays:
                line=amount(p.get('index'));check(line<40 and line not in lines and p.get('awardTableIndex')=='0' and amount(p.get('awardIndex')) in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31),'CHESHIRE_PAYLINE_NOT_REVIEWED')
                check(not len(p) and p.text in ('0|1|2', '0|1|2|3', '0|1|2|3|4', '0|1|2|8', '0|1|2|8|14', '0|1|3|4|7', '0|1|3|7', '0|1|7', '0|1|7|13', '0|1|7|13|14', '0|2|3|4|6', '0|2|3|6', '0|2|4|6|8', '0|2|6', '0|2|6|8', '0|4|6|7|8', '0|4|6|8|12', '0|6|12', '0|6|12|13', '0|6|12|13|14', '0|6|7', '0|6|7|8', '0|6|7|8|14', '0|6|8|12', '10|11|12', '10|11|12|13', '10|11|12|13|14', '10|11|13|14|17', '10|11|13|17', '10|11|17', '10|12|14|16|18', '10|12|16', '10|12|16|18', '10|14|16|17|18', '10|16|17', '10|16|17|18', '11|12|13|15', '11|12|13|15|19', '11|12|15', '11|13|15|17', '11|13|15|17|19', '11|15|17', '11|15|17|18', '11|15|17|18|19', '12|15|16', '12|15|16|18', '12|15|16|18|19', '13|15|16|17', '15|16|17', '15|16|17|18', '15|16|17|18|19', '1|2|3|5', '1|2|3|5|9', '1|2|5', '1|3|5|7', '1|3|5|7|9', '1|5|7', '1|5|7|13', '1|5|7|9|13', '2|5|6', '2|5|6|8', '2|5|6|8|9', '2|6|10', '2|6|8|10', '2|6|8|10|14', '3|4|7|10|11', '3|7|10|11', '5|11|12', '5|11|12|13', '5|11|13|17', '5|11|17', '5|6|12', '5|6|12|18', '5|6|12|18|19', '5|6|7', '5|6|7|8', '5|6|7|8|9', '5|6|8|12', '5|6|8|9|12', '5|7|11', '5|7|11|13', '5|7|9|11|13', '5|9|11|12|13', '5|9|11|13|17', '6|10|12', '6|7|10', '6|7|8|10', '6|7|8|10|14', '6|8|10|12', '6|8|10|12|14', '7|10|11', '7|10|11|13', '7|10|11|13|14', '7|11|13|15', '7|11|13|15|19', '7|11|15', '7|8|11|15', '7|8|9|11|15', '8|10|12|14|16', '8|10|12|16', '8|12|15|16', '8|9|12|15|16', '9|11|12|13|15', '9|13|15|16|17'),'CHESHIRE_PAYLINE_POSITIONS_NOT_REVIEWED')
                lines.add(line);total+=amount(p.get('winVal'));amount(total)
            check(total==win,'CHESHIRE_REEL_WIN_MISMATCH');balance=start-240+win;amount(balance);next_msg='EndGame'
        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==240,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=2.4,mul=s['win']/240,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=240))
class CheshireBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32757 and plan.get('runtimeGameId')==32979 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='cheshire-base-wms-v1'
              and plan.get('betRaw')==240 and plan.get('buy')==0 and plan.get('maxSteps')==2,'CHESHIRE_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'CHESHIRE_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
