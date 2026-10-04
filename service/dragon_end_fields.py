"""Dragon's own PICK -> END request boundary; no END response or settlement."""
import json,re,xml.etree.ElementTree as ET
from pathlib import Path
from functools import lru_cache
from store import digest
from round_fields import check,amount,params
from explicit_request_dragon import binding as parent_binding,route as parent_route,CONTRACT as PARENT
from explicit_request_probe import is_feature
CONTRACT='nextgen-dragon-end-evidence-v3'
def previous(plan):return {k:v for k,v in plan.items() if k not in ('dragonEndContract','dragonEndContractHash')}
@lru_cache(maxsize=1)
def policy():return json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-dragon-end-contracts.json').read_text(encoding='utf-8'))
def binding(plan,raw):
    p=policy();b=p['sourceBinding'];old=previous(plan)
    check(plan.get('dragonEndContract')==CONTRACT and plan.get('dragonEndContractHash')==digest(p)
          and digest(p)=='7131fe63ebc2d7600490c1942f04983bbdd1dc81763ba9a9547ee22a5fc7a6ea' and p.get('contract')==CONTRACT and p.get('schema')=='sg-ag-dragon-end-evidence-v3'
          and digest(old)==b['previousPlanHash']=='38698c3720ae83510f1f840e4d461bed547dfef2ae5a123a54ed23907aae90b9'
          and b['previousProofHash']=='bb9bfc73f7644a39980dab1b34308f8515780dca460b94610a5ccbd8233a5c0c'
          and all(plan.get(k)==b[k] for k in ('gameId','sourceKey','runtimeGameId','runtimeSlug','betRaw','requestParams'))
          and plan['gameId']==32497 and plan['runtimeGameId']==33032 and plan['betRaw']==100
          and p['ownClosedPrefixes']==88 and p['durableFrameCount']==257 and p['ownFirstPickResponses']==81 and p['parentStartRejectionsRetained']==7
          and p['nativeEvidenceHash']=='d8ec0615fba6c4e68647b74a5241273d36c854ede02b3e940443fe693b2a2871'
          and p['candidateEnd']=={'MSGID':'FEATURE_END','CFG':'0'} and p['frontendMappings']=={'FID':'xO','FS_0':'m8','CFP_0':'G7'}
          and p['maximumReviewedResponses']==3 and p['endResponsesObserved']==p['fullSpecialTerminalsObserved']==0
          and p['settlementApproved'] is False and p['sourceRequests']==p['mongoWrites']==p['failedRoundsCredited']==0,'DRAGON_END_BINDING')
    check(raw.get('dragonEndContract')==CONTRACT and raw.get('explicitDragonContract')==PARENT,'DRAGON_END_PROFILE')
    parent_binding(old,raw);return old
def inspect_pd(text,p):
    check(isinstance(text,str) and len(text)<=p['maximumPdLength'] and text.endswith('#'),'DRAGON_END_RESPONSE_REVIEW_REQUIRED')
    pairs=[v.split('~') for v in text[:-1].split('#')]
    check(all(len(v)==2 for v in pairs) and len(set(v[0] for v in pairs))==len(pairs)
          and sorted(v[0] for v in pairs) in p['pdKeySets'],'DRAGON_END_RESPONSE_REVIEW_REQUIRED')
    for key,value in pairs:
        limits=p['pdValueLengthBounds'].get(key);allowed=p['pdScalarValues'].get(key)
        check(limits and limits[0]<=len(value)<=limits[1] and re.fullmatch(r'[0-9,;_-]+',value) is not None
              and (allowed is None or value in allowed),'DRAGON_END_RESPONSE_REVIEW_REQUIRED')
def route(plan,raw):
    old=binding(plan,raw);p=policy()
    if not is_feature(raw):return None
    steps=raw['steps'];check(1<=len(steps)<=3,'DRAGON_END_RESPONSE_REVIEW_REQUIRED')
    start=parent_route(old,{**raw,'steps':steps[:2]})
    if len(steps)<=2:return start
    first=params(steps[0]['responsePayload']);s=steps[2];q=params(s['requestPayload']);a=params(s['responsePayload'])
    pid=params(steps[0]['requestPayload'])['PID'];held=amount(raw['startBalanceRaw'])-100
    check(s.get('methodName')=='processGameMessage' and s.get('msgId')=='FEATURE_PICK' and not s.get('sourceRejected')
          and q=={'GN':plan['runtimeSlug'],'PID':pid,**start['request']},'DRAGON_END_REQUEST')
    check(a.get('MSGID')=='FEATURE_PICK' and a.get('SID')==first['SID'] and a.get('IFG')=='0','DRAGON_END_SESSION')
    balance,available,win=(amount(a.get(k)) for k in ('B','AB','TW'))
    check(win==amount(first['TW']) and balance==held+win and available in (held,balance)
          and amount(s.get('responseBalance'))==available,'DRAGON_END_MONEY')
    text=s.get('responseXml');check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
    try:xml=ET.fromstring(text)
    except ET.ParseError:check(False,'INVALID_TRIAL_XML')
    check(xml.tag.upper()=='GDMRESPONSE' and [n.tag for n in xml]==['OGS_RC','SUCCESS','PAYLOAD']
          and xml.findtext('OGS_RC')=='0' and str(xml.findtext('SUCCESS')).lower()=='true' and xml.findtext('PAYLOAD')==s['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
    check(amount(s.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING')
    expected={'FID':'0|','CFG':'0','CFP_0':'1','CFR_0':'1','FPM_0':'1;|','FS_0':'1','NFR_0':'1','TFW_0':'0'}
    check(sorted(a)==p['pickKeys'] and all(a.get(k)==v for k,v in expected.items()),'DRAGON_END_RESPONSE_REVIEW_REQUIRED')
    inspect_pd(a['PD'],p)
    return {'request':{'MSGID':'FEATURE_END','CFG':'0'},'options':[],'settlementApproved':False}
def intent(plan,raw,payload):
    r=route(plan,raw);check(r is not None,'DRAGON_END_INTENT_SCOPE')
    check(params(payload)=={'GN':plan['runtimeSlug'],'PID':params(raw['steps'][0]['requestPayload'])['PID'],**r['request']},'DRAGON_END_INTENT_CHANGED')
    return {'validated':True}
def validate_proof(plan,proof):
    binding(plan,dict(fixtureOnly=False,protocol='nextgen',sourceKey=plan['sourceKey'],roundFieldsVersion='sg-round-fields-v1',explicitProbeContract=plan.get('explicitProbeContract'),explicitDragonContract=plan.get('explicitDragonContract'),dragonEndContract=CONTRACT,steps=[]))
    p=policy();e=proof.get('dragonEndEvidence',{});wire=e.get('wiringEvidence',{});old={k:v for k,v in proof.items() if k not in ('planHash','dragonEndEvidence')}
    check(proof.get('planHash')==digest(plan) and digest({**old,'planHash':p['sourceBinding']['previousPlanHash']})==p['sourceBinding']['previousProofHash']
          and e.get('schema')=='sg-ag-dragon-end-repair-evidence-v3' and e.get('previousPlanHash')==p['sourceBinding']['previousPlanHash'] and e.get('previousProofHash')==p['sourceBinding']['previousProofHash']
          and e.get('contractHash')==plan['dragonEndContractHash'] and wire.get('schema')=='sg-ag-dragon-end-codec-replay-v3' and digest(wire)==p.get('actualWiringEvidenceHash')
          and wire.get('nativeEvidenceHash')==p['nativeEvidenceHash'] and wire.get('ownClosedPrefixes')==88 and wire.get('actualOwnCodecPythonRequests')==257
          and wire.get('originalFrontendCandidateRequests')==81 and wire.get('parentStartRejectionsRetained')==7 and wire.get('oldV2FailureParity')==88
          and wire.get('actualCodecPythonRecordAndVerify') is True and wire.get('oldAcceptedRecordParity')==99 and wire.get('ownSpecialSettlementRejected')==88
          and wire.get('endResponsesObserved')==wire.get('fullSpecialTerminalsObserved')==wire.get('sourceRequests')==wire.get('mongoWrites')==wire.get('failedRoundsCredited')==0,'DRAGON_END_PROOF')
    return True
