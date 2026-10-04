"""Independent, ordinary-only Cool Jewels WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
import pathlib,json
from store import digest
POLICY=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-cooljewels-base-contract.json').read_bytes())
check(digest(POLICY)=='701a7cd045cce2959ce8ae748f056a97142b1eb673367e22b17f389f9254ad5a','COOLJEWELS_POLICY_REQUIRED')
AWARDS={tuple(x) for x in POLICY['awardPatterns']};POSITIONS=set(POLICY['positionPatterns']);ROOT_POSITIONS={tuple(x) for x in POLICY['rootPositionPatterns']}
SOURCE='cooljewels-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='cooljewels_prt',gameID='20150',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'cooljewels-base-wms-v1','mode':'demo','buy':0,'betRaw':50,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32758,'runtimeGameId':32980,'wmsGameId':20150,'ordinaryContractHash':'701a7cd045cce2959ce8ae748f056a97142b1eb673367e22b17f389f9254ad5a',
 'historyFileSha256':'a9419249c81f4673a537160835a54f248802db482dd6711fa24fda405dd202aa','fullBaseRounds':994,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','ReelResults ReactorChain MaxWin_Info'),'ReelResults':('numSpins','ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops'),'ReelStops':('',''),
 'ReactorChain':('num_drops','ReactorDrop'),'ReactorDrop':('drop_order num_clusters','ReactorLayout ReactorCluster'),
 'ReactorLayout':('symbols',''),'ReactorCluster':('id cluster_positions cluster_awards rootSymbol rootSymbolPos watermark',''),'MaxWin_Info':('maxWinValue maxWin cappedWins','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'COOLJEWELS_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'COOLJEWELS_REQUEST_MISMATCH')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'COOLJEWELS_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['Header','AccountData','Stake'],'COOLJEWELS_REQUEST_MISMATCH')
        check(stake.attrib==dict(multiplier='1',total='50') and not len(stake),'COOLJEWELS_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and len(a)==1 and not c.attrib and not len(c) and c.text=='1','COOLJEWELS_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'COOLJEWELS_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20150'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'COOLJEWELS_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 50 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'COOLJEWELS_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'COOLJEWELS_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=2,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'COOLJEWELS_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and [n.tag for n in root]==['Header','Balances'] and not any(n.tag=='GameResult' for n in root),'COOLJEWELS_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult'],'COOLJEWELS_SEQUENCE_MISMATCH')
            account=one(root,'AccountData');check([n.tag for n in account]==['AccountData'],'COOLJEWELS_RESPONSE_CURRENCY');inner=one(account,'AccountData');c=one(inner,'CurrencyMultiplier')
            check(not inner.attrib and len(inner)==1 and not c.attrib and not len(c) and c.text=='1','COOLJEWELS_RESPONSE_CURRENCY')
            g=one(root,'GameResult');check([n.tag for n in g]==['ReelResults','ReactorChain','MaxWin_Info'],'COOLJEWELS_FEATURE_NOT_ADAPTED')
            check(g.get('stake')=='50' and g.get('stakePerLine')=='0' and g.get('paylineCount')=='0' and g.get('betID')=='','COOLJEWELS_WAGER_MISMATCH');win=amount(g.get('totalWin'))
            cap=one(g,'MaxWin_Info');check(cap.attrib==dict(maxWinValue='25000000',maxWin='false',cappedWins='0') and not len(cap),'COOLJEWELS_MAXWIN_NOT_ADAPTED')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');check(reels.attrib==dict(numSpins='1') and [n.tag for n in reels]==['ReelSpin'],'COOLJEWELS_REEL_STATE_MISMATCH')
            check(spin.attrib==dict(spinIndex='0',reelsetIndex='0',winCountPL='0',winCountSC='0',spinWins='0',freeSpin='N',bonusAwarded='N') and [n.tag for n in spin]==['ReelStops'],'COOLJEWELS_FEATURE_NOT_ADAPTED')
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==6,'COOLJEWELS_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            chain=one(g,'ReactorChain');drops=list(chain);check(1<=len(drops)<=6 and chain.attrib==dict(num_drops=str(len(drops))),'COOLJEWELS_REACTOR_COUNTER');total=0
            for di,drop in enumerate(drops):
                cs=[n for n in drop if n.tag=='ReactorCluster']
                check(drop.tag=='ReactorDrop' and drop.attrib==dict(drop_order=str(di),num_clusters=str(len(cs))) and len(cs)<=7
                    and [n.tag for n in drop]==['ReactorLayout']+['ReactorCluster']*len(cs) and (len(cs)==0 if di==len(drops)-1 else len(cs)>0),'COOLJEWELS_REACTOR_COUNTER')
                layout=one(drop,'ReactorLayout');sy=(layout.get('symbols') or '').split('|')
                check(len(sy)==36 and not len(layout) and all(x in POLICY['layoutSymbols'] for x in sy),'COOLJEWELS_LAYOUT_NOT_REVIEWED')
                for ci,c in enumerate(cs):
                    ps=(c.get('cluster_positions') or '').split('|');av=(c.get('cluster_awards') or '').split('|')
                    check(c.get('id')==str(ci) and not len(c) and c.get('cluster_positions') in POSITIONS and len(ps)==len(set(ps))==len(av) and len(ps) in POLICY['awardLengths']
                        and all(len(x)==3 and x[1]==',' and x[0] in '012345' and x[2] in '012345' for x in ps)
                        and (c.get('rootSymbol'),c.get('rootSymbolPos')) in ROOT_POSITIONS
                        and (di,c.get('rootSymbol'),c.get('watermark'),c.get('cluster_awards')) in AWARDS,'COOLJEWELS_CLUSTER_NOT_REVIEWED')
                    # Response awards are final contributions, counted once.
                    for v in av:total+=amount(v);amount(total)
            check(total==win,'COOLJEWELS_REACTOR_WIN_MISMATCH');balance=start-50+win;amount(balance);next_msg='EndGame'
        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==50,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=0.5,mul=s['win']/50,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=50))
class CoolJewelsBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32758 and plan.get('runtimeGameId')==32980 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='cooljewels-base-wms-v1'
              and plan.get('betRaw')==50 and plan.get('buy')==0 and plan.get('maxSteps')==2,'COOLJEWELS_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'COOLJEWELS_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
