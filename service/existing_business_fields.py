"""Read-only legacy ordinary audit. No synthetic timing or capture credit."""
import hashlib
import json
import math
import re
from pathlib import Path
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

def inspect_existing_nextgen(doc, plan, binding):
    if len(doc.get('data',{}).get('steps',[]))==1:
        return inspect_existing_ordinary(doc,plan,binding)
    d=doc['data'];root=Path(__file__).resolve().parent.parent
    profile=json.loads((root/'service/round_types.json').read_text())['profiles'][plan['sourceKey']]
    assert plan['adapter']==profile['adapter']=='native-nextgen-v1' and profile['protocol']=='nextgen' and profile['fixtureOnly'] is False
    assert profile['freeSelector']=='implicit-single-free-game' and profile['freeTypes']=={'native-free-game':1}
    assert profile['evidence']['captureGameId']==binding['gameId'] and profile['evidence']['runtimeGameId']==binding['runtimeGameId']
    assert re.fullmatch('[a-f0-9]{24}',doc['_id']) and doc['gameId']==d['gameId']==plan['runtimeGameId'] and d['runtimeSlug']==plan['runtimeSlug']
    assert doc['buy']==0 and doc['bonus']==1 and d['primaryBonusKind']=='freeGame' and d['specialKinds']==['freeGame']
    assert d['enhancedBetLevel']==d['freeChoiceOptionIndex']==d['freeChoiceOptionCount']==0 and d['enhancedBetLabel']=='' and d['isFreeChoiceRound'] is False
    assert doc['rtp']==binding['rtp'] and isinstance(doc['rtp'],list) and doc['rtp'] and len(set(doc['rtp']))==len(doc['rtp']) and all(type(n) is int and n>=0 for n in doc['rtp'])
    contract=None
    if 'automaticFreeContract' in plan:
        config=json.loads((root/'config/ag-rolling-automatic-free-contracts.json').read_text());contract=config['sources'][plan['sourceKey']]
        assert config['schema']=='sg-ag-rolling-automatic-free-contracts-v1' and config['sourceAllowance']==0
        assert plan['automaticFreeContract']=='nextgen-automatic-nfg-free-v1'
        assert hashlib.sha256(json.dumps(contract,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==plan['automaticFreeContractHash']
        assert all(contract[k]==plan[k] for k in ('gameId','runtimeGameId','sourceKey','betRaw','requestParams'))
    def raw(n):
        assert type(n) in (int,float) and math.isfinite(n) and n>=0
        value=round(n*100);assert value<=9007199254740991 and abs(n*100-value)<1e-7
        return value
    start,end,win,bet=raw(d['startBalance']),raw(d['endBalance']),raw(d['totalWin']),raw(doc['bet']);held=start-bet
    assert bet==plan['betRaw'] and held>=0 and end==held+win and math.isfinite(doc['mul']) and abs(doc['mul']-win/bet)<0.000501
    steps=d['steps'];assert 1<len(steps)<=(contract or {}).get('maxSteps',100) and d['stepCount']==len(steps) and d['msgIds']==[s['msgId'] for s in steps]
    remaining=prior_win=0;player=sid=None
    for i,s in enumerate(steps):
        msg='FREE_GAME' if i else 'BET';q,p=params(s['requestPayload']),params(s['responsePayload']);last=i==len(steps)-1
        assert s['msgId']==q['MSGID']==p['MSGID']==msg and s['methodName']=='processGameMessage' and not s.get('sourceRejected') and (not i or remaining>0)
        assert q['PID'].startswith('gdmgcm') and 6<len(q['PID'])<512 and (player is None or player==q['PID'])
        assert {k:v for k,v in q.items() if k!='PID'}=={**plan['requestParams'],'MSGID':msg};player=q['PID']
        if 'SID' in p:
            assert 0<len(p['SID'])<512 and (sid is None or sid==p['SID']);sid=p['SID']
        remaining=amount(p['NFG']);assert remaining<=100 and p['IFG']==str(int(i>0))
        fid=p.get('FID','0|');e=contract or {}
        assert fid in ('0','0|','') or fid in e.get('allowedFids',{}).get(msg,[]) and (remaining>0 or i>0 and e.get('allowTerminalFeatureId',False))
        assert remaining>0 or fid in ('0','0|','') or 'terminalFids' not in e or fid in e['terminalFids']
        assert not any(k in ('CFG','ABPM') or k.startswith(('FS_','NFR_')) for k in p) and '#lives~' not in p.get('GSD','')
        b,ab,tw=amount(p['B']),amount(p['AB']),amount(p['TW'])
        assert tw>=prior_win and b==held+tw and (ab==held or last and remaining==0 and ab==b) and s['responseBalance']==ab;prior_win=tw
        text=s['responseXml'];assert isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper()
        xml=ET.fromstring(text);assert xml.tag=='GDMRESPONSE' and xml.findtext('SUCCESS').lower()=='true' and xml.findtext('OGS_RC')=='0' and xml.findtext('PAYLOAD')==s['responsePayload']
        if 'elapsedMs' in s:assert type(s['elapsedMs']) is int and 0<=s['elapsedMs']<=300000
    assert remaining==0 and prior_win==win and amount(params(steps[-1]['responsePayload'])['B'])==end
    return {'protocolVerified':True,'moneyVerified':True,'typeAndRtpVerified':True,'transportTimingAvailable':all('elapsedMs' in s for s in steps),'newNativeCredit':0}
