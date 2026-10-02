"""Independent XML routing review; neither settlement nor source permission."""
from pearl_fields import parse, one
from round_fields import check
from veryfruity_review import uint, CLIENT_SHA256


def review_actions(raw, *, expected_header, max_steps=1026):
    check(isinstance(expected_header, dict) and expected_header.get('gameCodeRGI') == 'veryfruity' and expected_header.get('freePlay') == 'Y'
          and expected_header.get('promotions') == 'N'
          and all(isinstance(expected_header.get(k), str) for k in ('gameID', 'versionID', 'ccyCode', 'lang')),
          'VERYFRUITY_ACTION_IDENTITY')
    check(isinstance(max_steps, int) and not isinstance(max_steps, bool) and 0 < max_steps <= 1026
          and isinstance(raw, dict) and isinstance(raw.get('steps'), list)
          and 0 < len(raw['steps']) <= max_steps, 'VERYFRUITY_ACTION_BUDGET')
    next_action, previous_session, free = 'Logic', None, None
    for step in raw['steps']:
        check(isinstance(step, dict) and next_action is not None and step.get('msgId') == next_action
              and step.get('responsePayload') == step.get('responseXml'), 'VERYFRUITY_ACTION_SEQUENCE')
        q, r = parse(step.get('requestPayload')), parse(step.get('responseXml'))
        check(q.tag == 'GameRequest' and q.get('type') == next_action
              and r.tag == 'GameResponse' and r.get('type') == next_action, 'VERYFRUITY_ACTION_SEQUENCE')
        qh, rh = one(q, 'Header'), one(r, 'Header')
        check(not len(qh) and not len(rh) and all(qh.get(k) == v for k, v in expected_header.items())
              and all(rh.get(k) == expected_header[k] for k in ('gameID', 'versionID', 'ccyCode', 'lang'))
              and rh.get('isRecovering') == 'N', 'VERYFRUITY_ACTION_IDENTITY')
        qs, rs = qh.get('sessionID'), rh.get('sessionID')
        check(all(isinstance(s, str) and 0 < len(s) <= 1024 for s in (qs, rs))
              and (previous_session is None or previous_session == qs), 'VERYFRUITY_ACTION_SESSION')
        previous_session = rs
        check(not any(n.tag in {'Error', 'Errors', 'Pick', 'Gamble', 'Choice', 'BonusWin'} for n in r.iter()),
              'VERYFRUITY_ACTION_UNREVIEWED_ROUTE')
        results = r.findall('GameResult')
        if next_action == 'EndGame':
            check(not results, 'VERYFRUITY_ACTION_ENDGAME')
            next_action = None
            continue
        check(len(results) == 1, 'VERYFRUITY_ACTION_RESULT')
        result = results[0]
        fields = list(result.iter('FSInfo'))
        check(len(fields) <= 1 and all(f in list(result) for f in fields), 'VERYFRUITY_ACTION_AMBIGUOUS_FREE')
        bg = one(result, 'BGInfo')
        check(bg.get('isMaxWin') == '0' and bg.get('mysterySymbol') == '0', 'VERYFRUITY_ACTION_UNREVIEWED_EXIT')
        if not fields:
            check(free is None, 'VERYFRUITY_ACTION_MISSING_FREE')
            next_action = 'EndGame'
            continue
        f = fields[0]
        current, total = uint(f.get('freeSpinNumber')), uint(f.get('freeSpinsTotal'))
        check(0 < total <= max_steps and current <= total and not len(f), 'VERYFRUITY_ACTION_COUNTER')
        if free:
            check(current == free['current'] + 1 and total >= free['total'], 'VERYFRUITY_ACTION_PROGRESS')
        else:
            check(current == 0, 'VERYFRUITY_ACTION_TRIGGER')
        free = {'current': current, 'total': total}
        next_action = 'EndGame' if current == total else 'Logic'
    return {'nextRequestHypothesis': next_action, 'endGameAcknowledged': next_action is None,
            'complete': False, 'moneyVerified': False, 'captureAuthorization': False,
            **({'freeProgress': free} if free else {}), 'clientSha256': CLIENT_SHA256}
