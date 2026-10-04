"""Independent, ordinary-only Action Bank Plus WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
SOURCE='actionbankplus-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='actionbankplus',gameID='20369',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'actionbank-base-wms-v1','mode':'demo','buy':0,'betRaw':200,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32753,'runtimeGameId':32975,'wmsGameId':20369,
 'historyFileSha256':'721d75dedb9f9c14660fd5e135fe1bd1da4dadadff75d3492a73c0420ba6b69a','fullBaseRounds':989,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering readyForEndGame',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo'),'ReelResults':('numSpins','ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex anywayWins scatterWinCount totalSpinWin freeSpin bonusAwarded','ReelStops AnywayWin'),
 'ReelStops':('',''),'AnywayWin':('winIndex winVal ways awardIndex',''),'BGInfo':('totalWagerWin bgWinnings isMaxWin vaultCount','')}

def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'ACTIONBANK_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'ACTIONBANK_REQUEST_MISMATCH')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'ACTIONBANK_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['Header','Stake','PaylineCount','AccountData'],'ACTIONBANK_REQUEST_MISMATCH')
        check(stake.attrib==dict(total='200') and not len(stake) and one(q,'PaylineCount').attrib=={'count':'1'} and not len(one(q,'PaylineCount')),'ACTIONBANK_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and len(a)==1 and not c.attrib and not len(c) and c.text=='1','ACTIONBANK_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'ACTIONBANK_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20369'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'ACTIONBANK_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 200 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'ACTIONBANK_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'ACTIONBANK_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'ACTIONBANK_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and one(root,'Header').get('readyForEndGame')=='N' and not any(n.tag=='GameResult' for n in root),'ACTIONBANK_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0,'ACTIONBANK_SEQUENCE_MISMATCH');g=one(root,'GameResult')
            check(one(root,'Header').get('readyForEndGame')=='Y','ACTIONBANK_FEATURE_NOT_ADAPTED')
            check(g.get('stake')=='200' and g.get('stakePerLine')=='10' and g.get('paylineCount')=='20' and g.get('betID')=='','ACTIONBANK_WAGER_MISMATCH');win=amount(g.get('totalWin'))
            bg=one(g,'BGInfo');check(bg.get('isMaxWin')=='0' and amount(bg.get('vaultCount'))<=3 and amount(bg.get('totalWagerWin'))==win and amount(bg.get('bgWinnings'))==win,'ACTIONBANK_CUMULATIVE_WIN_MISMATCH')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');check(reels.get('numSpins')=='1' and len(reels)==1,'ACTIONBANK_REEL_STATE_MISMATCH')
            check(spin.get('spinIndex')=='0' and spin.get('reelsetIndex')=='0' and spin.get('scatterWinCount')=='0' and spin.get('freeSpin')=='N' and spin.get('bonusAwarded')=='N','ACTIONBANK_FEATURE_NOT_ADAPTED')
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==9,'ACTIONBANK_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            pays=[n for n in spin if n.tag=='AnywayWin'];indices=set();total=0
            check(amount(spin.get('anywayWins'))==len(pays) and len(pays)<=2 and amount(spin.get('totalSpinWin'))==win,'ACTIONBANK_REEL_WIN_MISMATCH')
            for p in pays:
                index=amount(p.get('winIndex'));check(index<2 and index not in indices and amount(p.get('ways')) in (1,2,3,4,6,8,9,12,16,18,24) and amount(p.get('awardIndex'))<=10,'ACTIONBANK_ANYWAY_NOT_REVIEWED')
                indices.add(index);total+=amount(p.get('winVal'));amount(total)
            check(total==win,'ACTIONBANK_REEL_WIN_MISMATCH');balance=start-200+win;amount(balance);next_msg='EndGame'
        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==200,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=2,mul=s['win']/200,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=200))
class ActionBankBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32753 and plan.get('runtimeGameId')==32975 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='actionbank-base-wms-v1'
              and plan.get('betRaw')==200 and plan.get('buy')==0 and plan.get('maxSteps')==2,'ACTIONBANK_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'ACTIONBANK_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
