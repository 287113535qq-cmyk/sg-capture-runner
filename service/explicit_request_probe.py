"""Bounded new-session request evidence; unobserved responses never settle."""
import re
from explicit_request_review import policy,review_explicit_prefix,reviewed_pick_request
from round_fields import check,params,VERSION
from store import digest
CONTRACT='nextgen-explicit-request-evidence-v1'
def binding(plan,raw):
    base={k:v for k,v in plan.items() if k not in ('explicitProbeContract','explicitProbeContractHash','explicitContinuationContract','explicitContinuationContractHash')}
    p=policy()
    check(plan.get('explicitProbeContract')==CONTRACT and plan.get('explicitProbeContractHash')==digest(p)
          and p.get('sourceBindings',{}).get(str(plan['gameId']),{}).get('planHash')==digest(base)
          and base.get('adapter')=='native-nextgen-v1' and base.get('buy')==0 and base.get('maxSteps')==100,
          'EXPLICIT_PROBE_BINDING')
    check(raw.get('explicitProbeContract')==CONTRACT and raw.get('fixtureOnly') is False
          and raw.get('protocol')=='nextgen' and raw.get('sourceKey')==plan['sourceKey']
          and raw.get('roundFieldsVersion')==VERSION and isinstance(raw.get('steps'),list),'EXPLICIT_PROBE_PROFILE')
    return base
def is_feature(raw):
    p=params(raw['steps'][0]['responsePayload']) if raw['steps'] else {}
    return any(s.get('msgId','').startswith('FEATURE_') for s in raw['steps']) or any(k=='CFG' or k.startswith(('FS_','NFR_')) for k in p)
def route(plan,raw):
    base=binding(plan,raw)
    if not is_feature(raw):return None
    check(len(raw['steps'])<=2 and (len(raw['steps'])!=2 or plan['gameId']==32474),
          'EXPLICIT_PROBE_RESPONSE_REVIEW_REQUIRED')
    review=review_explicit_prefix(base,raw)
    return {'request':review['candidateRequest'],'options':review['options'],'settlementApproved':False}
def pick(plan,raw,position):
    base=binding(plan,raw);r=route(plan,raw)
    check(r is not None and r['request']['MSGID']=='FEATURE_PICK' and type(position) is int
          and any(o['position']==position for o in r['options']),'EXPLICIT_PROBE_POSITION')
    return reviewed_pick_request(base,1,position)
def intent(plan,raw,payload):
    r=route(plan,raw);check(r is not None,'EXPLICIT_PROBE_INTENT_SCOPE')
    q=params(payload);pid=params(raw['steps'][0]['requestPayload'])['PID'];request=r['request']
    if request['MSGID']=='FEATURE_PICK':
        match=re.fullmatch(r'1\|1\|(\d+)',q.get('FP',''));check(match is not None,'EXPLICIT_PROBE_POSITION')
        request=pick(plan,raw,int(match[1]))
    check(q=={'GN':plan['runtimeSlug'],'PID':pid,**request},'EXPLICIT_PROBE_INTENT_CHANGED')
    return {'validated':True}
