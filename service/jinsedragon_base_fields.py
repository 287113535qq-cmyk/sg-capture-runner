"""Independent, ordinary-only Jinse Dao Dragon WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
import pathlib,json
from store import digest
POLICY=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-jinsedragon-base-contract.json').read_bytes())
check(digest(POLICY)=='5544bd8d6b4e4f715a0e50387d344b5c7c05c50368dfe37a325ba29e7b993561','JINSEDRAGON_POLICY_REQUIRED')
JOINTS={digest(x) for x in POLICY['stateJointPatterns']}

SOURCE='jinsedaodragon-base-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='jinsedaodragon',gameID='20401',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'jinsedragon-base-wms-v1','mode':'demo','buy':0,'betRaw':100,
 'baseBonus':0,'freeTypes':{},'evidence':{'captureGameId':32779,'runtimeGameId':33001,'wmsGameId':20401,'ordinaryContractHash':'5544bd8d6b4e4f715a0e50387d344b5c7c05c50368dfe37a325ba29e7b993561',
 'historyFileSha256':'5d3f8f5479ec8716e91a70b114c5ab47a79d760895e1b444cbee05e23ad10996','fullBaseRounds':993,'fullFreeRounds':0}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID readyForEndGame isRecovering',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo Orbs'),'ReelResults':('numSpins','ReelSpin'),
 'ReelSpin':('spinIndex reelsetIndex anywayWins scatterWinCount totalSpinWin freeSpin bonusAwarded','ReelStops AnywayWin'),
 'ReelStops':('',''),'AnywayWin':('winIndex winVal ways awardIndex',''),'BGInfo':('totalWagerWin bgWinnings baseGameSpinsRemaining isMaxWin expReelTriggerType reelHeights',''),'Orbs':('numJackpotWins','Orb'),'Orb':('awardIndex amount position winning isJackpot','')}
def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'JINSEDRAGON_FEATURE_NOT_ADAPTED')
    check(not (n.text or '').strip() or n.tag in ('CurrencyMultiplier','ReelStops','AnywayWin','Stakes'),'JINSEDRAGON_FEATURE_NOT_ADAPTED')
    check(not (n.tail or '').strip(),'JINSEDRAGON_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'JINSEDRAGON_REQUEST_MISMATCH')
    for n in q.iter():check(not (n.text or '').strip() or n.tag=='CurrencyMultiplier','JINSEDRAGON_REQUEST_MODE');check(not (n.tail or '').strip(),'JINSEDRAGON_REQUEST_MODE')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'JINSEDRAGON_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['AccountData','Header','Stake'],'JINSEDRAGON_REQUEST_MISMATCH')
        check(stake.attrib==dict(total='100') and not len(stake),'JINSEDRAGON_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and not (a.text or '').strip() and not (c.tail or '').strip() and len(a)==1 and not c.attrib and not len(c) and c.text=='1','JINSEDRAGON_REQUEST_MODE')
    else:check(msg in ('Init','EndGame') and [n.tag for n in q]==['Header'],'JINSEDRAGON_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20401'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'JINSEDRAGON_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 100 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'JINSEDRAGON_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'JINSEDRAGON_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=10,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=0;session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'JINSEDRAGON_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root)
        if next_msg=='EndGame':
            check(i==1 and one(root,'Header').get('readyForEndGame')=='N' and [n.tag for n in root]==['Header','AccountData','Balances'] and not one(root,'AccountData').attrib and not len(one(root,'AccountData')) and not any(n.tag=='GameResult' for n in root),'JINSEDRAGON_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 and [n.tag for n in root]==['Header','AccountData','Balances','GameResult'],'JINSEDRAGON_SEQUENCE_MISMATCH')
            account=one(root,'AccountData');check([n.tag for n in account]==['AccountData'],'JINSEDRAGON_RESPONSE_CURRENCY');inner=one(account,'AccountData');c=one(inner,'CurrencyMultiplier')
            check(not inner.attrib and len(inner)==1 and not c.attrib and not len(c) and c.text=='1','JINSEDRAGON_RESPONSE_CURRENCY')
            g=one(root,'GameResult');check([n.tag for n in g]==['ReelResults','BGInfo','Orbs'],'JINSEDRAGON_FEATURE_NOT_ADAPTED');win=amount(g.get('totalWin'))
            check(g.attrib==dict(stake='100',stakePerLine='100',paylineCount='1',totalWin=str(win),betID=''),'JINSEDRAGON_WAGER_MISMATCH')
            bg=one(g,'BGInfo');orbs=one(g,'Orbs');items=list(orbs)
            check(orbs.get('numJackpotWins')=='0' and all(not (n.get('isJackpot')=='y' and n.get('winning')=='y') for n in items),'JINSEDRAGON_FEATURE_NOT_ADAPTED')
            check(one(root,'Header').get('readyForEndGame')=='Y','JINSEDRAGON_FEATURE_NOT_ADAPTED')
            check(bg.attrib==dict(totalWagerWin=str(win),bgWinnings=str(win),baseGameSpinsRemaining='0',isMaxWin='0',expReelTriggerType=bg.get('expReelTriggerType'),reelHeights=bg.get('reelHeights')),'JINSEDRAGON_CUMULATIVE_WIN_MISMATCH')
            reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');ps=[n for n in spin if n.tag=='AnywayWin'];spin_win=amount(spin.get('totalSpinWin'))
            check(reels.attrib==dict(numSpins='1') and [n.tag for n in reels]==['ReelSpin'],'JINSEDRAGON_REEL_STATE_MISMATCH')
            check(len(ps)<=2 and spin.attrib==dict(spinIndex='0',reelsetIndex='0',anywayWins=str(len(ps)),scatterWinCount='0',totalSpinWin=str(spin_win),freeSpin='N',bonusAwarded='N') and [n.tag for n in spin]==['ReelStops']+['AnywayWin']*len(ps),'JINSEDRAGON_FEATURE_NOT_ADAPTED')
            check(digest(dict(expReelTriggerType=bg.get('expReelTriggerType'),reelHeights=bg.get('reelHeights'),orbs=dict(attrs=orbs.attrib,items=[n.attrib for n in items]))) in JOINTS,'JINSEDRAGON_STATE_JOINT_NOT_REVIEWED')
            check(orbs.attrib==dict(numJackpotWins='0') and len(items) in POLICY['orbCounts'] and [n.tag for n in orbs]==['Orb']*len(items),'JINSEDRAGON_ORBS_NOT_REVIEWED')
            orb_win=0
            for index,n in enumerate(items):
                award=amount(n.get('awardIndex'));v=amount(n.get('amount'))
                check(n.attrib==dict(awardIndex=str(award),amount=str(v),position=str(index),winning=n.get('winning'),isJackpot=n.get('isJackpot')) and not len(n) and n.get('winning') in ('n','y') and n.get('isJackpot') in ('n','y') and [award,v] in POLICY['orbAwardAmountPatterns'],'JINSEDRAGON_ORBS_NOT_REVIEWED')
                if n.get('winning')=='y':orb_win+=v;amount(orb_win)
            stops=one(spin,'ReelStops');check(not len(stops) and len((stops.text or '').split('|'))==5,'JINSEDRAGON_REEL_STATE_MISMATCH')
            for v in stops.text.split('|'):amount(v)
            total=0
            for index,p in enumerate(ps):
                award=amount(p.get('awardIndex'));ways=amount(p.get('ways'));v=amount(p.get('winVal'))
                check(p.attrib==dict(winIndex=str(index),winVal=str(v),ways=str(ways),awardIndex=str(award)) and [award,ways,v] in POLICY['awardWaysWinPatterns'] and not len(p) and p.text in POLICY['positionPatterns'],'JINSEDRAGON_ANYWAY_NOT_REVIEWED')
                xs=[amount(x) for x in p.text.split('|')];check(len(xs) in POLICY['positionLengths'] and len(set(xs))==len(xs) and all(x<40 for x in xs),'JINSEDRAGON_ANYWAY_POSITIONS_NOT_REVIEWED');total+=v;amount(total)
            check(total==spin_win and spin_win+orb_win==win,'JINSEDRAGON_REEL_WIN_MISMATCH');balance=start-100+win;amount(balance);next_msg='EndGame'

        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=False)
def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==100,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=1,mul=s['win']/100,buy=0,bonus=0,primaryBonusKind='none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=100))
class JinseDragonBaseFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32779 and plan.get('runtimeGameId')==33001 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='jinsedragon-base-wms-v1'
              and plan.get('betRaw')==100 and plan.get('buy')==0 and plan.get('maxSteps')==2,'JINSEDRAGON_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'JINSEDRAGON_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
