"""Independent, Blazing X Asia ordinary and evidenced ten-free WMS decoder. No network/storage."""
from pearl_fields import parse, one
from round_fields import amount, check, VERSION, type_profile
SOURCE='blazingxasia-ag-rolling-wms-v1'
HEADER=dict(affiliate='0',ccyCode='',channel='I',freePlay='Y',gameCodeRGI='blazingxasia',gameID='20363',
            glsID='65535',lang='en_US',promotions='N',userID='null',userType='C',versionID='1_0')
TYPE_PROFILE={'fixtureOnly':False,'protocol':'wms','adapter':'blazing-x-wms-v1','mode':'demo','buy':0,'betRaw':240,
 'baseBonus':0,'freeTypes':{'automatic-ten-free':1},'evidence':{'captureGameId':32755,'runtimeGameId':32977,'wmsGameId':20363,
 'historyFileSha256':'acf144670a09a7d65415c4b67ce9afee874d42748aed776a20475859e118858b','fullBaseRounds':997,'fullFreeRounds':3}}
SCHEMA={'GameResponse':('type','Header AccountData Balances GameResult'),
 'Header':('sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering readyForEndGame',''),
 'AccountData':('','AccountData CurrencyMultiplier'),'CurrencyMultiplier':('',''),'Balances':('','Balance'),'Balance':('name value',''),
 'GameResult':('stake stakePerLine paylineCount totalWin betID','ReelResults XInfo BGInfo FSInfo BaseGameRecoveryInfo'),
 'ReelResults':('numSpins','ReelSpin'),'ReelSpin':('spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin ScatterWin'),
 'ReelStops':('',''),'PaylineWin':('index winVal awardIndex awardTableIndex',''),'ScatterWin':('awardIndex winVal',''),
 'XInfo':('currentX previousX currSpinToReset prevSpinToReset',''),'BGInfo':('totalWagerWin bgWinnings isMaxWin',''),
 'FSInfo':('scatterPayout fsWinnings freeSpinsTotal freeSpinNumber isMaxWin currFSX prevFSX',''),'BaseGameRecoveryInfo':('','ReelResults')}

def shape(n,schema=SCHEMA):
    spec=schema.get(n.tag)
    check(spec is not None and set(n.attrib)<=set(spec[0].split()) and all(c.tag in spec[1].split() for c in n),'BLAZING_FEATURE_NOT_ADAPTED')
    for c in n:shape(c,schema)
def request(text,msg,first=False):
    q=parse(text);check(q.tag=='GameRequest' and q.attrib=={'type':msg},'BLAZING_REQUEST_MISMATCH')
    h=one(q,'Header');check(not len(h) and {k:v for k,v in h.attrib.items() if k!='sessionID'}==HEADER,'BLAZING_REQUEST_MODE')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    if first:
        stake=one(q,'Stake');check(msg=='Logic' and [n.tag for n in q]==['Header','Stake','PaylineCount','AccountData'],'BLAZING_REQUEST_MISMATCH')
        check(stake.attrib=={'total':'240'} and not len(stake) and one(q,'PaylineCount').attrib=={'count':'40'} and not len(one(q,'PaylineCount')),'BLAZING_REQUEST_MODE')
        a=one(q,'AccountData');c=one(a,'CurrencyMultiplier')
        check(not a.attrib and len(a)==1 and not c.attrib and not len(c) and c.text=='1','BLAZING_REQUEST_MODE')
    else:check(msg in ('Init','Logic','EndGame') and [n.tag for n in q]==['Header'],'BLAZING_REQUEST_MISMATCH')
    return session
def response(text,msg):
    root=parse(text);h=one(root,'Header');check(root.tag=='GameResponse' and root.attrib=={'type':msg} and h.get('gameID')=='20363'
        and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','WMS_RESPONSE_IDENTITY_MISMATCH')
    session=h.get('sessionID');check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    b=one(root,'Balances');cash=one(b,'Balance');check(len(b)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH')
    return root,session,amount(cash.get('value'))
def bootstrap(step,session):
    check(step.get('msgId')=='Init' and request(step.get('requestPayload'),'Init')==session,'BLAZING_REQUEST_MISMATCH')
    check(step.get('responsePayload')==step.get('responseXml') and not step.get('sourceRejected') and amount(step.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
    root,value,balance=response(step['responsePayload'],'Init')
    init_schema={**SCHEMA,'GameResponse':('type','Header AccountData Balances GameInfo Stakes PageInfo'),
                 'GameInfo':('RTP','Stakes PageInfo'),'Stakes':('count defaultIndex type',''),'PageInfo':('pageCount','')}
    shape(root,init_schema);stakes=list(root.iter('Stakes'));pages=list(root.iter('PageInfo'))
    check(len(stakes)==1 and 240 in [amount(x) for x in (stakes[0].text or '').split('|') if x]
          and len(pages)<=1 and (not pages or amount(pages[0].get('pageCount'))<=1),'BLAZING_INIT_REQUIRES_REVIEW')
    check(amount(step.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return {'validated':True,'session':value,'balanceRaw':balance}
def mapping_hash():
    profile,h=type_profile(SOURCE);check(profile==TYPE_PROFILE,'WMS_MAPPING_REQUIRED');return h
X_TRANSITIONS=[['1', '1', '0', '0'], ['1', '2', '0', '3'], ['2', '2', '3', '2'], ['2', '2', '2', '1'], ['2', '3', '1', '3'], ['3', '3', '3', '2'], ['3', '3', '2', '1'], ['3', '3', '1', '0'], ['2', '3', '3', '3'], ['2', '2', '1', '0'], ['2', '2', '1', '1'], ['2', '3', '2', '3'], ['3', '5', '2', '3'], ['5', '5', '3', '2'], ['5', '5', '2', '1'], ['5', '5', '1', '0'], ['5', '10', '3', '3'], ['10', '10', '3', '2'], ['10', '25', '2', '3'], ['25', '25', '3', '2'], ['25', '25', '2', '3'], ['25', '25', '2', '1'], ['25', '25', '1', '0'], ['10', '10', '2', '1'], ['10', '10', '1', '0'], ['3', '5', '3', '3'], ['10', '25', '1', '3'], ['3', '5', '1', '3'], ['5', '10', '2', '3'], ['5', '10', '1', '3'], ['25', '25', '1', '3']]
FS_TRANSITIONS=[['2', '3'], ['3', '3'], ['3', '5'], ['5', '5'], ['1', '1'], ['1', '2'], ['2', '2'], ['5', '10'], ['10', '10']]
def exact(n,attrs):check(set(n.attrib)==set(attrs.split()),'BLAZING_FEATURE_NOT_ADAPTED')
def x_tuple(n):return [n.get(k) for k in ('previousX','currentX','prevSpinToReset','currSpinToReset')]
def same_node(a,b):return a.tag==b.tag and a.attrib==b.attrib and (a.text or '')==(b.text or '') and len(a)==len(b) and all(same_node(x,y) for x,y in zip(a,b))
def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='wms' and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'BLAZING_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=12,'INVALID_ROUND_STEPS')
    start=balance=amount(raw.get('startBalanceRaw'));win=base_win=scatter=0;feature=False;free_x=paid_reels=paid_x=session=None;next_msg='Logic'
    for i,s in enumerate(steps):
        check(next_msg is not None and s.get('msgId')==next_msg,'BLAZING_SEQUENCE_MISMATCH')
        prior=request(s.get('requestPayload'),next_msg,i==0);check(session is None or prior==session,'WMS_SESSION_CHAIN_MISMATCH')
        check(s.get('responsePayload')==s.get('responseXml') and not s.get('sourceRejected') and amount(s.get('elapsedMs'))<=300000,'WMS_XML_EVIDENCE_MISMATCH')
        root,session,cash=response(s['responsePayload'],next_msg);shape(root);ready=one(root,'Header').get('readyForEndGame')
        if next_msg=='EndGame':
            check(i==(11 if feature else 1) and ready=='N' and not any(n.tag=='GameResult' for n in root),'BLAZING_ENDGAME_MISMATCH');next_msg=None
        else:
            check(i==0 or feature and i<=10,'BLAZING_SEQUENCE_MISMATCH');g=one(root,'GameResult');exact(g,'stake stakePerLine paylineCount totalWin betID')
            check(g.get('stake')=='240' and g.get('stakePerLine')=='20' and g.get('paylineCount')=='40' and g.get('betID')=='','BLAZING_WAGER_MISMATCH')
            award=amount(g.get('totalWin'));bg=one(g,'BGInfo');reels=one(g,'ReelResults');spin=one(reels,'ReelSpin');x=one(g,'XInfo')
            exact(x,'currentX previousX currSpinToReset prevSpinToReset');exact(bg,'totalWagerWin bgWinnings isMaxWin')
            check(bg.get('isMaxWin')=='0' and reels.get('numSpins')=='1' and len(reels)==1,'BLAZING_REEL_STATE_MISMATCH')
            stops=one(spin,'ReelStops');values=(stops.text or '').split('|');check(len(values)==5,'BLAZING_REEL_STATE_MISMATCH')
            for v in values:amount(v)
            check(spin.get('spinIndex')=='0' and spin.get('reelsetIndex')==('0' if i==0 else '1') and spin.get('freeSpin')==('N' if i==0 else 'Y'),'BLAZING_REEL_STATE_MISMATCH')
            pays=list(spin.findall('PaylineWin'));sc=list(spin.findall('ScatterWin'));indices=set();total=0
            check(amount(spin.get('winCountPL'))==len(pays) and len(pays)<=40 and amount(spin.get('winCountSC'))==len(sc),'BLAZING_REEL_WIN_MISMATCH')
            for p in pays:
                exact(p,'index winVal awardIndex awardTableIndex');index=amount(p.get('index'))
                check(index<40 and index not in indices and p.get('awardTableIndex')=='0' and amount(p.get('awardIndex'))<=24,'BLAZING_PAYLINE_NOT_REVIEWED')
                indices.add(index);total+=amount(p.get('winVal'));amount(total)
            check(total==amount(spin.get('spinWins')),'BLAZING_REEL_WIN_MISMATCH')
            fs=list(g.findall('FSInfo'));recovery=list(g.findall('BaseGameRecoveryInfo'))
            if i==0:
                check(x_tuple(x) in X_TRANSITIONS and not recovery,'BLAZING_X_STATE_NOT_REVIEWED');base_win=award;paid_reels=reels;paid_x=x;feature=len(fs)==1
                if feature:
                    f=fs[0];exact(f,'scatterPayout fsWinnings freeSpinsTotal freeSpinNumber isMaxWin');scatter=amount(f.get('scatterPayout'))
                    check(scatter in (480,960) and [n.tag for n in g]==['ReelResults','XInfo','BGInfo','FSInfo']
                          and x_tuple(x) in [['2','2','1','1'],['1','1','0','0'],['2','2','2','1']]
                          and len(sc)==1 and sc[0].attrib=={'awardIndex':'0','winVal':'0'} and not pays and total==0 and award==scatter
                          and spin.get('bonusAwarded')=='Y' and f.get('freeSpinsTotal')=='10' and f.get('freeSpinNumber')=='0' and f.get('fsWinnings')=='0' and f.get('isMaxWin')=='0' and ready=='N','BLAZING_UNREVIEWED_FREE')
                    free_x=x.get('currentX');next_msg='Logic'
                else:
                    check(not fs and [n.tag for n in g]==['ReelResults','XInfo','BGInfo'] and not sc and spin.get('bonusAwarded')=='N' and total==award and ready=='Y','BLAZING_FEATURE_NOT_ADAPTED');next_msg='EndGame'
            else:
                check(len(fs)==len(recovery)==1 and [n.tag for n in g]==['ReelResults','BaseGameRecoveryInfo','XInfo','BGInfo','FSInfo'] and len(recovery[0])==1
                      and same_node(one(recovery[0],'ReelResults'),paid_reels) and spin.get('bonusAwarded')=='N' and not sc and total==award,'BLAZING_FREE_REEL_MISMATCH')
                f=fs[0];exact(f,'scatterPayout fsWinnings freeSpinsTotal freeSpinNumber isMaxWin currFSX prevFSX')
                check(f.get('freeSpinsTotal')=='10' and amount(f.get('freeSpinNumber'))==i and f.get('isMaxWin')=='0' and amount(f.get('scatterPayout'))==scatter
                      and f.get('prevFSX')==free_x and [f.get('prevFSX'),f.get('currFSX')] in FS_TRANSITIONS and amount(f.get('fsWinnings'))==win+award-base_win,'BLAZING_FREE_COUNTER_MISMATCH')
                check(same_node(x,paid_x) or i==10 and x_tuple(paid_x)==['2','2','1','1'] and x_tuple(x)==['2','1','1','0'],'BLAZING_X_STATE_NOT_REVIEWED')
                check(ready==('Y' if i==10 else 'N'),'BLAZING_FREE_COUNTER_MISMATCH');free_x=f.get('currFSX');next_msg='EndGame' if i==10 else 'Logic'
            win+=award;amount(win);check(amount(bg.get('totalWagerWin'))==win and amount(bg.get('bgWinnings'))==base_win,'BLAZING_CUMULATIVE_WIN_MISMATCH')
            balance=start-240+win;amount(balance)
        check(cash==balance and amount(s.get('responseBalance'))==balance,'WMS_BALANCE_MISMATCH')
    return dict(next=next_msg,session=session,start=start,balance=balance,win=win,feature=feature)

def settled(raw,mapping):
    s=review(raw);check(s['next'] is None and s['start']-s['balance']+s['win']==240,'INCOMPLETE_ROUND')
    check(isinstance(mapping,str) and len(mapping)==64 and all(c in '0123456789abcdef' for c in mapping),'WMS_MAPPING_REQUIRED')
    return dict(roundFieldsVersion=VERSION,protocol='wms',sourceKey=SOURCE,bet=2.4,mul=s['win']/240,buy=0,bonus=1 if s['feature'] else 0,primaryBonusKind='free' if s['feature'] else 'none',typeMappingHash=mapping,
        money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=240))
class BlazingXFields:
    def __init__(self,plan):
        check(plan.get('gameId')==32755 and plan.get('runtimeGameId')==32977 and plan.get('sourceKey')==SOURCE and plan.get('adapter')=='blazing-x-wms-v1'
              and plan.get('betRaw')==240 and plan.get('buy')==0 and plan.get('maxSteps')==12,'BLAZING_PROFILE_REQUIRED');self.plan=plan;mapping_hash()
    def next_request(self,raw):
        msg=review(raw)['next'];return {'MSGID':msg} if msg is not None else None
    def validate_intent(self,raw,payload):
        s=review(raw);check(s['next'] is not None,'BLAZING_SEQUENCE_MISMATCH');value=request(payload,s['next'],not raw['steps'])
        check(s['session'] is None or value==s['session'],'WMS_SESSION_CHAIN_MISMATCH');return {'validated':True}
    def bootstrap(self,step,session):return bootstrap(step,session)
    def settled(self,raw):return settled(raw,mapping_hash())
