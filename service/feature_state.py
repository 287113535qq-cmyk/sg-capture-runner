"""Reviewed feature-state primitives; no routing or source authorization."""
import re
from round_fields import check


def parse_feature_values(text, *, size, separator='|', decimal_places=6,
                         maximum_value=1000000, negative_sentinels=()):
    """Retain exact display values; fractional multipliers are not cash units."""
    check(type(size) is int and 0 < size <= 1000
          and type(decimal_places) is int and 0 <= decimal_places <= 6
          and type(maximum_value) is int and 0 <= maximum_value <= 1000000
          and separator in (',', '|') and isinstance(text, str)
          and len(text) <= size * 32
          and all(type(n) is int and -1000000 <= n < 0 for n in negative_sentinels),
          'FEATURE_VALUES_LIMIT')
    entries = text.split(separator)
    check(len(entries) == size, 'FEATURE_VALUES_SIZE')
    for entry in entries:
        check(re.fullmatch(r'-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?', entry)
              is not None, 'FEATURE_VALUES_FORMAT')
        whole, _, fraction = entry.lstrip('-').partition('.')
        check(len(fraction) <= decimal_places, 'FEATURE_VALUES_PRECISION')
        scale = 10 ** len(fraction)
        coefficient = int(whole) * scale + int(fraction or '0')
        check((-coefficient in [n * scale for n in negative_sentinels])
              if entry.startswith('-') else coefficient <= maximum_value * scale,
              'FEATURE_VALUES_SCOPE')
    return entries


def parse_feature_history(text, allowed, *, maximum=100, allow_empty=False):
    """Preserve ordered repeats. History entries do not prove awarded spins."""
    check(type(maximum) is int and 0 < maximum <= 1000000
          and isinstance(text, str) and len(text) <= maximum * 17,
          'FEATURE_HISTORY_LIMIT')
    if text == '' and allow_empty:
        return []
    check(re.fullmatch(r'(?:0|[1-9][0-9]*)(?:\|(?:0|[1-9][0-9]*))*\|?', text)
          is not None, 'FEATURE_HISTORY_FORMAT')
    entries = [int(part) for part in text.rstrip('|').split('|')]
    check(len(entries) <= maximum and all(entry in allowed for entry in entries),
          'FEATURE_HISTORY_SCOPE')
    return entries


def check_feature_wallet(start, bet, balance, available, win, *, settled,
                         response_balance=None):
    """Check accrued balance separately from cash available during a feature.

    The caller must establish settlement independently. Completion requires
    the full credited wallet; an unpaid feature prefix never becomes complete.
    """
    integer = lambda n: type(n) is int and 0 <= n <= 9007199254740991
    check(type(settled) is bool and all(integer(n) for n in
          (start, bet, balance, available, win)) and start >= bet,
          'FEATURE_WALLET_INPUT')
    check(balance == start - bet + win, 'FEATURE_WALLET_AMOUNT')
    check(available == balance or not settled and available == start - bet,
          'FEATURE_WALLET_CREDIT')
    check(response_balance is None or integer(response_balance)
          and response_balance == available, 'FEATURE_WALLET_RESPONSE')
    return {'uncreditedWin': balance - available}
