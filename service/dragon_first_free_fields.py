"""Own Dragon END -> first FREE only; every FREE response remains unreviewed."""
import json,xml.etree.ElementTree as ET
from pathlib import Path
from functools import lru_cache
from store import digest
from round_fields import check,amount,params
from dragon_end_fields import binding as parent_binding,route as parent_route,validate_proof as parent_proof,CONTRACT as PARENT
from explicit_request_probe import is_feature
CONTRACT='nextgen-dragon-first-free-evidence-v4'
def previous(plan):return {k:v for k,v in plan.items() if k not in ('dragonFreeContract','dragonFreeContractHash')}
@lru_cache(maxsize=1)
def policy():return json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-dragon-first-free-contracts.json').read_text(encoding='utf-8'))
def binding(plan,raw):
 p=policy();b=p['sourceBinding'];old=previous(plan)
 check(plan.get('dragonFreeContract')==CONTRACT and plan.get('dragonFreeContractHash')==digest(p) and digest(p)=='a8c33978ab0705b12de455035b285b008dd285de3b860755b29cdb71078a7775'
       and p.get('contract')==CONTRACT and p.get('schema')=='sg-ag-dragon-first-free-evidence-v4'
       and digest(old)==b['previousPlanHash']=='a9fa454bb02814a861eeebd64d7a74b128ce811c0e4924e0e4b8b5924229eb39'
       and b['previousProofHash']=='31030705b04a69842b361122d441fcdb2b1ab5141acdea39e1a54d4ef1d8a112'
       and all(plan.get(k)==b[k] for k in ('gameId','sourceKey','runtimeGameId','runtimeSlug','betRaw','requestParams'))
       and p['ownClosedPrefixes']==70 and p['durableFrameCount']==280 and p['exactNativeIndexedRows']==1670
       and p['frontendEvidence']['originalFrontendExecutions']==70 and p['frontendEvidence']['originalObjectConstructorChainExecuted'] is True
       and p['frontendEvidence']['ownDragonConstructorRequest']==dict(MSGID='FREE_GAME',BPL='5',LB='50')
       and p['maximumReviewedResponses']==4 and p['maximumSourceRequests']==5 and p['candidateFirstFree']=={'MSGID':'FREE_GAME'}
       and p['freeResponsesObserved']==p['fullSpecialTerminalsObserved']==0 and p['settlementApproved'] is False
       and p['sourceRequests']==p['mongoWrites']==p['failedRoundsCredited']==0,'DRAGON_FREE_BINDING')
 check(raw.get('dragonFreeContract')==CONTRACT and raw.get('dragonEndContract')==PARENT,'DRAGON_FREE_PROFILE')
 parent_binding(old,raw);return old
def route(plan,raw):
 old=binding(plan,raw);p=policy()
 if not is_feature(raw):return None
 steps=raw['steps'];check(1<=len(steps)<=4,'DRAGON_FREE_RESPONSE_REVIEW_REQUIRED')
 parent=parent_route(old,{**raw,'steps':steps[:3]})
 if len(steps)<=3:return parent
 first=params(steps[0]['responsePayload']);s=steps[3];a=params(s['responsePayload']);pid=params(steps[0]['requestPayload'])['PID'];held=amount(raw['startBalanceRaw'])-100
 check(s.get('methodName')=='processGameMessage' and s.get('msgId')=='FEATURE_END' and not s.get('sourceRejected')
       and params(s['requestPayload'])=={'GN':plan['runtimeSlug'],'PID':pid,**parent['request']},'DRAGON_FREE_REQUEST')
 check(a.get('MSGID')=='FEATURE_END' and a.get('SID')==first['SID'] and a.get('IFG')=='0','DRAGON_FREE_SESSION')
 check(amount(a.get('TW'))==amount(first['TW']) and amount(a.get('B'))==held+amount(a.get('TW')) and amount(a.get('AB'))==held
       and amount(s.get('responseBalance'))==held,'DRAGON_FREE_MONEY')
 text=s.get('responseXml');check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
 try:xml=ET.fromstring(text)
 except ET.ParseError:check(False,'INVALID_TRIAL_XML')
 check(xml.tag.upper()=='GDMRESPONSE' and [n.tag for n in xml]==['OGS_RC','SUCCESS','PAYLOAD'] and xml.findtext('OGS_RC')=='0'
       and str(xml.findtext('SUCCESS')).lower()=='true' and xml.findtext('PAYLOAD')==s['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
 check(amount(s.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING')
 expected={'FID':'1|','CW':'0','CFGG':'0','FGTW':'0','BPL':'5','LB':'25','MUL':'1','GA':'0','FRBAL':'0'}
 check(sorted(a)==p['endKeys'] and all(a.get(k)==v for k,v in expected.items()) and amount(a.get('NFG')) in p['allowedInitialFreeCounts']
       and a['NFG']==a['TFG']==a['FGT'],'DRAGON_FREE_END_SHAPE')
 shape={k:v for k,v in a.items() if k not in ('B','AB','TW','SID')};check(digest(shape) in p['endShapeHashes'],'DRAGON_FREE_END_SHAPE')
 pick={k:v for k,v in params(steps[2]['responsePayload']).items() if k not in ('B','AB','TW','SID')};check(digest(dict(pick=pick,end=shape)) in p['endTransitionHashes'],'DRAGON_FREE_END_TRANSITION')
 return {'request':{'MSGID':'FREE_GAME'},'options':[],'settlementApproved':False}
def intent(plan,raw,payload):
 r=route(plan,raw);check(r is not None,'DRAGON_FREE_INTENT_SCOPE')
 base={'GN':plan['runtimeSlug']} if r['request']['MSGID'].startswith('FEATURE_') else plan['requestParams']
 check(params(payload)=={**base,'PID':params(raw['steps'][0]['requestPayload'])['PID'],**r['request']},'DRAGON_FREE_INTENT_CHANGED');return {'validated':True}
def validate_proof(plan,proof):
 binding(plan,dict(fixtureOnly=False,protocol='nextgen',sourceKey=plan['sourceKey'],roundFieldsVersion='sg-round-fields-v1',explicitProbeContract=plan.get('explicitProbeContract'),explicitDragonContract=plan.get('explicitDragonContract'),dragonEndContract=PARENT,dragonFreeContract=CONTRACT,steps=[]))
 p=policy();e=proof.get('dragonFreeEvidence',{});wire=e.get('wiringEvidence',{});old={k:v for k,v in proof.items() if k not in ('planHash','dragonFreeEvidence')};prior={**old,'planHash':digest(previous(plan))}
 check(proof.get('planHash')==digest(plan) and digest(prior)==p['sourceBinding']['previousProofHash'] and e.get('schema')=='sg-ag-dragon-first-free-repair-evidence-v4'
       and e.get('previousPlanHash')==p['sourceBinding']['previousPlanHash'] and e.get('previousProofHash')==p['sourceBinding']['previousProofHash'] and e.get('contractHash')==plan['dragonFreeContractHash']
       and wire.get('schema')=='sg-ag-dragon-first-free-codec-replay-v4' and digest(wire)==p.get('actualWiringEvidenceHash')
       and wire.get('ownClosedPrefixes')==70 and wire.get('actualOwnCodecPythonRequests')==280 and wire.get('originalFrontendCandidateRequests')==70
       and wire.get('oldV3BoundaryParity')==70 and wire.get('oldV2FailureParity')==88 and wire.get('oldAcceptedRecordParity')==99 and wire.get('actualCodecPythonRecordAndVerify') is True
       and wire.get('nativeEvidenceHash')==p['nativeEvidenceHash'] and wire.get('freeResponsesObserved')==wire.get('fullSpecialTerminalsObserved')==0
       and wire.get('sourceRequests')==wire.get('mongoWrites')==wire.get('failedRoundsCredited')==0,'DRAGON_FREE_PROOF')
 parent_proof(previous(plan),prior);return True
