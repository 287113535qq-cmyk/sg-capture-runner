"""Two evidence-pinned ordinary BET responses; ABPM=0 grants no bonus route."""
import json
from functools import lru_cache
from pathlib import Path
import xml.etree.ElementTree as ET
from round_fields import check,amount,params,types,VERSION
from store import digest
CONTRACT='nextgen-zero-abpm-base-v1'
@lru_cache(maxsize=1)
def policy():
    p=json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-zero-abpm-contracts.json').read_text(encoding='utf-8'))
    check(p.get('schema')=='sg-ag-zero-abpm-contracts-v1' and p.get('sourceAllowance')==0,'ZERO_ABPM_POLICY_REQUIRED')
    return p
def binding(plan):
    e=policy()['sources'].get(plan.get('sourceKey'))
    check(e is not None and plan.get('rollingPlan')=='sg-ag-rolling-plan-v1' and plan.get('zeroAbpmContract')==CONTRACT
          and plan.get('zeroAbpmContractHash')==digest(e)
          and all(plan.get(k)==e[k] for k in ('gameId','runtimeGameId','sourceKey','betRaw','requestParams','maxSteps')),'ZERO_ABPM_PLAN_BINDING')
    return e
def inspect(raw):
    e=policy()['sources'].get(raw.get('sourceKey'))
    check(e is not None and raw.get('zeroAbpmContract')==CONTRACT and raw.get('fixtureOnly') is False
          and raw.get('protocol')=='nextgen' and raw.get('roundFieldsVersion')==VERSION,'ZERO_ABPM_PROFILE_REQUIRED')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=1,'ZERO_ABPM_BASE_ONLY')
    start,cost=amount(raw.get('startBalanceRaw')),amount(e['betRaw']);check(cost>0 and start>=cost,'INVALID_WAGER_BASIS')
    if not steps:return None
    s=steps[0];check(s.get('msgId')=='BET' and s.get('methodName')=='processGameMessage' and not s.get('sourceRejected'),'ZERO_ABPM_BASE_ONLY')
    q=params(s.get('requestPayload'));pid=q.get('PID')
    check({k:v for k,v in q.items() if k!='PID'}=={**e['requestParams'],'MSGID':'BET'},'FIRST_ROUND_REQUEST_MODE')
    check(isinstance(pid,str) and pid.startswith('gdmgcm') and 6<len(pid)<512,'TRIAL_SESSION_REQUIRED')
    p=params(s.get('responsePayload'))
    check(p.get('MSGID')=='BET' and p.get('IFG')=='0' and p.get('ABPM')=='0' and p.get('FID','0|') in ('','0','0|')
          and not any(k.startswith(('FS_','NFR_')) for k in p) and 'CFG' not in p
          and '#lives~' not in p.get('GSD','') and amount(p.get('NFG','0'))==0,'UNKNOWN_TRIAL_FEATURE')
    win,end,ab=(amount(p.get(k)) for k in ('TW','B','AB'))
    check(end==start-cost+win and ab==end and amount(s.get('responseBalance'))==end,'ZERO_ABPM_MONEY_MISMATCH')
    text=s.get('responseXml');check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
    try:root=ET.fromstring(text)
    except ET.ParseError:check(False,'INVALID_TRIAL_XML')
    check(root.tag.upper()=='GDMRESPONSE' and str(root.findtext('SUCCESS')).lower()=='true' and root.findtext('PAYLOAD')==s['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
    check(amount(s.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING')
    return {'startBalanceRaw':start,'endBalanceRaw':end,'totalWinRaw':win,'betRaw':cost}
def next_request(raw):
    return None if inspect(raw) is not None else {'MSGID':'BET'}
def settled(raw):
    money=inspect(raw);check(money is not None,'INCOMPLETE_ROUND')
    buy,bonus,h=types(raw,'none');check(buy==0 and bonus==0,'ZERO_ABPM_MAPPING_MISMATCH')
    return {'roundFieldsVersion':VERSION,'protocol':'nextgen','sourceKey':raw['sourceKey'],'bet':money['betRaw']/100,
            'mul':money['totalWinRaw']/money['betRaw'],'buy':0,'bonus':0,'primaryBonusKind':'none','typeMappingHash':h,'money':money}
