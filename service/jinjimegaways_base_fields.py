"""Independent, ordinary-only Jin Ji Bao Xi Endless Treasure Megaways WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
import pathlib,json
from store import digest
POLICY=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-jinjimegaways-base-contract.json').read_bytes())
check(digest(POLICY)=='926f8323ca18ff889886cb0a81c746165ec78f6faab7b29cbcd0019412d3211d','JINJIMEGAWAYS_POLICY_REQUIRED')
JOINTS={digest(x) for x in POLICY['reelHeightJointPatterns']}

SOURCE='jjbxmegaways-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='jjbxmegaways',gameID='20468',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'jinjimegaways-base-wms-v1','mode':'demo','buy':0,'betRaw':88,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32777,'runtimeGameId':32999,'wmsGameId':20468,'ordinaryContractHash':'926f8323ca18ff889886cb0a81c746165ec78f6faab7b29cbcd0019412d3211d',
 'historyFileSha256':'36b403ed282ac179f11e516f396b74fd09d978db9dc414c3f02a74c641f57232','fullBaseRounds':991,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult SymbolGrids'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering readyForEndGame',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake totalWin betID','ReelResults BGInfo TopReelInfo'),'ReelResults':('numSpins','ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex anywayWins scatterWinCount totalSpinWin freeSpin bonusAwarded','ReelStops AnywayWin'),
 'ReelStops':('',''),'AnywayWin':('winIndex winVal ways awardIndex',''),'BGInfo':('totalWagerWin bgWinnings reelHeights isMaxWin',''),'TopReelInfo':('reelSetIndex reelStop positions',''),'SymbolGrids':('','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'JINJIMEGAWAYS_FEATURE_NOT_ADAPTED')
    check(not (n.text or '').strip() or n.tag in ('CurrencyMultiplier','ReelStops','AnywayWin','Stakes'),'JINJIMEGAWAYS_FEATURE_NOT_ADAPTED')
    check(not (n.tail or '').strip(),'JINJIMEGAWAYS_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'JINJIMEGAWAYS_REQUEST_MISMATCH')
    for n in q.iter():check(not (n.text or '').strip() or n.tag=='CurrencyMultiplier','JINJIMEGAWAYS_REQUEST_MODE');check(not (n.tail or '').strip(),'JINJIMEGAWAYS_REQUEST_MODE')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'JINJIMEGAWAYS_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['AccountData','Header','Stake'],'JINJIMEGAWAYS_REQUEST_MISMATCH')
        check(stake.attrib==dict(total='88') and not len(stake),'JINJIMEGAWAYS_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and not (a.text or '').strip() and not (c.tail or '').strip() and len(a)==1 and not c.attrib and not len(c) and c.text=='1','JINJIMEGAWAYS_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'JINJIMEGAWAYS_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20468'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'JINJIMEGAWAYS_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 88 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'JINJIMEGAWAYS_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'JINJIMEGAWAYS_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'JINJIMEGAWAYS_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and one(root,'Header').get('readyForEndGame')=='N' and [n.tag for n in root]==['Header','AccountData','Balances'] and not one(root,'AccountData').attrib and not len(one(root,'AccountData')) and not any(n.tag=='GameResult' for n in root),'JINJIMEGAWAYS_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult','SymbolGrids'],'JINJIMEGAWAYS_SEQUENCE_MISMATCH')
            account=one(root,'AccountData');check([n.tag for n in account]==['AccountData'],'JINJIMEGAWAYS_RESPONSE_CURRENCY');inner=one(account,'AccountData');c=one(inner,'CurrencyMultiplier')
            check(not inner.attrib and len(inner)==1 and not c.attrib and not len(c) and c.text=='1','JINJIMEGAWAYS_RESPONSE_CURRENCY')
            g=one(root,'GameResult');check(one(root,'Header').get('readyForEndGame')=='Y' and [n.tag for n in g]==['ReelResults','BGInfo','TopReelInfo'],'JINJIMEGAWAYS_FEATURE_NOT_ADAPTED');win=amount(g.get('totalWin'))
            check(g.attrib==dict(stake='88',totalWin=str(win),betID=''),'JINJIMEGAWAYS_WAGER_MISMATCH')
            bg=one(g,'BGInfo');check(bg.attrib==dict(totalWagerWin=str(win),bgWinnings=str(win),reelHeights=bg.get('reelHeights'),isMaxWin='0'),'JINJIMEGAWAYS_CUMULATIVE_WIN_MISMATCH')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');ps=[n for n in spin if n.tag=='AnywayWin'];reel=amount(spin.get('reelsetIndex'));pattern=POLICY['perReelsetAnywayPatterns'].get(str(reel))
            check(reels.attrib==dict(numSpins='1') and [n.tag for n in reels]==['ReelSpin'],'JINJIMEGAWAYS_REEL_STATE_MISMATCH')
            check(pattern is not None and len(ps)<=pattern['maxAnywayWins'] and spin.attrib==dict(spinIndex='0',reelsetIndex=str(reel),anywayWins=str(len(ps)),scatterWinCount='0',totalSpinWin=str(win),freeSpin='N',bonusAwarded='N') and [n.tag for n in spin]==['ReelStops']+['AnywayWin']*len(ps),'JINJIMEGAWAYS_FEATURE_NOT_ADAPTED')
            check(digest(dict(reelsetIndex=str(reel),reelHeights=bg.get('reelHeights'))) in JOINTS,'JINJIMEGAWAYS_REEL_HEIGHT_JOINT_NOT_REVIEWED')
            top=one(g,'TopReelInfo');top_stop=amount(top.get('reelStop'));check(top.attrib==dict(reelSetIndex='9',reelStop=str(top_stop),positions='37|38|39|40') and top_stop in POLICY['topReelStops'],'JINJIMEGAWAYS_TOP_REEL_NOT_REVIEWED')
            grid=one(root,'SymbolGrids');check(not grid.attrib and not len(grid) and not (grid.text or '').strip(),'JINJIMEGAWAYS_SYMBOL_GRID_NOT_REVIEWED')
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==6,'JINJIMEGAWAYS_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            total=0
            for index,p in enumerate(ps):
                award=amount(p.get('awardIndex'));ways=amount(p.get('ways'));v=amount(p.get('winVal'))
                check(p.attrib==dict(winIndex=str(index),winVal=str(v),ways=str(ways),awardIndex=str(award)) and [award,ways,v] in pattern['awardWaysWinPatterns'] and not len(p) and p.text in pattern['positionPatterns'],'JINJIMEGAWAYS_ANYWAY_NOT_REVIEWED')
                xs=[amount(x) for x in p.text.split('|')];check(len(xs) in POLICY['positionLengths'] and len(set(xs))==len(xs) and all(x<41 for x in xs),'JINJIMEGAWAYS_ANYWAY_POSITIONS_NOT_REVIEWED')
                total+=v;amount(total)
            check(total==win,'JINJIMEGAWAYS_REEL_WIN_MISMATCH');balance=start-88+win;amount(balance);next_msg='EndGame'

        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==88,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=.88,mul=s['win']/88,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=88))
class JinjiMegawaysBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32777 and plan.get('runtimeGameId')==32999 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='jinjimegaways-base-wms-v1'
              and plan.get('betRaw')==88 and plan.get('buy')==0 and plan.get('maxSteps')==2,'JINJIMEGAWAYS_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'JINJIMEGAWAYS_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
