"""Own-response-pinned Carnival continuation. Unreviewed responses never settle."""
import json,re,xml.etree.ElementTree as ET
from pathlib import Path
from functools import lru_cache
from store import digest
from round_fields import check,amount,params
from explicit_request_probe import CONTRACT as OLD_CONTRACT,binding as old_binding,is_feature
from explicit_request_review import review_explicit_prefix,reviewed_pick_request
CONTRACT='nextgen-carnival-request-evidence-v2'
@lru_cache(maxsize=1)
def policy():
    return json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-explicit-continuation-contracts.json').read_text(encoding='utf-8'))
def binding(plan,raw):
    p=policy();b=p['sourceBinding'];previous={k:v for k,v in plan.items() if k not in ('explicitContinuationContract','explicitContinuationContractHash')}
    check(plan.get('explicitContinuationContract')==CONTRACT and plan.get('explicitContinuationContractHash')==digest(p)
          and p.get('contract')==CONTRACT and p.get('schema')=='sg-ag-carnival-continuation-evidence-v2'
          and digest(previous)==b['previousPlanHash'] and plan.get('gameId')==b['gameId']==32474
          and plan.get('sourceKey')==b['sourceKey'] and plan.get('runtimeGameId')==b['runtimeGameId']==33027
          and plan.get('runtimeSlug')==b['runtimeSlug'] and plan.get('betRaw')==b['betRaw']==108
          and plan.get('requestParams')==b['requestParams'] and plan.get('explicitProbeContract')==OLD_CONTRACT
          and plan.get('explicitProbeContractHash')==b['previousContractHash']
          and p.get('maximumReviewedOrdinal')==2 and p.get('maximumReviewedResponses')==3
          and p.get('firstPickObservedPosition')==0 and p.get('ownClosedPrefixes')==48
          and p.get('fullSpecialTerminalsObserved')==0 and p.get('settlementApproved') is False
          and p.get('sourceRequests')==p.get('mongoWrites')==p.get('failedRoundsCredited')==0,'EXPLICIT_CONTINUATION_BINDING')
    check(raw.get('explicitContinuationContract')==CONTRACT,'EXPLICIT_CONTINUATION_PROFILE')
    return previous,old_binding(previous,raw)
def route(plan,raw):
    _,base=binding(plan,raw);p=policy()
    if not is_feature(raw):return None
    steps=raw['steps'];check(1<=len(steps)<=3,'EXPLICIT_CONTINUATION_RESPONSE_REVIEW_REQUIRED')
    trigger=review_explicit_prefix(base,{**raw,'steps':steps[:1]})
    first=params(steps[0]['responsePayload']);held=amount(raw['startBalanceRaw'])-amount(plan['betRaw']);win=0
    pid=params(steps[0]['requestPayload'])['PID'];sid=first.get('SID')
    check(isinstance(sid,str) and 0<len(sid)<512,'EXPLICIT_CONTINUATION_SESSION')
    for i,s in enumerate(steps):
        msg='BET' if i==0 else 'FEATURE_START' if i==1 else 'FEATURE_PICK';q=params(s['requestPayload']);reply=params(s['responsePayload'])
        request={**plan['requestParams'],'MSGID':msg} if i==0 else {'MSGID':msg,'CFG':'1'} if i==1 else reviewed_pick_request(base,1,0)
        check(s.get('methodName')=='processGameMessage' and s.get('msgId')==msg and not s.get('sourceRejected')
              and q=={'GN':plan['runtimeSlug'],'PID':pid,**request},'EXPLICIT_CONTINUATION_REQUEST')
        check(reply.get('MSGID')==msg and reply.get('IFG')=='0' and reply.get('SID')==sid,'EXPLICIT_CONTINUATION_SESSION')
        balance,ab,tw=(amount(reply.get(k)) for k in ('B','AB','TW'))
        check(balance==held+tw and ab in (held,balance) and tw>=win and amount(s.get('responseBalance'))==ab,'EXPLICIT_CONTINUATION_MONEY');win=tw
        text=s.get('responseXml');check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper()
                                      and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
        try:xml=ET.fromstring(text)
        except ET.ParseError:check(False,'INVALID_TRIAL_XML')
        check(xml.tag.upper()=='GDMRESPONSE' and not any(n.tag.upper()=='ERROR' for n in xml)
              and len(xml.findall('SUCCESS'))==len(xml.findall('PAYLOAD'))==1 and str(xml.findtext('SUCCESS')).lower()=='true'
              and xml.findtext('PAYLOAD')==s['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(s.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING');keys=sorted(reply)
        if i==0:continue
        if i==1:
            with_nfg=keys==p['startWithNfgKeys'];without_nfg=keys==p['startWithoutNfgKeys']
            check(with_nfg or without_nfg,'EXPLICIT_CONTINUATION_RESPONSE_REVIEW_REQUIRED')
            if with_nfg:check(all(reply.get(k)==v for k,v in {'NFG':'3','TFG':'3','FGT':'3','CFGG':'0','CW':'0','FGTW':'0'}.items()),'EXPLICIT_CONTINUATION_RESPONSE_REVIEW_REQUIRED')
        else:
            check(keys==p['firstPickKeys'] and all(reply.get(k)==v for k,v in p['firstPickConstants'].items())
                  and reply.get('FTV_1')==first.get('FTV_1') and trigger['maxPicks']>1,'EXPLICIT_CONTINUATION_RESPONSE_REVIEW_REQUIRED')
    if len(steps)==1:return {'request':trigger['candidateRequest'],'options':[],'settlementApproved':False}
    ordinal=1 if len(steps)==2 else 2;selected=[0] if ordinal==2 else []
    options=[{'pickIndex':i+1,'position':i} for i in range(15) if i not in selected]
    return {'request':reviewed_pick_request(base,ordinal,options[0]['position']),'options':options,'settlementApproved':False}
def pick(plan,raw,position):
    _,base=binding(plan,raw);r=route(plan,raw)
    check(r is not None and r['request']['MSGID']=='FEATURE_PICK' and type(position) is int
          and any(o['position']==position for o in r['options']),'EXPLICIT_CONTINUATION_POSITION')
    return reviewed_pick_request(base,1 if len(raw['steps'])==2 else 2,position)
def intent(plan,raw,payload):
    r=route(plan,raw);check(r is not None,'EXPLICIT_CONTINUATION_INTENT_SCOPE');q=params(payload)
    request=r['request'];pid=params(raw['steps'][0]['requestPayload'])['PID']
    if request['MSGID']=='FEATURE_PICK':
        m=re.fullmatch(r'1\|(1|2)\|(\d+)',q.get('FP',''))
        check(m is not None and int(m[1])==(1 if len(raw['steps'])==2 else 2),'EXPLICIT_CONTINUATION_POSITION')
        request=pick(plan,raw,int(m[2]))
    check(q=={'GN':plan['runtimeSlug'],'PID':pid,**request},'EXPLICIT_CONTINUATION_INTENT_CHANGED')
    return {'validated':True}
