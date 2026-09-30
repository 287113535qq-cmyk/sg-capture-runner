"""Offline Pyramids isolated HoldNSpin review; no capture/import authorization.

Fifteen historical complete chains exercise natural +2/+4 extensions. Mixed
free games, external jackpots and forced termination are outside this scope.
"""
import re
from native_nextgen_fields import NativeNextgenFields
from round_fields import check, params, amount

SOURCE='hyperchargedpyramidsofra96-round-one-base-v1'
KEYS={'BGCL','BGRS','CL','CS','FTTCV','HCL','HCLBT','HNS','HNSID','HNSRIDS',
      'HNSTW','HPCL','HRS','HRSBT','HVA','HVABT','NCCP','PHRS','PSTRS','PVA','STRS','VA'}
COINS={'CL','BGCL','HCL','HCLBT','HPCL'}


def rows(value):
    parts=value.split('|')
    if parts[-1]=='':parts.pop()
    check(0 < len(parts) <= 100, 'PYRAMIDS_ARRAY')
    result=[]
    for part in parts:
        cells=part.split(';')
        if cells[-1]=='':cells.pop()
        check(0<len(cells)<=100 and all(re.fullmatch(r'-?\d+', x) for x in cells),'PYRAMIDS_ARRAY')
        row=list(map(int,cells));check(all(abs(x)<=9007199254740991 for x in row),'PYRAMIDS_NUMBER')
        result.append(row)
    return result


def gsd_fields(p):
    g={}
    for entry in p.get('GSD','').split('#'):
        if not entry:continue
        bits=entry.split('~')
        check(len(bits)==2 and bits[0] in KEYS and bits[0] not in g,'PYRAMIDS_UNREVIEWED_GSD')
        g[bits[0]]=bits[1]
    for key,value in g.items():
        if key=='CS':
            check(value in {'RESPIN','RESPININITIALCHEST','RESPINSUPER','RESPINSUPERMORECHEST'},'PYRAMIDS_STATE')
        elif key in COINS:
            occupied=set()
            for row in rows(value):
                check(len(row)==3,'PYRAMIDS_COIN')
                x,y,v=row
                check(0<=x<3 and 0<=y<5 and (x,y) not in occupied and
                      v in {-4,-3,-2,10,20,40,60,80,100,300,400,600,800},'PYRAMIDS_COIN')
                occupied.add((x,y))
        elif key in {'HVA','HVABT'}:
            grid=rows(value)
            check(len(grid)==5 and all(len(r)==3 and all(0<=x<=15 for x in r) for r in grid),'PYRAMIDS_GRID')
        elif key in {'HNS','HNSID','HNSTW'}:
            number=amount(value)
            if key=='HNS':check(number==1,'PYRAMIDS_HNS')
            if key=='HNSID':check(2<=number<=5,'PYRAMIDS_REELSET')
        else:
            rows(value)
    return g


class PyramidsHoldSequence(NativeNextgenFields):
    def __init__(self,plan):
        check(plan.get('gameId')==32721 and plan.get('sourceKey')==SOURCE,'PYRAMIDS_PROFILE')
        super().__init__(plan)

    def sequence(self,raw):
        check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='nextgen','PYRAMIDS_PROFILE')
        steps=raw.get('steps');check(isinstance(steps,list) and 0<len(steps)<=100,'PYRAMIDS_STEPS')
        previous=None;pid=None;first_win=None
        for i,step in enumerate(steps):
            check(step['msgId']==('BET' if i==0 else 'FREE_GAME'),'PYRAMIDS_SEQUENCE')
            self.frame(step)
            q=self.request_params(step['requestPayload'],step['msgId']);p=params(step['responsePayload'])
            check(pid is None or pid==q['PID'],'SESSION_CHANGED_MID_ROUND');pid=q['PID']
            check(p.get('FID') in {'0','0|'} and p.get('GCT','0')=='0' and p.get('FRBAL','0')=='0'
                  and not any(k in p for k in ('JPV','SB'))
                  and not any(k.startswith(('CFR_','CFP_')) for k in p),'PYRAMIDS_UNREVIEWED_FEATURE')
            g=gsd_fields(p);n,t,c=(amount(p.get(k)) for k in ('NFG','TFG','CFGG'))
            check(0<=n<=99 and 6<=t<=98 and 0<=c<=98 and n+c==t,'PYRAMIDS_COUNTERS')
            if previous is None:
                check((n,t,c)==(6,6,0) and p['IFG']=='0' and {'CL','BGCL','HCL','HVA'}<=g.keys(),'PYRAMIDS_TRIGGER')
                first_win=amount(p['TW'])
            else:
                pn,pt,pc=previous
                check(pn>0 and c==pc+1 and t-pt in {0,2,4} and n==pn-1+t-pt,'PYRAMIDS_PROGRESS')
                check({'HNS','HNSID','HNSRIDS','HVA','CS'}<=g.keys(),'PYRAMIDS_HOLD_STATE')
                if n==0:
                    check(pn==1 and t==pt and 'HNSTW' in g and amount(p['TW'])==first_win+amount(g['HNSTW']),'PYRAMIDS_TERMINAL')
            previous=n,t,c
        return {'MSGID':'FREE_GAME'} if previous[0] else None

    def next_request(self,raw):
        return self.sequence(raw)

    def settled(self,raw):
        check(self.sequence(raw) is None,'INCOMPLETE_ROUND')
        return super().settled(raw)
