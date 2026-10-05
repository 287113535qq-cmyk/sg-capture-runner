"""Independent, ordinary-only Fire Queen WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
import pathlib,json
from store import digest
POLICY=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-firequeen-base-contract.json').read_bytes())
check(digest(POLICY)=='f64edfec9814b50ddb81886f32a084a24ee7ebdf878d2d2e5f2314cf989e12b4','FIREQUEEN_POLICY_REQUIRED')
AWARDS={tuple(x) for x in POLICY['awardTableWinPatterns']};POSITIONS=set(POLICY['positionPatterns']);WILD_PATTERNS=set(POLICY['wildTransformedPatterns'])

SOURCE='firequeen-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='firequeen_prt',gameID='20192',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'firequeen-base-wms-v1','mode':'demo','buy':0,'betRaw':50,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32767,'runtimeGameId':32989,'wmsGameId':20192,'ordinaryContractHash':'f64edfec9814b50ddb81886f32a084a24ee7ebdf878d2d2e5f2314cf989e12b4',
 'historyFileSha256':'70ab349acdc4acf5bcaf8c756695e486a46611ba62880a93f6cec33708c023b0','fullBaseRounds':989,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','WildTransformedReels ReelResults GameWinInfo GameVariantInfo'),'ReelResults':('numSpins','ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin'),
 'ReelStops':('',''),'PaylineWin':('index winVal awardIndex awardTableIndex',''),'WildTransformedReels':('',''),'GameWinInfo':('totalWagerWin totalBGWin totalFSWin maxWinValue isMaxWin isEndGame',''),'GameVariantInfo':('rtp','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'FIREQUEEN_FEATURE_NOT_ADAPTED')
    check(not (n.text or '').strip() or n.tag in ('CurrencyMultiplier','ReelStops','PaylineWin','WildTransformedReels','Stakes'),'FIREQUEEN_FEATURE_NOT_ADAPTED')
    check(not (n.tail or '').strip(),'FIREQUEEN_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'FIREQUEEN_REQUEST_MISMATCH')
    for n in q.iter():check(not (n.text or '').strip() or n.tag=='CurrencyMultiplier','FIREQUEEN_REQUEST_MODE');check(not (n.tail or '').strip(),'FIREQUEEN_REQUEST_MODE')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'FIREQUEEN_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'WagerInfo');check(msg=='Logic' and [n.tag for n in q]==['Header','WagerInfo','AccountData'],'FIREQUEEN_REQUEST_MISMATCH')
        check(stake.attrib==dict(totalStake='50') and not len(stake),'FIREQUEEN_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and not (a.text or '').strip() and not (c.tail or '').strip() and len(a)==1 and not c.attrib and not len(c) and c.text=='1','FIREQUEEN_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'FIREQUEEN_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20192'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'FIREQUEEN_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 50 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'FIREQUEEN_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'FIREQUEEN_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'FIREQUEEN_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and [n.tag for n in root]==['Header','AccountData','Balances'] and not one(root,'AccountData').attrib and not len(one(root,'AccountData')) and not any(n.tag=='GameResult' for n in root),'FIREQUEEN_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult'],'FIREQUEEN_SEQUENCE_MISMATCH')
            account=one(root,'AccountData');check([n.tag for n in account]==['AccountData'],'FIREQUEEN_RESPONSE_CURRENCY');inner=one(account,'AccountData');c=one(inner,'CurrencyMultiplier')
            check(not inner.attrib and len(inner)==1 and not c.attrib and not len(c) and c.text=='1','FIREQUEEN_RESPONSE_CURRENCY')
            g=one(root,'GameResult');check([n.tag for n in g] in (['WildTransformedReels','ReelResults','GameWinInfo','GameVariantInfo'],['ReelResults','GameWinInfo','GameVariantInfo']),'FIREQUEEN_FEATURE_NOT_ADAPTED');win=amount(g.get('totalWin'))
            check(g.attrib==dict(stake='50',stakePerLine='1',paylineCount='100',totalWin=str(win),betID=''),'FIREQUEEN_WAGER_MISMATCH')
            bg=one(g,'GameWinInfo');check(bg.attrib==dict(totalWagerWin=str(win),totalBGWin=str(win),totalFSWin='0',maxWinValue='25000000',isMaxWin='N',isEndGame='Y'),'FIREQUEEN_CUMULATIVE_WIN_MISMATCH')
            check(one(g,'GameVariantInfo').attrib==dict(rtp='95.95'),'FIREQUEEN_VARIANT_NOT_REVIEWED')
            wt=g.find('WildTransformedReels')
            if wt is not None:check(not wt.attrib and not len(wt) and wt.text in WILD_PATTERNS,'FIREQUEEN_WILD_PATTERN_NOT_REVIEWED')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');ps=[n for n in spin if n.tag=='PaylineWin'];spin_win=amount(spin.get('spinWins'))
            check(reels.attrib==dict(numSpins='1') and [n.tag for n in reels]==['ReelSpin'],'FIREQUEEN_REEL_STATE_MISMATCH')
            check(len(ps)<=POLICY['maxPaylines'] and amount(spin.get('reelsetIndex')) in POLICY['reelsetIndices']
                and spin.attrib==dict(spinIndex='0',reelsetIndex=spin.get('reelsetIndex'),winCountPL=str(len(ps)),winCountSC='0',spinWins=str(spin_win),freeSpin='N',bonusAwarded='N')
                and [n.tag for n in spin]==['ReelStops']+['PaylineWin']*len(ps),'FIREQUEEN_FEATURE_NOT_ADAPTED')
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==11,'FIREQUEEN_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            total=0;lines=set()
            for p in ps:
                line=amount(p.get('index'));award=amount(p.get('awardIndex'));table=amount(p.get('awardTableIndex'));v=amount(p.get('winVal'))
                check(line<100 and line not in lines and p.attrib==dict(index=str(line),winVal=str(v),awardIndex=str(award),awardTableIndex=str(table))
                    and (award,table,v) in AWARDS and not len(p) and p.text in POSITIONS,'FIREQUEEN_PAYLINE_NOT_REVIEWED')
                xs=[amount(x) for x in p.text.split('|')];check(len(xs) in POLICY['positionLengths'] and len(set(xs))==len(xs) and all(x<POLICY['positionMaxExclusive'] for x in xs),'FIREQUEEN_PAYLINE_POSITIONS_NOT_REVIEWED')
                lines.add(line);total+=v;amount(total)
            check(total==spin_win and total==win,'FIREQUEEN_REEL_WIN_MISMATCH');balance=start-50+win;amount(balance);next_msg='EndGame'

        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==50,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=0.5,mul=s['win']/50,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=50))
class FireQueenBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32767 and plan.get('runtimeGameId')==32989 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='firequeen-base-wms-v1'
              and plan.get('betRaw')==50 and plan.get('buy')==0 and plan.get('maxSteps')==2,'FIREQUEEN_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'FIREQUEEN_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
