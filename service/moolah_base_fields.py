"""Independent, ordinary-only Invaders of Planet Moolah WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
import pathlib,json
from store import digest
POLICY=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-moolah-base-contract.json').read_bytes())
check(digest(POLICY)=='178e546251c86db19467128df923f622cc038a9bb2dcb06f43f9584ac463b638','MOOLAH_POLICY_REQUIRED')
AWARDS={tuple(x) for x in POLICY['awardTableWinPatterns']};POSITIONS=set(POLICY['positionPatterns']);CHAINS={digest(x) for x in POLICY['cascadeChains']}

SOURCE='invadersfromplanetmoolah_prt-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='invadersfromplanetmoolah_prt',gameID='20145',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'moolah-base-wms-v1','mode':'demo','buy':0,'betRaw':25,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32776,'runtimeGameId':32998,'wmsGameId':20145,'ordinaryContractHash':'178e546251c86db19467128df923f622cc038a9bb2dcb06f43f9584ac463b638',
 'historyFileSha256':'337dc9dd4746430dffd38aef46f64c54db65844c7ca21efcbe7cb2ea9215d7f4','fullBaseRounds':1000,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo'),'ReelResults':('numSpins','ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex cascadeCount winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops Cascade'),'Cascade':('index winCountPL winCountSC cascadeWins cascadeMask','PaylineWin'),
 'ReelStops':('',''),'PaylineWin':('index winVal awardIndex awardTableIndex',''),'BGInfo':('totalWagerWin bgWinnings baseGameSpinsRemaining isBigBet isMaxWin','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'MOOLAH_FEATURE_NOT_ADAPTED')
    check(not (n.text or '').strip() or n.tag in ('CurrencyMultiplier','ReelStops','PaylineWin','Stakes'),'MOOLAH_FEATURE_NOT_ADAPTED')
    check(not (n.tail or '').strip(),'MOOLAH_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'MOOLAH_REQUEST_MISMATCH')
    for n in q.iter():check(not (n.text or '').strip() or n.tag=='CurrencyMultiplier','MOOLAH_REQUEST_MODE');check(not (n.tail or '').strip(),'MOOLAH_REQUEST_MODE')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'MOOLAH_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['AccountData','Header','Stake'],'MOOLAH_REQUEST_MISMATCH')
        check(stake.attrib==dict(total='25') and not len(stake),'MOOLAH_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and not (a.text or '').strip() and not (c.tail or '').strip() and len(a)==1 and not c.attrib and not len(c) and c.text=='1','MOOLAH_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'MOOLAH_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20145'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'MOOLAH_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 25 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'MOOLAH_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'MOOLAH_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'MOOLAH_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and [n.tag for n in root]==['Header','AccountData','Balances'] and not one(root,'AccountData').attrib and not len(one(root,'AccountData')) and not any(n.tag=='GameResult' for n in root),'MOOLAH_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult'],'MOOLAH_SEQUENCE_MISMATCH')
            account=one(root,'AccountData');check([n.tag for n in account]==['AccountData'],'MOOLAH_RESPONSE_CURRENCY');inner=one(account,'AccountData');c=one(inner,'CurrencyMultiplier')
            check(not inner.attrib and len(inner)==1 and not c.attrib and not len(c) and c.text=='1','MOOLAH_RESPONSE_CURRENCY')
            g=one(root,'GameResult');check([n.tag for n in g]==['ReelResults','BGInfo'],'MOOLAH_FEATURE_NOT_ADAPTED');win=amount(g.get('totalWin'))
            check(g.attrib==dict(stake='25',stakePerLine='1',paylineCount='25',totalWin=str(win),betID=''),'MOOLAH_WAGER_MISMATCH')
            bg=one(g,'BGInfo');check(bg.attrib==dict(totalWagerWin=str(win),bgWinnings=str(win),baseGameSpinsRemaining='0',isBigBet='0',isMaxWin='0'),'MOOLAH_CUMULATIVE_WIN_MISMATCH')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');cs=[n for n in spin if n.tag=='Cascade'];spin_win=amount(spin.get('spinWins'))
            check(reels.attrib==dict(numSpins='1') and [n.tag for n in reels]==['ReelSpin'],'MOOLAH_REEL_STATE_MISMATCH')
            check(1<=len(cs)<=POLICY['maxCascadeCount'] and spin.attrib==dict(spinIndex='0',reelsetIndex='0',cascadeCount=str(len(cs)),winCountPL=spin.get('winCountPL'),winCountSC='0',spinWins=str(spin_win),freeSpin='N',bonusAwarded='N') and [n.tag for n in spin]==['ReelStops']+['Cascade']*len(cs),'MOOLAH_FEATURE_NOT_ADAPTED')
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==5,'MOOLAH_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            total=0;line_count=0;chain=[]
            for index,c in enumerate(cs):
                ps=list(c);cw=amount(c.get('cascadeWins'));mask=amount(c.get('cascadeMask'))
                check(len(ps)<=POLICY['perCascadePaylinePatterns'][str(index)]['maxPaylines'] and c.attrib==dict(index=str(index),winCountPL=str(len(ps)),winCountSC='0',cascadeWins=str(cw),cascadeMask=str(mask)) and all(p.tag=='PaylineWin' for p in ps),'MOOLAH_CASCADE_STATE_MISMATCH')
                cascade_sum=0;lines=set();rows=[]
                for p in ps:
                    line=amount(p.get('index'));award=amount(p.get('awardIndex'));table=amount(p.get('awardTableIndex'));v=amount(p.get('winVal'))
                    check(line<25 and line not in lines and p.attrib==dict(index=str(line),winVal=str(v),awardIndex=str(award),awardTableIndex=str(table)) and (award,table,v) in AWARDS and not len(p) and p.text in POSITIONS,'MOOLAH_PAYLINE_NOT_REVIEWED')
                    xs=[amount(x) for x in p.text.split('|')];check(len(xs) in POLICY['positionLengths'] and len(set(xs))==len(xs) and all(x<15 for x in xs),'MOOLAH_PAYLINE_POSITIONS_NOT_REVIEWED')
                    lines.add(line);cascade_sum+=v;amount(cascade_sum);rows.append(dict(attrs=p.attrib,text=p.text))
                check(cascade_sum==cw,'MOOLAH_CASCADE_WIN_MISMATCH');total+=cw;amount(total);line_count+=len(ps);chain.append(dict(attrs=c.attrib,paylines=rows))
            check(digest(chain) in CHAINS,'MOOLAH_CASCADE_CHAIN_NOT_REVIEWED')
            check(line_count==amount(spin.get('winCountPL')) and total==spin_win and total==win,'MOOLAH_REEL_WIN_MISMATCH');balance=start-25+win;amount(balance);next_msg='EndGame'

        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==25,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=.25,mul=s['win']/25,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=25))
class MoolahBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32776 and plan.get('runtimeGameId')==32998 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='moolah-base-wms-v1'
              and plan.get('betRaw')==25 and plan.get('buy')==0 and plan.get('maxSteps')==2,'MOOLAH_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'MOOLAH_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
