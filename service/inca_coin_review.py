"""Inca positive-coin/free validation; authorization remains in the capture profile.

Only positive coin values at unique 3x5 coordinates are reviewed here. Negative
jackpot coins, HoldNSpin and mixed features require a separate validator.
"""
import re
from inca_free_review import IncaSequence
from round_fields import check, params


EXTENSION='hyperchargedincajungle96-round-one-base-v1-inca-coin-free-v1'

def has_coins(raw):
    return any(any(part.split('~',1)[0] in {'CL','BGCL'} for part in params(s['responsePayload']).get('GSD','').split('#') if part) for s in raw['steps'])

class IncaCoinSequence(IncaSequence):
    def sequence(self, raw):
        check(all('JPV' not in params(s['responsePayload']) for s in raw['steps']), 'INCA_UNREVIEWED_JACKPOT')
        return super().sequence(raw)

    def validate_gsd(self, gsd, index):
        super().validate_gsd({k:v for k,v in gsd.items() if k not in {'CL','BGCL'}}, index)
        for key in ('CL','BGCL'):
            if key not in gsd:
                continue
            rows=gsd[key].split('|')
            if rows[-1] == '': rows.pop()
            check(0 < len(rows) <= 15, 'INCA_COIN_LAYOUT')
            occupied=set()
            for row in rows:
                fields=row.split(';')
                if fields[-1] == '': fields.pop()
                check(len(fields)==3 and all(re.fullmatch(r'\d+', x) for x in fields), 'INCA_COIN_LAYOUT')
                x,y,value=map(int,fields)
                check(0 <= x < 3 and 0 <= y < 5 and value in {10,20,40,60,80,100,300,400,600,800}
                      and (x,y) not in occupied, 'INCA_UNREVIEWED_COIN')
                occupied.add((x,y))
