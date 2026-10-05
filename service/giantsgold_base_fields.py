"""Independent, ordinary-only Giant’s Gold WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
import pathlib,json
from store import digest
POLICY=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-giantsgold-base-contract.json').read_bytes())
check(digest(POLICY)=='af9c7a53979982876cdb28c145eaf178cb27e7ef796542520a5dede77ff6a62f','GIANTSGOLD_POLICY_REQUIRED')
AWARDS=[{tuple(x) for x in xs} for xs in POLICY['perSpinAwardPatterns']];POSITIONS=[set(xs) for xs in POLICY['perSpinPositionPatterns']];JOINT_PATTERNS={digest(x) for x in POLICY['clumpWildJointPatterns']}

SOURCE='giantsgold-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='giantsgold_prt',gameID='20129',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'giantsgold-base-wms-v1','mode':'demo','buy':0,'betRaw':50,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32770,'runtimeGameId':32992,'wmsGameId':20129,'ordinaryContractHash':'af9c7a53979982876cdb28c145eaf178cb27e7ef796542520a5dede77ff6a62f',
 'historyFileSha256':'36c01e39cee7b97c7fa1e1c49902d2d56211fe92954e68619af9ee586d71af26','fullBaseRounds':1000,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo'),'ReelResults':('numSpins','ClumpPlaceholderInfo PsudoSuperWildStack ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin'),
 'ReelStops':('',''),'PaylineWin':('index winVal awardIndex awardTableIndex',''),'BGInfo':('totalWagerWin bgWinnings baseGameSpinsRemaining isMaxWin',''),'ClumpPlaceholderInfo':('bigSymbolIdEven bigSymbolIdOdd smallSymbolIdEven smallSymbolIdOdd',''),'PsudoSuperWildStack':('reelsToTurnWild','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'GIANTSGOLD_FEATURE_NOT_ADAPTED')
    check(not (n.text or '').strip() or n.tag in ('CurrencyMultiplier','ReelStops','PaylineWin','Stakes'),'GIANTSGOLD_FEATURE_NOT_ADAPTED')
    check(not (n.tail or '').strip(),'GIANTSGOLD_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'GIANTSGOLD_REQUEST_MISMATCH')
    for n in q.iter():check(not (n.text or '').strip() or n.tag=='CurrencyMultiplier','GIANTSGOLD_REQUEST_MODE');check(not (n.tail or '').strip(),'GIANTSGOLD_REQUEST_MODE')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'GIANTSGOLD_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['Header','Stake','AccountData'],'GIANTSGOLD_REQUEST_MISMATCH')
        check(stake.attrib==dict(total='50',paylineCount='20') and not len(stake),'GIANTSGOLD_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and not (a.text or '').strip() and not (c.tail or '').strip() and len(a)==1 and not c.attrib and not len(c) and c.text=='1','GIANTSGOLD_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'GIANTSGOLD_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20129'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'GIANTSGOLD_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 50 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'GIANTSGOLD_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'GIANTSGOLD_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'GIANTSGOLD_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and [n.tag for n in root]==['Header','AccountData','Balances'] and not len(one(root,'AccountData')) and not (one(root,'AccountData').text or '').strip() and not any(n.tag=='GameResult' for n in root),'GIANTSGOLD_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult'],'GIANTSGOLD_SEQUENCE_MISMATCH')
            account=one(root,'AccountData');check([n.tag for n in account]==['AccountData'],'GIANTSGOLD_RESPONSE_CURRENCY');inner=one(account,'AccountData');c=one(inner,'CurrencyMultiplier')
            check(not inner.attrib and len(inner)==1 and not c.attrib and not len(c) and c.text=='1','GIANTSGOLD_RESPONSE_CURRENCY')
            g=one(root,'GameResult');check([n.tag for n in g]==['ReelResults','BGInfo'],'GIANTSGOLD_FEATURE_NOT_ADAPTED');win=amount(g.get('totalWin'))
            check(g.attrib==dict(stake='50',stakePerLine='2',paylineCount='20',totalWin=str(win),betID=''),'GIANTSGOLD_WAGER_MISMATCH')
            bg=one(g,'BGInfo');check(bg.attrib==dict(totalWagerWin=str(win),bgWinnings=str(win),baseGameSpinsRemaining='0',isMaxWin='0'),'GIANTSGOLD_CUMULATIVE_WIN_MISMATCH')
            reels=one(g,'ReelResults');check(reels.attrib==dict(numSpins='2') and [n.tag for n in reels]==['ClumpPlaceholderInfo','PsudoSuperWildStack','ReelSpin','ReelSpin'],'GIANTSGOLD_REEL_STATE_MISMATCH')
            clump=one(reels,'ClumpPlaceholderInfo');wild=one(reels,'PsudoSuperWildStack');check(not len(clump) and not len(wild) and digest(dict(clump=clump.attrib,wild=wild.attrib)) in JOINT_PATTERNS,'GIANTSGOLD_CLUMP_WILD_NOT_REVIEWED')
            spins=[n for n in reels if n.tag=='ReelSpin'];total=0;count=0
            for si,spin in enumerate(spins):
                ps=[n for n in spin if n.tag=='PaylineWin'];spin_win=amount(spin.get('spinWins'));count+=len(ps)
                check(len(ps)<=POLICY['maxPaylinesPerSpin'][si] and spin.attrib==dict(spinIndex=str(si),reelsetIndex=str(si),winCountPL=str(len(ps)),winCountSC='0',spinWins=str(spin_win),freeSpin='N',bonusAwarded='N')
                    and [n.tag for n in spin]==['ReelStops']+['PaylineWin']*len(ps),'GIANTSGOLD_FEATURE_NOT_ADAPTED')
                stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==5,'GIANTSGOLD_REEL_STATE_MISMATCH')
                for v in stops.text.split('|'):amount(v)
                spin_total=0;lines=set()
                for p in ps:
                    line=amount(p.get('index'));award=amount(p.get('awardIndex'));table=amount(p.get('awardTableIndex'));v=amount(p.get('winVal'))
                    check(line<20 and line not in lines and p.attrib==dict(index=str(line),winVal=str(v),awardIndex=str(award),awardTableIndex=str(table))
                        and (award,table,v) in AWARDS[si] and not len(p) and p.text in POSITIONS[si],'GIANTSGOLD_PAYLINE_NOT_REVIEWED')
                    xs=[amount(x) for x in p.text.split('|')];check(len(xs)==5 and len(set(xs))==5 and all(x<60 for x in xs),'GIANTSGOLD_PAYLINE_POSITIONS_NOT_REVIEWED')
                    lines.add(line);spin_total+=v;amount(spin_total)
                check(spin_total==spin_win,'GIANTSGOLD_REEL_WIN_MISMATCH');total+=spin_total;amount(total)
            # Sum both ordinary spins once; metadata is not another reward.
            check(count<=POLICY['maxPaylinesPerLogic'] and total==win,'GIANTSGOLD_REEL_WIN_MISMATCH');balance=start-50+win;amount(balance);next_msg='EndGame'

        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==50,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=0.5,mul=s['win']/50,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=50))
class GiantsGoldBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32770 and plan.get('runtimeGameId')==32992 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='giantsgold-base-wms-v1'
              and plan.get('betRaw')==50 and plan.get('buy')==0 and plan.get('maxSteps')==2,'GIANTSGOLD_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'GIANTSGOLD_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
