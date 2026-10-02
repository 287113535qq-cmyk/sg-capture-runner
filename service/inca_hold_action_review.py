"""Offline Inca isolated Hold action/money difference review.

Existing fixed official standalone payment evidence is reused. No production
imports or source permission. New display keys and positive coin values do not
change the route. Mixed FID, overridden counters, Grand, external JPV, bad
geometry/session/XML/money still reject. Six-step terminal remains synthetic.
"""
import re
from native_nextgen_fields import NativeNextgenFields
from round_fields import check, params, amount

SOURCE='hyperchargedincajungle96-round-one-base-v1'
KEYS={'BGCL','BGRS','CL','HCL','HCLBT','HNSID','HNSRIDS','HNSTW','HPCL','HVA','HVABT','NCCP','PSTRS','VA'}
COINS={'CL','BGCL','HCL','HCLBT','HPCL'}


def rows(value):
    parts=value.split('|')
    if parts[-1]=='':parts.pop()
    check(0 < len(parts) <= 100, 'INCA_HOLD_ARRAY')
    result=[]
    for part in parts:
        cells=part.split(';')
        if cells[-1]=='':cells.pop()
        check(0<len(cells)<=100 and all(re.fullmatch(r'-?\d+', x) for x in cells),'INCA_HOLD_ARRAY')
        row=list(map(int,cells));check(all(abs(x)<=9007199254740991 for x in row),'INCA_HOLD_NUMBER')
        result.append(row)
    return result


def gsd_fields(p):
    g={}
    for entry in p.get('GSD','').split('#'):
        if not entry:continue
        bits=entry.split('~')
        check(len(bits)==2 and bits[0] not in {'FGRS','CFGC','CS'} and bits[0] not in g,'INCA_HOLD_UNREVIEWED_GSD')
        g[bits[0]]=bits[1]
    for key,value in g.items():
        if key not in KEYS:
            continue  # Unknown display data is retained, not classified.
        if key=='CS':
            check(value in {'RESPIN','RESPININITIALCHEST','RESPINSUPER','RESPINSUPERMORECHEST'},'INCA_HOLD_STATE')
        elif key in COINS:
            occupied=set()
            for row in rows(value):
                check(len(row)==3,'INCA_HOLD_COIN')
                x,y,v=row
                check(0<=x<3 and 0<=y<5 and (x,y) not in occupied and
                      (v in {-4,-3,-2} or v>0),'INCA_HOLD_COIN')
                occupied.add((x,y))
        elif key in {'HVA','HVABT'}:
            grid=rows(value)
            check(len(grid)==5 and all(len(r)==3 and all(0<=x<=15 for x in r) for r in grid),'INCA_HOLD_GRID')
        elif key in {'HNS','HNSID','HNSTW'}:
            number=amount(value)
            if key=='HNS':check(number==1,'INCA_HOLD_HNS')
            if key=='HNSID':check(2<=number<=5,'INCA_HOLD_REELSET')
        else:
            rows(value)
    return g


class IncaHoldActionReview(NativeNextgenFields):
    def __init__(self,plan):
        check(plan.get('gameId')==32719 and plan.get('sourceKey')==SOURCE,'INCA_HOLD_PROFILE')
        super().__init__(plan)

    def sequence(self,raw):
        check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='nextgen','INCA_HOLD_PROFILE')
        steps=raw.get('steps');check(isinstance(steps,list) and 0<len(steps)<=100,'INCA_HOLD_STEPS')
        previous=None;pid=None;first_win=None
        for i,step in enumerate(steps):
            check(step['msgId']==('BET' if i==0 else 'FREE_GAME'),'INCA_HOLD_SEQUENCE')
            self.frame(step)
            q=self.request_params(step['requestPayload'],step['msgId']);p=params(step['responsePayload'])
            check(pid is None or pid==q['PID'],'SESSION_CHANGED_MID_ROUND');pid=q['PID']
            check(p.get('FID') in {'0','0|'} and p.get('GCT','0')=='0' and p.get('FRBAL','0')=='0'
                  and not any(k in p for k in ('JPV','SB'))
                  and not any(k.startswith(('CFR_','CFP_')) for k in p),'INCA_HOLD_UNREVIEWED_FEATURE')
            g=gsd_fields(p);n,t,c=(amount(p.get(k)) for k in ('NFG','TFG','CFGG'))
            check(0<=n<=6 and t==6 and 0<=c<=6 and n+c==t,'INCA_HOLD_COUNTERS')
            if previous is None:
                check((n,t,c)==(6,6,0) and p['IFG']=='0' and {'CL','BGCL','HCL','HVA'}<=g.keys(),'INCA_HOLD_TRIGGER')
                first_win=amount(p['TW'])
            else:
                pn,pt,pc=previous
                check(pn>0 and c==pc+1 and t==pt and n==pn-1,'INCA_HOLD_PROGRESS')
                check({'HNSID','HNSRIDS','HVA','HCL'}<=g.keys(),'INCA_HOLD_HOLD_STATE')
                if n==0:
                    check(pn==1 and t==pt,'INCA_HOLD_TERMINAL')
            previous=n,t,c
        return {'MSGID':'FREE_GAME'} if previous[0] else None

    def next_request(self,raw):
        return self.sequence(raw)

    def settled(self,raw):
        check(self.sequence(raw) is None,'INCOMPLETE_ROUND')
        fields=super().settled(raw)
        return {**fields,'bonus':None,'primaryBonusKind':None,'classificationStatus':'pending',
                'captureAuthorization':False,'naturalTerminalVerified':False}
