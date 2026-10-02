"""Independent request-flow evidence; never normalizes or approves a record.

The pinned client routes active FID0/FID1 layers to FREE_GAME. Ancillary
GSD values are retained verbatim, not interpreted as payout or route rules.
"""
import re
import json
import xml.etree.ElementTree as ET
from native_nextgen_fields import NativeNextgenFields
from pyramids_hold_review import SOURCE
from round_fields import amount, check, params, VERSION


def review_pyramids_flow(plan, raw):
    check(plan.get('gameId') == 32721 and plan.get('sourceKey') == SOURCE
          and plan.get('betRaw') == 20, 'FLOW_PROFILE')
    check(raw.get('sourceKey') == SOURCE and raw.get('protocol') == 'nextgen'
          and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion') == VERSION, 'FLOW_RAW_SCOPE')
    steps = raw.get('steps')
    budget = plan.get('actionResourceBudget')
    if 'actionResourceBudget' in plan:
        check(plan.get('maxSteps') == 1026 and isinstance(budget, dict)
              and budget == {'maxFrames': 1026, 'maxRawBytes': 4194304}, 'FLOW_RESOURCE_PROFILE')
    check(isinstance(steps, list) and 0 < len(steps) <= (budget['maxFrames'] if budget else 100), 'FLOW_STEPS')
    if budget:
        check(len(json.dumps(raw, separators=(',', ':'), ensure_ascii=False).encode('utf-8'))
              <= budget['maxRawBytes'], 'FLOW_RESOURCE_BYTES')
    parser = NativeNextgenFields(plan)
    start = amount(raw.get('startBalanceRaw'))
    check(start >= 20, 'FLOW_STAKE')
    previous = None
    player = None
    win = 0
    for index, step in enumerate(steps):
        msg = 'BET' if index == 0 else 'FREE_GAME'
        check(step.get('methodName') == 'processGameMessage' and step.get('msgId') == msg, 'FLOW_MESSAGE')
        q = parser.request_params(step.get('requestPayload'), msg)
        check(player is None or q['PID'] == player, 'FLOW_SESSION')
        player = q['PID']
        text = step.get('responseXml')
        check(isinstance(text, str) and len(text) < 262144 and '<!DOCTYPE' not in text.upper()
              and '<!ENTITY' not in text.upper(), 'FLOW_XML')
        try:
            root = ET.fromstring(text)
        except ET.ParseError:
            check(False, 'FLOW_XML')
        success, payload, rc = root.findall('SUCCESS'), root.findall('PAYLOAD'), root.findall('OGS_RC')
        check(root.tag.upper() == 'GDMRESPONSE' and len(success) == len(payload) == 1
              and len(rc) <= 1 and len(root) == 2 + len(rc)
              and not list(success[0]) and not list(payload[0])
              and (success[0].text or '').lower() == 'true'
              and payload[0].text == step.get('responsePayload')
              and all(not list(v) and v.text == '0' for v in rc), 'FLOW_XML_EVIDENCE')
        p = params(step['responsePayload'])
        check(p.get('MSGID') == msg and p.get('IFG') == str(int(index > 0)), 'FLOW_RESPONSE')
        check(p.get('GCT', '0') == '0' and p.get('FRBAL', '0') == '0', 'FLOW_FORCED_EXIT')
        check(not any(k.startswith(('FS_', 'NFR_', 'CFR_', 'CFP_')) for k in p)
              and not any(k in p for k in ('CFG', 'ABPM', 'SB', 'JPV')), 'FLOW_OTHER_PROTOCOL')
        check(amount(step.get('elapsedMs')) <= 300000, 'FLOW_TIMING')
        encoded_fid = p.get('FID', '')
        ordinary = not encoded_fid and not any(k in p for k in ('NFG', 'TFG', 'CFGG'))
        check(not ordinary or index == 0, 'FLOW_MISSING_CONTINUATION_STATE')
        check(ordinary or encoded_fid in ('0', '0|', '1', '1|', '0|1', '0|1|'), 'FLOW_FEATURE')
        fid = 'base' if ordinary else encoded_fid.removesuffix('|')
        n, t, c = (0, 0, 0) if ordinary else tuple(amount(p.get(k)) for k in ('NFG', 'TFG', 'CFGG'))
        # Natural awards can exceed 100; counter progress still must agree.
        check(n + c == t, 'FLOW_COUNTERS')
        g = {}
        for segment in p.get('GSD', '').split('#'):
            if not segment:
                continue
            parts = segment.split('~')
            check(len(parts) == 2 and re.fullmatch(r'[A-Z][A-Z0-9_]*', parts[0])
                  and parts[0] not in g, 'FLOW_GSD_STRUCTURE')
            g[parts[0]] = parts[1]
        outer = None
        if fid == '0|1':
            check(all(k in g for k in ('FGRS', 'CFGC', 'FGTS')), 'FLOW_OUTER_REQUIRED')
            outer = tuple(amount(g[k]) for k in ('FGRS', 'FGTS', 'CFGC'))
            check(outer[0] + outer[2] == outer[1], 'FLOW_OUTER_COUNTERS')
        if previous is None:
            check(fid != '0|1' and c == 0, 'FLOW_TRIGGER')
        else:
            pf, pn, pt, pc, po = previous
            check(pn > 0 or po is not None and po[0] > 0, 'FLOW_AFTER_TERMINAL')
            if fid == pf:
                check(pn > 0 and c == pc + 1 and t >= pt and n == pn - 1 + t - pt, 'FLOW_PROGRESS')
                if outer is not None:
                    check(outer == po, 'FLOW_OUTER_CHANGED')
            elif pf == '1' and fid == '0|1':
                check(pn > 0 and outer == (pn - 1, pt, pc + 1) and c == 0 and n == t and n > 0,
                      'FLOW_ENTER_HOLD')
            elif pf == '0|1' and fid == '1':
                check(pn == 0 and po[0] > 0 and t == po[1] and c == po[2] + 1 and n == po[0] - 1,
                      'FLOW_RESUME_FREE')
            else:
                check(False, 'FLOW_TRANSITION_UNPROVEN')
        b, ab, tw = (amount(p.get(k)) for k in ('B', 'AB', 'TW'))
        check(tw >= win and b == start - 20 + tw and start - 20 <= ab <= b, 'FLOW_MONEY')
        if 'responseBalance' in step:
            check(amount(step['responseBalance']) == ab, 'FLOW_RESPONSE_BALANCE')
        win = tw
        previous = fid, n, t, c, outer
    active = n > 0 or outer is not None and outer[0] > 0
    return {'next': {'MSGID': 'FREE_GAME'} if active else None,
            'terminalCandidate': not active, 'complete': False,
            'normalizationRequired': True, 'sourceRequests': 0,
            'captureAuthorized': False}
