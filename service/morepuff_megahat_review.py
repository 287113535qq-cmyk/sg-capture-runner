"""Bounded three-frame MegaHat validation. Source admission remains separate.

Only the two-frame prefix is observed. A single additional FREE terminal with
unchanged total=1 is synthetic, and is not a claim about future server shape.
"""
import xml.etree.ElementTree as ET
from round_fields import check, params, amount, VERSION

SOURCE = 'huffnmorepuffhighlimit96-round-one-base-v1'
EXTENSION = SOURCE + '-wheel-megahat-single-v1'

def has_megahat(raw):
    return raw.get('sourceKey') == SOURCE and any(params(s['responsePayload']).get('FID') in {'1|2', '1|2|'} for s in raw.get('steps', []))

BASE_GSD = {'BRS', 'BMS', 'BSPOS', 'VA', 'BWC', 'BWS'}


def inspect(raw):
    check(raw.get('sourceKey') == SOURCE and raw.get('protocol') == 'nextgen'
          and raw.get('roundFieldsVersion') == VERSION and raw.get('fixtureOnly') is False,
          'MEGAHAT_PROFILE')
    steps = raw.get('steps')
    check(isinstance(steps, list) and 1 <= len(steps) <= 3, 'MEGAHAT_UNREVIEWED')
    player = None
    rows = []
    start = amount(raw.get('startBalanceRaw'))
    for i, step in enumerate(steps):
        msg = 'FREE_GAME' if i else 'BET'
        q, p = params(step.get('requestPayload')), params(step.get('responsePayload'))
        check(step.get('msgId') == p.get('MSGID') == q.get('MSGID') == msg, 'MEGAHAT_MESSAGE')
        check({k: v for k, v in q.items() if k != 'PID'} ==
              {'MSGID': msg, 'GN': 'huffnmorepuffhighlimit96', 'BPR': '100', 'RB': '5'}, 'MEGAHAT_REQUEST')
        pid = q.get('PID', '')
        check(pid.startswith('gdmgcm') and 6 < len(pid) < 512, 'MEGAHAT_SESSION')
        check(player is None or player == pid, 'MEGAHAT_SESSION')
        player = pid
        text = step.get('responseXml')
        check(isinstance(text, str) and len(text) < 262144 and '<!DOCTYPE' not in text.upper()
              and '<!ENTITY' not in text.upper(), 'MEGAHAT_XML')
        try:
            root = ET.fromstring(text)
        except ET.ParseError:
            check(False, 'MEGAHAT_XML')
        check(root.tag.upper() == 'GDMRESPONSE' and str(root.findtext('SUCCESS')).lower() == 'true'
              and root.findtext('PAYLOAD') == step['responsePayload'], 'MEGAHAT_XML')
        check(amount(step.get('elapsedMs')) <= 300000, 'MEGAHAT_TIMING')
        check(not any(k in p for k in ('CFG', 'ABPM', 'SB', 'FRTR', 'FRTW', 'BUY_IN'))
              and not any(k.startswith(('FS_', 'NFR_', 'CFR_', 'CFP_', 'FR_')) for k in p)
              and p.get('FRBAL', '0') == '0' and p.get('GCT', '0') == '0', 'MEGAHAT_UNREVIEWED')
        check(p.get('IFG') == str(bool(i) * 1) and p.get('RID') == '0', 'MEGAHAT_UNREVIEWED')
        n, t, c = (amount(p.get(k)) for k in ('NFG', 'TFG', 'CFGG'))
        check(t == n + c, 'MEGAHAT_COUNTER')
        check((n, t, c) == ((1, 1, 0) if i < 2 else (0, 1, 1)), 'MEGAHAT_UNREVIEWED')
        allowed_fid = {'2', '2|'} if i == 0 else {'1|2', '1|2|'} if i == 1 else {'0', '0|', '1', '1|'}
        check(p.get('FID') in allowed_fid, 'MEGAHAT_UNREVIEWED')
        g = {}
        for item in p.get('GSD', '').split('#'):
            if not item:
                continue
            bits = item.split('~')
            check(len(bits) == 2 and bits[0] and bits[0] not in g, 'MEGAHAT_GSD')
            g[bits[0]] = bits[1]
        allowed = BASE_GSD | ({'WHSTOP', 'WHSLICE', 'WHEELSPIN'} if i == 1 else set())
        check(set(g) <= allowed, 'MEGAHAT_UNREVIEWED')
        symbols = [amount(x) for x in g.get('VA', '').split(',')]
        check(len(symbols) == 15, 'MEGAHAT_SYMBOLS')
        check(not (symbols.count(13) >= 3 and symbols.count(14) >= 6), 'MEGAHAT_UNREVIEWED')
        if i == 1:
            check(all(g.get(k) == v for k, v in {'WHSTOP': '3', 'WHSLICE': 'MEGAHAT', 'WHEELSPIN': '1'}.items()),
                  'MEGAHAT_UNREVIEWED')
        balance, available, win = (amount(p.get(k)) for k in ('B', 'AB', 'TW'))
        check(balance == available and start - balance + win == 2000, 'MEGAHAT_MONEY')
        if step.get('responseBalance') is not None:
            check(amount(step['responseBalance']) == balance, 'MEGAHAT_MONEY')
        if rows:
            check(win >= rows[-1]['win'], 'MEGAHAT_MONEY')
        rows.append(dict(win=win, balance=balance))
    return dict(next='FREE_GAME' if len(steps) < 3 else None, complete=len(steps) == 3,
                kind='wheel-megahat-single-free', endBalanceRaw=rows[-1]['balance'],
                totalWinRaw=rows[-1]['win'], betRaw=2000)
