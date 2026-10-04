"""Evidence-bounded Dragon START -> fixed frontend PICK; never special credit."""
import json,re,xml.etree.ElementTree as ET
from pathlib import Path
from functools import lru_cache
from store import digest
from round_fields import check,amount,params
from explicit_request_probe import CONTRACT as OLD,binding as old_binding,is_feature
from explicit_request_review import review_explicit_prefix,reviewed_pick_request
CONTRACT='nextgen-dragon-start-evidence-v2'
@lru_cache(maxsize=1)
def policy():
    return json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-explicit-dragon-contracts.json').read_text(encoding='utf-8'))
def binding(plan,raw):
    p=policy();b=p['sourceBinding'];previous={k:v for k,v in plan.items() if k not in ('explicitDragonContract','explicitDragonContractHash')}
    check(plan.get('explicitDragonContract')==CONTRACT and plan.get('explicitDragonContractHash')==digest(p)
          and p.get('contract')==CONTRACT and p.get('schema')=='sg-ag-dragon-start-evidence-v2'
          and digest(previous)==b['previousPlanHash'] and plan.get('gameId')==b['gameId']==32497
          and plan.get('runtimeGameId')==b['runtimeGameId']==33032 and plan.get('sourceKey')==b['sourceKey']
          and plan.get('runtimeSlug')==b['runtimeSlug'] and plan.get('betRaw')==b['betRaw']==100
          and plan.get('requestParams')==b['requestParams'] and plan.get('explicitProbeContract')==OLD
          and plan.get('explicitProbeContractHash')==b['previousContractHash']
          and p.get('ownClosedPrefixes')==72 and p.get('maximumReviewedResponses')==p.get('maximumReviewedContinuations')==2
          and p.get('candidatePick')=={'MSGID':'FEATURE_PICK','CFG':'0','FP':'0|1|1'}
          and p.get('fullSpecialTerminalsObserved')==0 and p.get('settlementApproved') is False
          and p.get('sourceRequests')==p.get('mongoWrites')==p.get('failedRoundsCredited')==0,'EXPLICIT_DRAGON_BINDING')
    check(raw.get('explicitDragonContract')==CONTRACT,'EXPLICIT_DRAGON_PROFILE')
    return previous,old_binding(previous,raw)
def inspect_pd(text,p):
    check(isinstance(text,str) and len(text)<=215 and text.endswith('#'),'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED')
    pairs=[pair.split('~') for pair in text[:-1].split('#')]
    check(all(len(pair)==2 for pair in pairs) and len(set(pair[0] for pair in pairs))==len(pairs),'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED')
    check(sorted(pair[0] for pair in pairs) in p['pdKeySets'],'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED')
    for key,value in pairs:
        limits=p['pdValueLengthBounds'].get(key);allowed=p['pdScalarValues'].get(key)
        check(limits and limits[0]<=len(value)<=limits[1] and re.fullmatch(r'[0-9,;_-]+',value) is not None
              and (allowed is None or value in allowed),'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED')
def route(plan,raw):
    _,base=binding(plan,raw);p=policy()
    if not is_feature(raw):return None
    steps=raw['steps'];check(1<=len(steps)<=2,'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED')
    review=review_explicit_prefix(base,{**raw,'steps':steps[:1]});check(review['maxPicks']==1,'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED')
    first=params(steps[0]['responsePayload']);pid=params(steps[0]['requestPayload'])['PID'];sid=first.get('SID')
    check(isinstance(sid,str) and 0<len(sid)<512,'EXPLICIT_DRAGON_SESSION')
    held=amount(raw['startBalanceRaw'])-amount(plan['betRaw']);check(held>=0,'EXPLICIT_DRAGON_MONEY');win=0
    for i,s in enumerate(steps):
        msg='BET' if i==0 else 'FEATURE_START';q=params(s['requestPayload']);reply=params(s['responsePayload'])
        request={**plan['requestParams'],'MSGID':msg} if i==0 else {'MSGID':msg,'CFG':'0'}
        check(s.get('methodName')=='processGameMessage' and s.get('msgId')==msg and not s.get('sourceRejected')
              and q=={'GN':plan['runtimeSlug'],'PID':pid,**request},'EXPLICIT_DRAGON_REQUEST')
        check(reply.get('MSGID')==msg and reply.get('IFG')=='0' and reply.get('SID')==sid,'EXPLICIT_DRAGON_SESSION')
        balance,ab,tw=(amount(reply.get(k)) for k in ('B','AB','TW'))
        check(balance==held+tw and ab in (held,balance) and tw>=win and amount(s.get('responseBalance'))==ab,'EXPLICIT_DRAGON_MONEY');win=tw
        text=s.get('responseXml');check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper()
                                      and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
        try:xml=ET.fromstring(text)
        except ET.ParseError:check(False,'INVALID_TRIAL_XML')
        check(xml.tag.upper()=='GDMRESPONSE' and not any(n.tag.upper()=='ERROR' for n in xml)
              and len(xml.findall('SUCCESS'))==len(xml.findall('PAYLOAD'))==1 and str(xml.findtext('SUCCESS')).lower()=='true'
              and xml.findtext('PAYLOAD')==s['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(s.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING')
        if i==1:
            check(sorted(reply)==p['startKeys'] and reply['TW']==first['TW'],'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED');inspect_pd(reply['PD'],p)
    return {'request':review['candidateRequest'] if len(steps)==1 else reviewed_pick_request(base,1,0),'options':[],'settlementApproved':False}
def intent(plan,raw,payload):
    r=route(plan,raw);check(r is not None,'EXPLICIT_DRAGON_INTENT_SCOPE')
    check(params(payload)=={'GN':plan['runtimeSlug'],'PID':params(raw['steps'][0]['requestPayload'])['PID'],**r['request']},'EXPLICIT_DRAGON_INTENT_CHANGED')
    return {'validated':True}
