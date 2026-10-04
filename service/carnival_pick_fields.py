"""Carnival's own first/second PICK evidence. Third responses never settle."""
import json,re,xml.etree.ElementTree as ET
from pathlib import Path
from functools import lru_cache
from store import digest
from round_fields import check,amount,params
from explicit_request_continuation import binding as parent_binding,route as parent_route,CONTRACT as PARENT
from explicit_request_probe import is_feature
from explicit_request_review import review_explicit_prefix,reviewed_pick_request
CONTRACT='nextgen-carnival-pick-evidence-v3'
def previous(plan):return {k:v for k,v in plan.items() if k not in ('carnivalPickContract','carnivalPickContractHash')}
@lru_cache(maxsize=1)
def policy():return json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-carnival-pick-contracts.json').read_text(encoding='utf-8'))
def binding(plan,raw):
    p=policy();b=p['sourceBinding'];old=previous(plan)
    check(plan.get('carnivalPickContract')==CONTRACT and plan.get('carnivalPickContractHash')==digest(p)
          and digest(p)=='691e20e7c004f9eff2578dd25a9e4789b6cf8e55156e7bcd51c0e172017612fb' and p.get('contract')==CONTRACT and p.get('schema')=='sg-ag-carnival-pick-evidence-v3'
          and digest(old)==b['previousPlanHash']=='f813a221270d78e3164696d24d48d5a465f9d22c014b50c4eb38280fafe7e0d3'
          and b['previousProofHash']=='844177861bfdb5ad5005f678d16680ec1440d78a75779e0988657ec110aa8a4d'
          and all(plan.get(k)==b[k] for k in ('gameId','sourceKey','runtimeGameId','runtimeSlug','betRaw','requestParams'))
          and plan['gameId']==32474 and plan['runtimeGameId']==33027 and plan['betRaw']==108
          and p['ownClosedPrefixes']==77 and p['durableFrameCount']==244 and p['firstPickPositionCounts']=={'0':23,'1':54}
          and p['firstPickWithoutNfgCount']==36 and p['secondPickResponseCount']==13 and p['reviewedSecondPickPositions']==[0,1]
          and p['nativeEvidenceHash']=='8196376019fbae07fc13955dd958a4b6f28850d47c1676372c5252834f4e000c'
          and p['maximumReviewedOrdinal']==3 and p['maximumReviewedResponses']==4 and p['fullSpecialTerminalsObserved']==0
          and p['settlementApproved'] is False and p['sourceRequests']==p['mongoWrites']==p['failedRoundsCredited']==0,'CARNIVAL_PICK_BINDING')
    check(raw.get('carnivalPickContract')==CONTRACT and raw.get('explicitContinuationContract')==PARENT,'CARNIVAL_PICK_PROFILE')
    return old,parent_binding(old,raw)[1]
def route(plan,raw):
    old,base=binding(plan,raw);p=policy()
    if not is_feature(raw):return None
    steps=raw['steps'];check(1<=len(steps)<=4,'CARNIVAL_PICK_RESPONSE_REVIEW_REQUIRED')
    start=parent_route(old,{**raw,'steps':steps[:2]})
    if len(steps)<=2:return start
    first=params(steps[0]['responsePayload']);trigger=review_explicit_prefix(base,{**raw,'steps':steps[:1]})
    pid=params(steps[0]['requestPayload'])['PID'];sid=first['SID'];held=amount(raw['startBalanceRaw'])-108;selected=[]
    for ordinal,s in enumerate(steps[2:],1):
        q=params(s['requestPayload']);a=params(s['responsePayload']);m=re.fullmatch(r'1\|(1|2)\|(\d+)',q.get('FP',''))
        check(m is not None and int(m[1])==ordinal,'CARNIVAL_PICK_REQUEST');position=int(m[2])
        check(position in (0,1) if ordinal==1 else selected+[position]==p['reviewedSecondPickPositions'],'CARNIVAL_PICK_RESPONSE_REVIEW_REQUIRED')
        check(s.get('methodName')=='processGameMessage' and s.get('msgId')=='FEATURE_PICK' and not s.get('sourceRejected')
              and q=={'GN':plan['runtimeSlug'],'PID':pid,**reviewed_pick_request(base,ordinal,position)},'CARNIVAL_PICK_REQUEST')
        selected.append(position)
        check(a.get('MSGID')=='FEATURE_PICK' and a.get('SID')==sid and a.get('IFG')=='0','CARNIVAL_PICK_SESSION')
        balance,available,tw=(amount(a.get(k)) for k in ('B','AB','TW'))
        check(tw==amount(first['TW']) and balance==held+tw and available in (held,balance)
              and amount(s.get('responseBalance'))==available,'CARNIVAL_PICK_MONEY')
        text=s.get('responseXml');check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper()
                                      and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
        try:root=ET.fromstring(text)
        except ET.ParseError:check(False,'INVALID_TRIAL_XML')
        check(root.tag.upper()=='GDMRESPONSE' and [n.tag for n in root]==['OGS_RC','SUCCESS','PAYLOAD']
              and root.findtext('OGS_RC')=='0' and str(root.findtext('SUCCESS')).lower()=='true'
              and root.findtext('PAYLOAD')==s['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(s.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING')
        with_nfg=sorted(a)==p['pickKeys']['withNfg'];without_nfg=sorted(a)==p['pickKeys']['withoutNfg']
        expected={'FID':'1|0|' if with_nfg else '1|','CFG':'1','CFP_1':str(ordinal),'CFR_1':str(ordinal),
                  'FS_1':'1','NFR_1':'1','FPM_1':''.join(f'{n};' for n in selected)+'|','FTV_1':first['FTV_1']}
        check((with_nfg or without_nfg) and (ordinal==1 or with_nfg) and trigger['maxPicks']>ordinal
              and all(a.get(k)==v for k,v in expected.items()),'CARNIVAL_PICK_RESPONSE_REVIEW_REQUIRED')
        if with_nfg:check(all(a.get(k)==v for k,v in {'NFG':'3','TFG':'3','FGT':'3','CFGG':'0','CW':'0','FGTW':'0'}.items()),'CARNIVAL_PICK_RESPONSE_REVIEW_REQUIRED')
    options=[{'pickIndex':n+1,'position':n} for n in range(15) if n not in selected]
    return {'request':reviewed_pick_request(base,len(selected)+1,options[0]['position']),'options':options,'settlementApproved':False}
def pick(plan,raw,position):
    _,base=binding(plan,raw);r=route(plan,raw)
    check(r is not None and r['request']['MSGID']=='FEATURE_PICK' and type(position) is int
          and any(o['position']==position for o in r['options']),'CARNIVAL_PICK_POSITION')
    return reviewed_pick_request(base,len(raw['steps'])-1,position)
def intent(plan,raw,payload):
    r=route(plan,raw);check(r is not None,'CARNIVAL_PICK_INTENT_SCOPE');q=params(payload);request=r['request']
    if request['MSGID']=='FEATURE_PICK':
        m=re.fullmatch(r'1\|([1-3])\|(\d+)',q.get('FP',''))
        check(m is not None and int(m[1])==len(raw['steps'])-1,'CARNIVAL_PICK_POSITION');request=pick(plan,raw,int(m[2]))
    check(q=={'GN':plan['runtimeSlug'],'PID':params(raw['steps'][0]['requestPayload'])['PID'],**request},'CARNIVAL_PICK_INTENT_CHANGED')
    return {'validated':True}
def validate_proof(plan,proof):
    binding(plan,dict(fixtureOnly=False,protocol='nextgen',sourceKey=plan['sourceKey'],roundFieldsVersion='sg-round-fields-v1',explicitProbeContract=plan.get('explicitProbeContract'),explicitContinuationContract=plan.get('explicitContinuationContract'),carnivalPickContract=CONTRACT,steps=[]))
    p=policy();e=proof.get('carnivalPickEvidence',{});wire=e.get('wiringEvidence',{});old={k:v for k,v in proof.items() if k not in ('planHash','carnivalPickEvidence')}
    check(proof.get('planHash')==digest(plan) and digest({**old,'planHash':p['sourceBinding']['previousPlanHash']})==p['sourceBinding']['previousProofHash']
          and e.get('schema')=='sg-ag-carnival-pick-repair-evidence-v3' and e.get('previousPlanHash')==p['sourceBinding']['previousPlanHash']
          and e.get('previousProofHash')==p['sourceBinding']['previousProofHash'] and e.get('contractHash')==plan['carnivalPickContractHash']
          and wire.get('schema')=='sg-ag-carnival-pick-codec-replay-v3' and digest(wire)==p.get('actualWiringEvidenceHash')
          and wire.get('nativeEvidenceHash')==p['nativeEvidenceHash'] and wire.get('ownClosedPrefixes')==77 and wire.get('actualOwnCodecPythonRequests')==244
          and wire.get('actualCodecPythonRecordAndVerify') is True and wire.get('oldAcceptedRecordParity')==100 and wire.get('oldV2FailureParity')==77
          and wire.get('ownSpecialSettlementRejected')==77 and wire.get('fullSpecialTerminalsObserved')==0
          and wire.get('sourceRequests')==wire.get('mongoWrites')==wire.get('failedRoundsCredited')==0,'CARNIVAL_PICK_PROOF')
    return True
