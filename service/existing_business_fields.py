"""Read-only legacy ordinary audit. No synthetic timing or capture credit."""
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
from round_fields import params, amount

def inspect_existing_ordinary(doc, plan, binding):
    d = doc['data']
    assert isinstance(doc['rtp'],list) and doc['rtp'] and len(set(doc['rtp']))==len(doc['rtp']) and all(type(n) is int and n>=0 for n in doc['rtp'])
    assert re.fullmatch('[a-f0-9]{24}', doc['_id'])
    assert doc['gameId'] == d['gameId'] == plan['runtimeGameId'] and d['runtimeSlug'] == plan['runtimeSlug']
    assert doc['rtp'] == binding['rtp']
    assert plan['adapter'] == 'native-nextgen-v1' and doc['buy'] == doc['bonus'] == 0
    assert d['primaryBonusKind'] == 'none' and d['specialKinds'] == [] and d['isFreeChoiceRound'] is False
    assert d['freeChoiceOptionIndex'] == d['freeChoiceOptionCount'] == d['enhancedBetLevel'] == 0 and d['enhancedBetLabel'] == ''
    assert d['stepCount'] == len(d['steps']) == 1 and d['msgIds'] == ['BET']
    s = d['steps'][0]
    q, p = params(s['requestPayload']), params(s['responsePayload'])
    assert s['msgId'] == q['MSGID'] == p['MSGID'] == 'BET' and s['methodName'] == 'processGameMessage'
    assert 6 < len(q['PID']) < 512 and {k:v for k,v in q.items() if k != 'PID'} == {**plan['requestParams'], 'MSGID':'BET'}
    assert p.get('FID', '0|') in ('0', '0|', '') and amount(p.get('NFG', '0')) == 0 and p['IFG'] == '0'
    assert not any(k in ('CFG', 'ABPM') or k.startswith(('FS_', 'NFR_')) for k in p)
    text = s['responseXml']
    assert isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper()
    root=ET.fromstring(text)
    assert root.tag.upper()=='GDMRESPONSE' and root.findtext('SUCCESS').lower()=='true' and root.findtext('OGS_RC')=='0' and root.findtext('PAYLOAD')==s['responsePayload']
    def raw(n):
        assert isinstance(n,(int,float)) and not isinstance(n,bool) and math.isfinite(n) and n>=0
        value=round(n*100);assert value<=9007199254740991 and abs(n*100-value)<1e-7
        return value
    start,end,win,bet=raw(d['startBalance']),raw(d['endBalance']),raw(d['totalWin']),raw(doc['bet'])
    assert bet==plan['betRaw'] and end==start-bet+win
    assert amount(p['B'])==amount(p['AB'])==s['responseBalance']==end and amount(p['TW'])==win
    assert math.isfinite(doc['mul']) and abs(doc['mul']-win/bet)<0.000501
    return {'protocolVerified':True,'moneyVerified':True,'typeAndRtpVerified':True,'transportTimingAvailable':False,'newNativeCredit':0}
