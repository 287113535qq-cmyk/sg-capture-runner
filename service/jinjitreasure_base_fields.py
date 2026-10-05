"""Independent, ordinary-only Jin Ji Bao Xi Endless Treasures WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
import pathlib,json
from store import digest
POLICY=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-jinjitreasure-base-contract.json').read_bytes())
check(digest(POLICY)=='bdd2afed4391c69e552c36a3873d8efde2daaca01e2c6d4d1cb2a91a039670de','JINJITREASURE_POLICY_REQUIRED')
JOINTS={digest(x) for x in POLICY['stateJointPatterns']}

SOURCE='jinjibaoxiendlesstreasure-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='jinjibaoxiendlesstreasure',gameID='20322',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'jinjitreasure-base-wms-v1','mode':'demo','buy':0,'betRaw':16,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32778,'runtimeGameId':33000,'wmsGameId':20322,'ordinaryContractHash':'bdd2afed4391c69e552c36a3873d8efde2daaca01e2c6d4d1cb2a91a039670de',
 'historyFileSha256':'994ed0836b4d1cd17396f92f07808a188d415f426f57efdefdf1e3f394eb8f8e','fullBaseRounds':997,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake totalWin betID','ReelResults BGInfo MysterySymbol ScatterInfo'),'ReelResults':('numSpins','ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex anywayWins scatterWinCount totalSpinWin freeSpin bonusAwarded','ReelStops AnywayWin'),
 'ReelStops':('',''),'AnywayWin':('winIndex winVal ways awardIndex',''),'BGInfo':('totalWagerWin bgWinnings baseGameSpinsRemaining isMaxWin goldChanceAwarded jackpotAwarded gameMode',''),'MysterySymbol':('replacementSym',''),'ScatterInfo':('totalValue numScatters values','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'JINJITREASURE_FEATURE_NOT_ADAPTED')
    check(not (n.text or '').strip() or n.tag in ('CurrencyMultiplier','ReelStops','AnywayWin','Stakes'),'JINJITREASURE_FEATURE_NOT_ADAPTED')
    check(not (n.tail or '').strip(),'JINJITREASURE_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'JINJITREASURE_REQUEST_MISMATCH')
    for n in q.iter():check(not (n.text or '').strip() or n.tag=='CurrencyMultiplier','JINJITREASURE_REQUEST_MODE');check(not (n.tail or '').strip(),'JINJITREASURE_REQUEST_MODE')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'JINJITREASURE_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['Header','Stake','PaylineCount','AccountData'],'JINJITREASURE_REQUEST_MISMATCH')
        check(stake.attrib==dict(total='16',gameMode='0') and not len(stake),'JINJITREASURE_REQUEST_MODE')
        lines=one(q,'PaylineCount');check(lines.attrib==dict(count='1') and not len(lines),'JINJITREASURE_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and not (a.text or '').strip() and not (c.tail or '').strip() and len(a)==1 and not c.attrib and not len(c) and c.text=='1','JINJITREASURE_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'JINJITREASURE_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20322'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'JINJITREASURE_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 16 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'JINJITREASURE_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'JINJITREASURE_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'JINJITREASURE_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and [n.tag for n in root]==['Header','AccountData','Balances'] and not one(root,'AccountData').attrib and not len(one(root,'AccountData')) and not any(n.tag=='GameResult' for n in root),'JINJITREASURE_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult'],'JINJITREASURE_SEQUENCE_MISMATCH')
            account=one(root,'AccountData');check([n.tag for n in account]==['AccountData'],'JINJITREASURE_RESPONSE_CURRENCY');inner=one(account,'AccountData');c=one(inner,'CurrencyMultiplier')
            check(not inner.attrib and len(inner)==1 and not c.attrib and not len(c) and c.text=='1','JINJITREASURE_RESPONSE_CURRENCY')
            g=one(root,'GameResult');check([n.tag for n in g]==['ReelResults','BGInfo','MysterySymbol','ScatterInfo'],'JINJITREASURE_FEATURE_NOT_ADAPTED');win=amount(g.get('totalWin'))
            check(g.attrib==dict(stake='16',totalWin=str(win),betID=''),'JINJITREASURE_WAGER_MISMATCH')
            bg=one(g,'BGInfo');check(bg.attrib==dict(totalWagerWin=str(win),bgWinnings=str(win),baseGameSpinsRemaining='0',isMaxWin='0',goldChanceAwarded='0',jackpotAwarded='0',gameMode='0'),'JINJITREASURE_CUMULATIVE_WIN_MISMATCH')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');ps=[n for n in spin if n.tag=='AnywayWin']
            check(reels.attrib==dict(numSpins='1') and [n.tag for n in reels]==['ReelSpin'],'JINJITREASURE_REEL_STATE_MISMATCH')
            check(len(ps)<=2 and spin.attrib==dict(spinIndex='0',reelsetIndex='0',anywayWins=str(len(ps)),scatterWinCount='0',totalSpinWin=str(win),freeSpin='N',bonusAwarded='N') and [n.tag for n in spin]==['ReelStops']+['AnywayWin']*len(ps),'JINJITREASURE_FEATURE_NOT_ADAPTED')
            mystery=one(g,'MysterySymbol');scatter=one(g,'ScatterInfo');check(digest(dict(mystery=mystery.attrib,scatter=scatter.attrib)) in JOINTS,'JINJITREASURE_STATE_JOINT_NOT_REVIEWED')
            values=[amount(v) for v in scatter.get('values').split('|')];check(len(values)==15 and set(values)<={0,16} and sum(values)==amount(scatter.get('totalValue')) and sum(v!=0 for v in values)==amount(scatter.get('numScatters')),'JINJITREASURE_SCATTER_SHAPE_NOT_REVIEWED')
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==5,'JINJITREASURE_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            total=0
            for index,p in enumerate(ps):
                award=amount(p.get('awardIndex'));ways=amount(p.get('ways'));v=amount(p.get('winVal'))
                check(p.attrib==dict(winIndex=str(index),winVal=str(v),ways=str(ways),awardIndex=str(award)) and [award,ways,v] in POLICY['awardWaysWinPatterns'] and not len(p) and p.text in POLICY['positionPatterns'],'JINJITREASURE_ANYWAY_NOT_REVIEWED')
                xs=[amount(x) for x in p.text.split('|')];check(len(xs) in POLICY['positionLengths'] and len(set(xs))==len(xs) and all(x<15 for x in xs),'JINJITREASURE_ANYWAY_POSITIONS_NOT_REVIEWED');total+=v;amount(total)
            check(total==win,'JINJITREASURE_REEL_WIN_MISMATCH');balance=start-16+win;amount(balance);next_msg='EndGame'

        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==16,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=.16,mul=s['win']/16,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=16))
class JinjiTreasureBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32778 and plan.get('runtimeGameId')==33000 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='jinjitreasure-base-wms-v1'
              and plan.get('betRaw')==16 and plan.get('buy')==0 and plan.get('maxSteps')==2,'JINJITREASURE_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'JINJITREASURE_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
