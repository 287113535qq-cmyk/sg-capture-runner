"""Independent, ordinary-only Desert Cats WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
import pathlib,json
from store import digest
POLICY=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-desertcats-base-contract.json').read_bytes())
check(digest(POLICY)=='0d3316ce98f2df01b16883e213a563588119f6c6af96baa590f99803aa66abaf','DESERTCATS_POLICY_REQUIRED')
AWARDS={tuple(x) for x in POLICY['awardTableWinPatterns']};POSITIONS=set(POLICY['positionPatterns'])
JOINTS={tuple(x) for x in POLICY['quickSymbolWildJointPatterns']}
SOURCE='desertcats-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='desertcats',gameID='20315',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'desertcats-base-wms-v1','mode':'demo','buy':0,'betRaw':200,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32762,'runtimeGameId':32984,'wmsGameId':20315,'ordinaryContractHash':'0d3316ce98f2df01b16883e213a563588119f6c6af96baa590f99803aa66abaf',
 'historyFileSha256':'2fa8a267fbd1678e6e800117afde685f0d32bf414c5feffe4d22b9c727a0f256','fullBaseRounds':1000,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo QuickHits Symbol WildReel'),'ReelResults':('numSpins','ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin'),
 'ReelStops':('',''),'PaylineWin':('index winVal awardIndex awardTableIndex',''),'BGInfo':('totalWagerWin bgWinnings baseGameSpinsRemaining isBigBet isMaxWin',''),
 'QuickHits':('winValue numOfGems',''),'Symbol':('replacement',''),'WildReel':('pattern','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'DESERTCATS_FEATURE_NOT_ADAPTED')
    check(not (n.text or '').strip() or n.tag in ('CurrencyMultiplier','ReelStops','PaylineWin','Stakes'),'DESERTCATS_FEATURE_NOT_ADAPTED')
    check(not (n.tail or '').strip(),'DESERTCATS_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'DESERTCATS_REQUEST_MISMATCH')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'DESERTCATS_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['Header','Stake','PaylineCount','AccountData'],'DESERTCATS_REQUEST_MISMATCH')
        check(stake.attrib==dict(total='200') and not len(stake),'DESERTCATS_REQUEST_MODE')
        lines=one(q,'PaylineCount');check(lines.attrib==dict(count='50') and not len(lines),'DESERTCATS_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and not (a.text or '').strip() and not (c.tail or '').strip() and len(a)==1 and not c.attrib and not len(c) and c.text=='1','DESERTCATS_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'DESERTCATS_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20315'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'DESERTCATS_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 200 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'DESERTCATS_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'DESERTCATS_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'DESERTCATS_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and [n.tag for n in root]==['Header','AccountData','Balances'] and not len(one(root,'AccountData')) and not (one(root,'AccountData').text or '').strip() and not any(n.tag=='GameResult' for n in root),'DESERTCATS_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult'],'DESERTCATS_SEQUENCE_MISMATCH')
            account=one(root,'AccountData');check([n.tag for n in account]==['AccountData'],'DESERTCATS_RESPONSE_CURRENCY');inner=one(account,'AccountData');c=one(inner,'CurrencyMultiplier')
            check(not inner.attrib and len(inner)==1 and not c.attrib and not len(c) and c.text=='1','DESERTCATS_RESPONSE_CURRENCY')
            g=one(root,'GameResult');check([n.tag for n in g]==['ReelResults','BGInfo','QuickHits','Symbol','WildReel'],'DESERTCATS_FEATURE_NOT_ADAPTED');win=amount(g.get('totalWin'))
            check(g.attrib==dict(stake='200',stakePerLine='4',paylineCount='50',totalWin=str(win),betID=''),'DESERTCATS_WAGER_MISMATCH')
            bg=one(g,'BGInfo');check(bg.attrib==dict(totalWagerWin=str(win),bgWinnings=str(win),baseGameSpinsRemaining='0',isBigBet='0',isMaxWin='0'),'DESERTCATS_CUMULATIVE_WIN_MISMATCH')
            qh=one(g,'QuickHits');symbol=one(g,'Symbol');wild=one(g,'WildReel');gems=amount(qh.get('numOfGems'));quick=amount(qh.get('winValue'));replacement=amount(symbol.get('replacement'))
            check(qh.attrib==dict(winValue=str(quick),numOfGems=str(gems)) and symbol.attrib==dict(replacement=str(replacement)) and wild.attrib==dict(pattern=wild.get('pattern'))
                and (gems,quick,replacement,wild.get('pattern')) in JOINTS,'DESERTCATS_QUICK_SYMBOL_WILD_NOT_REVIEWED')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');ps=[n for n in spin if n.tag=='PaylineWin'];spin_win=amount(spin.get('spinWins'))
            check(reels.attrib==dict(numSpins='1') and [n.tag for n in reels]==['ReelSpin'],'DESERTCATS_REEL_STATE_MISMATCH')
            check(len(ps)<=50 and spin.attrib==dict(spinIndex='0',reelsetIndex='0',winCountPL=str(len(ps)),winCountSC='0',spinWins=str(spin_win),freeSpin='N',bonusAwarded='N')
                and [n.tag for n in spin]==['ReelStops']+['PaylineWin']*len(ps),'DESERTCATS_FEATURE_NOT_ADAPTED')
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==7,'DESERTCATS_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            total=0;lines=set()
            for p in ps:
                line=amount(p.get('index'));award=amount(p.get('awardIndex'));table=amount(p.get('awardTableIndex'));v=amount(p.get('winVal'))
                check(line<50 and line not in lines and p.attrib==dict(index=str(line),winVal=str(v),awardIndex=str(award),awardTableIndex=str(table))
                    and (award,table,v) in AWARDS and not len(p) and p.text in POSITIONS,'DESERTCATS_PAYLINE_NOT_REVIEWED')
                xs=[amount(x) for x in p.text.split('|')];check(3<=len(xs)<=7 and len(set(xs))==len(xs) and all(x<28 for x in xs),'DESERTCATS_PAYLINE_POSITIONS_NOT_REVIEWED')
                lines.add(line);total+=v;amount(total)
            # Reel awards and the separate QuickHits award each enter Logic/cash once.
            check(total==spin_win and total+quick==win,'DESERTCATS_REEL_WIN_MISMATCH');balance=start-200+win;amount(balance);next_msg='EndGame'

        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==200,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=2,mul=s['win']/200,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=200))
class DesertCatsBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32762 and plan.get('runtimeGameId')==32984 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='desertcats-base-wms-v1'
              and plan.get('betRaw')==200 and plan.get('buy')==0 and plan.get('maxSteps')==2,'DESERTCATS_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'DESERTCATS_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
