"""Shared free-game counter progression; additional awards are enabled by default.

The caller supplies counters from an already reviewed request contract. This
module grants no request, feature, settlement or source permission.
"""
from round_fields import check

def advance_free_game_counters(prior, current, *, added=None, consumed=1, maximum=1000000):
    def integer(n):
        return type(n) is int and 0 <= n <= maximum
    check(type(maximum) is int and 0 < maximum <= 1000000
          and integer(consumed), 'FREE_COUNTER_LIMIT')
    for row in (current,) if prior is None else (prior, current):
        check(isinstance(row, dict) and all(integer(row.get(k)) for k in ('total', 'remaining', 'played'))
              and row['total'] == row['remaining'] + row['played'], 'FREE_COUNTER_STATE')
    if prior is None:
        check(added in (None, 0), 'FREE_COUNTER_INITIAL_AWARD')
        return {'added': 0, 'remaining': current['remaining']}
    delta = current['total'] - prior['total']
    check(integer(delta) and prior['remaining'] >= consumed, 'FREE_COUNTER_AWARD')
    check(added is None or integer(added) and added == delta, 'FREE_COUNTER_REPORTED_AWARD')
    check(current['remaining'] == prior['remaining'] - consumed + delta
          and current['played'] == prior['played'] + consumed, 'FREE_COUNTER_PROGRESSION')
    return {'added': delta, 'remaining': current['remaining']}
