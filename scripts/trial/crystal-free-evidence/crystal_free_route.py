"""Independent own control review. Not a record parser or live source admission."""
import re, xml.etree.ElementTree as ET

def check(value, reason):
    if not value: raise ValueError('CRYSTAL_ROUTE_'+reason)

def num(value):
    check(type(value) is str and re.fullmatch(r'0|[1-9][0-9]*',value) is not None,'NUMBER')
    n=int(value);check(n<=9007199254740991,'NUMBER');return n

def one(node,tag):
    a=[c for c in node if c.tag==tag];check(len(a)==1,'AMBIGUOUS_STRUCTURE');return a[0]

def exact(node,keys):
    check(set(node.attrib)==set(keys.split()) and not len(node),'CONTROL_SHAPE')

def inspect_control(case):
    check(case.get('gameId')==32759,'OWN_GAME')
    text=case['xml'];check(isinstance(text,str) and 0<len(text)<262144 and re.search(r'<!DOCTYPE|<!ENTITY',text,re.I) is None,'XML')
    root=ET.fromstring(text);h=one(root,'Header');previous=case.get('previous')
    check(root.tag=='GameResponse' and root.attrib=={'type':'Logic'},'MESSAGE')
    check(h.get('gameID')=='20142' and h.get('versionID')=='1_0' and h.get('isRecovering')=='N','IDENTITY')
    g=one(root,'GameResult');bg=one(g,'BGInfo');rs=one(g,'ReelResults');spin=one(rs,'ReelSpin')
    check(g.get('stake')=='25' and g.get('stakePerLine')=='1' and g.get('paylineCount')=='25','STAKE')
    check(rs.get('numSpins')=='1' and len(rs)==1 and spin.get('spinIndex')=='0','SPIN')
    check(spin.get('freeSpin') in ('N','Y') and spin.get('bonusAwarded') in ('N','Y'),'SPIN_FLAG')
    exact(bg,'totalWagerWin bgWinnings baseGameSpinsRemaining isBigBet isMaxWin')
    check(bg.get('baseGameSpinsRemaining')=='0' and bg.get('isBigBet')=='0','UNREVIEWED_MODE')
    check(bg.get('isMaxWin')=='0','MAXWIN_REQUIRES_OWN_TERMINAL')
    fs=[n for n in g if n.tag=='FSInfo'];check(len(fs)<=1,'AMBIGUOUS_FREE')
    base={'schema':'sg-crystal-own-control-review-v1','captureAuthorized':False,'businessComplete':False,'moneyValidated':False}
    if not fs:
        check(previous is None and spin.get('freeSpin')=='N' and spin.get('bonusAwarded')=='N','MISSING_FREE_COUNTER')
        return dict(base,feature=False,next='EndGame',total=0,played=0,remaining=0,awarded=0)
    f=fs[0];exact(f,'fsWinnings freeSpinsTotal freeSpinNumber isMaxWin freeSpinsAwarded')
    check(f.get('isMaxWin')=='0','MAXWIN_REQUIRES_OWN_TERMINAL')
    total=num(f.get('freeSpinsTotal'));played=num(f.get('freeSpinNumber'));awarded=num(f.get('freeSpinsAwarded'))
    check(0<total<=100 and played<=total and awarded<=total,'COUNTER');num(f.get('fsWinnings'))
    if previous is None:
        check(played==0 and spin.get('freeSpin')=='N' and f.get('fsWinnings')=='0','FIRST_TRIGGER')
    else:
        check(previous.get('schema')==base['schema'] and previous.get('feature') is True and previous.get('next')=='Logic','AFTER_TERMINAL')
        check(type(previous.get('total')) is int and type(previous.get('played')) is int and 0<=previous['played']<previous['total']<=9007199254740991,'PRIOR_COUNTER')
        check(played==previous['played']+1 and total==previous['total']+awarded and spin.get('freeSpin')=='Y','COUNTER_TRANSITION')
    return dict(base,feature=True,next='EndGame' if played==total else 'Logic',total=total,played=played,remaining=total-played,awarded=awarded)
