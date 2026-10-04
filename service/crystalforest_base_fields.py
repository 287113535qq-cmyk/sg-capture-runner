"""Independent, ordinary-only Crystal Forest WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
import pathlib,json
from store import digest
POLICY=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-crystalforest-base-contract.json').read_bytes())
check(digest(POLICY)=='cea5b9022b20d763b51cf042457cda0ae15e33d67b1694b90c025cdaad960295','CRYSTALFOREST_POLICY_REQUIRED')
AWARDS={tuple(x) for x in POLICY['awardPairs']};POSITIONS=set(POLICY['positionPatterns']);MASKS={tuple(x) for x in POLICY['cascadeIndexMaskPatterns']}
SOURCE='crystalforest-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='crystalforesthd_prt',gameID='20142',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'crystalforest-base-wms-v1','mode':'demo','buy':0,'betRaw':25,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32759,'runtimeGameId':32981,'wmsGameId':20142,'ordinaryContractHash':'cea5b9022b20d763b51cf042457cda0ae15e33d67b1694b90c025cdaad960295',
 'historyFileSha256':'81f436a78b30dfc4fc23dab62d4365cc6a56fc4ce35ea7e20fcad79516522b16','fullBaseRounds':1000,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo'),'ReelResults':('numSpins','ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex cascadeCount winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops Cascade'),
 'ReelStops':('',''),'Cascade':('index winCountPL winCountSC cascadeWins cascadeMask','PaylineWin'),
 'PaylineWin':('index winVal awardIndex awardTableIndex',''),'BGInfo':('totalWagerWin bgWinnings baseGameSpinsRemaining isBigBet isMaxWin','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'CRYSTALFOREST_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'CRYSTALFOREST_REQUEST_MISMATCH')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'CRYSTALFOREST_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['AccountData','Header','Stake'],'CRYSTALFOREST_REQUEST_MISMATCH')
        check(stake.attrib==dict(total='25',lines='25') and not len(stake),'CRYSTALFOREST_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and len(a)==1 and not c.attrib and not len(c) and c.text=='1','CRYSTALFOREST_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'CRYSTALFOREST_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20142'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'CRYSTALFOREST_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 25 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'CRYSTALFOREST_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'CRYSTALFOREST_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'CRYSTALFOREST_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and [n.tag for n in root]==['Header','AccountData','Balances'] and not len(one(root,'AccountData')) and not (one(root,'AccountData').text or '').strip() and not any(n.tag=='GameResult' for n in root),'CRYSTALFOREST_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult'],'CRYSTALFOREST_SEQUENCE_MISMATCH')
            account=one(root,'AccountData');check([n.tag for n in account]==['AccountData'],'CRYSTALFOREST_RESPONSE_CURRENCY');inner=one(account,'AccountData');c=one(inner,'CurrencyMultiplier')
            check(not inner.attrib and len(inner)==1 and not c.attrib and not len(c) and c.text=='1','CRYSTALFOREST_RESPONSE_CURRENCY')
            g=one(root,'GameResult');check([n.tag for n in g]==['ReelResults','BGInfo'],'CRYSTALFOREST_FEATURE_NOT_ADAPTED')
            check(g.get('stake')=='25' and g.get('stakePerLine')=='1' and g.get('paylineCount')=='25' and g.get('betID')=='','CRYSTALFOREST_WAGER_MISMATCH');win=amount(g.get('totalWin'))
            bg=one(g,'BGInfo');check(bg.attrib==dict(totalWagerWin=str(win),bgWinnings=str(win),baseGameSpinsRemaining='0',isBigBet='0',isMaxWin='0'),'CRYSTALFOREST_CUMULATIVE_WIN_MISMATCH')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');cs=[n for n in spin if n.tag=='Cascade']
            check(reels.attrib==dict(numSpins='1') and [n.tag for n in reels]==['ReelSpin'],'CRYSTALFOREST_REEL_STATE_MISMATCH')
            check(1<=len(cs)<=4 and spin.get('spinIndex')=='0' and spin.get('reelsetIndex')=='0' and spin.get('cascadeCount')==str(len(cs))
                and spin.get('winCountSC')=='0' and spin.get('freeSpin')=='N' and spin.get('bonusAwarded')=='N'
                and [n.tag for n in spin]==['ReelStops']+['Cascade']*len(cs),'CRYSTALFOREST_FEATURE_NOT_ADAPTED')
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==5,'CRYSTALFOREST_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            total=pay_count=0
            for ci,c in enumerate(cs):
                ps=list(c);check(all(n.tag=='PaylineWin' for n in ps) and c.get('index')==str(ci) and c.get('winCountSC')=='0'
                    and amount(c.get('winCountPL'))==len(ps) and len(ps)<=25 and (len(ps)==0 if ci==len(cs)-1 else len(ps)>0),'CRYSTALFOREST_CASCADE_COUNTER')
                cw=0;lines=set();union=set()
                for p in ps:
                    line=amount(p.get('index'));award=amount(p.get('awardIndex'));v=amount(p.get('winVal'))
                    check(line<25 and line not in lines and p.get('awardTableIndex')=='0' and (award,v) in AWARDS and not len(p) and p.text in POSITIONS,'CRYSTALFOREST_PAYLINE_NOT_REVIEWED')
                    lines.add(line);xs=[amount(x) for x in p.text.split('|')];check(3<=len(xs)<=5 and len(set(xs))==len(xs) and all(x<15 for x in xs),'CRYSTALFOREST_PAYLINE_NOT_REVIEWED')
                    union.update(xs);cw+=v;amount(cw)
                # Mask refers only to this cascade's winning positions.
                mask=sum(1<<x for x in union);check(amount(c.get('cascadeMask'))==mask and (ci,mask) in MASKS,'CRYSTALFOREST_CASCADE_MASK_NOT_REVIEWED')
                check(amount(c.get('cascadeWins'))==cw,'CRYSTALFOREST_CASCADE_WIN_MISMATCH');total+=cw;amount(total);pay_count+=len(ps)
            check(pay_count<=38 and amount(spin.get('winCountPL'))==pay_count and amount(spin.get('spinWins'))==total==win,'CRYSTALFOREST_REEL_WIN_MISMATCH');balance=start-25+win;amount(balance);next_msg='EndGame'
        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==25,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=0.25,mul=s['win']/25,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=25))
class CrystalForestBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32759 and plan.get('runtimeGameId')==32981 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='crystalforest-base-wms-v1'
              and plan.get('betRaw')==25 and plan.get('buy')==0 and plan.get('maxSteps')==2,'CRYSTALFOREST_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'CRYSTALFOREST_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
