"""Independent, read-only explicit request review; no record authorization."""
import json
from functools import lru_cache
from pathlib import Path
import xml.etree.ElementTree as ET
from round_fields import check, amount, params, VERSION
from store import digest

@lru_cache(maxsize=1)
def policy():
    return json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-explicit-request-reviews.json').read_text(encoding='utf-8'))

def scope(plan):
    p=policy();key=str(plan.get('gameId'));entry=p.get('sourceBindings',{}).get(key)
    check(key in ('32474','32497') and entry is not None and entry['planHash']==digest(plan)
          and plan.get('adapter')=='native-nextgen-v1' and plan.get('rollingPlan')=='sg-ag-rolling-plan-v1'
          and p.get('diagnosticEvidenceOnly') is True and p.get('automaticAdmission') is False
          and p.get('sourceRequests')==p.get('mongoWrites')==p.get('failedRoundsCredited')==0
          and p.get('fullSpecialTerminalsObserved')==0,'EXPLICIT_REVIEW_PLAN_BINDING')
    return key

def reviewed_pick_request(plan,ordinal,position=0):
    key=scope(plan)
    check(type(ordinal) is int and 1<=ordinal<=15,'EXPLICIT_PICK_ORDINAL')
    check(type(position) is int and 0<=position<=14,'EXPLICIT_PICK_POSITION')
    if key=='32497':
        check(ordinal==1 and position==0,'EXPLICIT_DRAGON_PICK_SCOPE')
        return {'MSGID':'FEATURE_PICK','CFG':'0','FP':'0|1|1'}
    p=policy()
    check(p.get('originalFrontendGridExecuted') is True and p.get('carnivalPositionEventCount')==15
          and p.get('carnivalFrontendPositionMin')==0 and p.get('carnivalFrontendPositionMax')==14,
          'EXPLICIT_POSITION_EVIDENCE')
    return {'MSGID':'FEATURE_PICK','CFG':'1','FP':f'1|{ordinal}|{position}'}

def review_explicit_prefix(plan,raw):
    key=scope(plan);cfg='1' if key=='32474' else '0'
    check(raw.get('fixtureOnly') is False and raw.get('protocol')=='nextgen'
          and raw.get('sourceKey')==plan['sourceKey'] and raw.get('roundFieldsVersion')==VERSION,'EXPLICIT_REVIEW_PROFILE')
    steps=raw.get('steps');check(isinstance(steps,list) and 1<=len(steps)<=2,'UNREVIEWED_EXPLICIT_RESPONSE')
    start,stake=amount(raw.get('startBalanceRaw')),amount(plan['betRaw'])
    check(start>=stake>0,'INVALID_WAGER_BASIS');player=None;previous=0;parsed=[]
    for i,s in enumerate(steps):
        msg='FEATURE_START' if i else 'BET'
        check(s.get('methodName')=='processGameMessage' and s.get('msgId')==msg and not s.get('sourceRejected'),'EXPLICIT_REVIEW_FRAME')
        q=params(s.get('requestPayload'));pid=q.get('PID')
        expected={'GN':plan['runtimeSlug'],'MSGID':msg,'CFG':cfg} if i else {**plan['requestParams'],'MSGID':msg}
        check({k:v for k,v in q.items() if k!='PID'}==expected,'EXPLICIT_REVIEW_REQUEST')
        check(isinstance(pid,str) and pid.startswith('gdmgcm') and 6<len(pid)<512
              and (player is None or player==pid),'SESSION_CHANGED_MID_ROUND');player=pid
        p=params(s.get('responsePayload'));check(p.get('MSGID')==msg and p.get('IFG')=='0','EXPLICIT_REVIEW_STATE')
        check(amount(p.get('NFG','0'))<=100 and 'ABPM' not in p and '#lives~' not in p.get('GSD',''),
              'UNREVIEWED_EXPLICIT_RESPONSE')
        held=start-stake;b,ab,win=(amount(p.get(k)) for k in ('B','AB','TW'))
        check(b==held+win and ab in (held,b) and win>=previous,'EXPLICIT_REVIEW_MONEY');previous=win
        check(amount(s.get('responseBalance'))==ab,'EXPLICIT_REVIEW_OBSERVER')
        text=s.get('responseXml');check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper()
                                      and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
        try:xml=ET.fromstring(text)
        except ET.ParseError:check(False,'INVALID_TRIAL_XML')
        check(xml.tag.upper()=='GDMRESPONSE' and str(xml.findtext('SUCCESS')).lower()=='true'
              and xml.findtext('PAYLOAD')==s['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(s.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING');parsed.append(p)
    trigger=parsed[0];fids=('1|','1|0|') if key=='32474' else ('0|',)
    check(trigger.get('CFG')==cfg and trigger.get('FID') in fids and trigger.get('FS_'+cfg)=='0'
          and trigger.get('NFR_'+cfg)=='1' and trigger.get('CFP_'+cfg)=='0' and trigger.get('FPM_'+cfg)=='|'
          and not any((k.startswith('FS_') or k.startswith('NFR_')) and k not in ('FS_'+cfg,'NFR_'+cfg)
                      for k in trigger),'EXPLICIT_TRIGGER_REQUIRED')
    values=[amount(v) for v in trigger.get('FTV_'+cfg,'').rstrip('|;').split(';')]
    check(len(values)>=3,'EXPLICIT_PICK_COUNT');maximum=values[1]
    check(1<=maximum<=15 and values[2]==maximum and len(values)==maximum+3
          and all(1<=v<=5 for v in values[3:]) and (key=='32474' or maximum==1),'EXPLICIT_PICK_COUNT')
    candidate={'MSGID':'FEATURE_START','CFG':cfg};options=[]
    if len(steps)==2:
        check(key=='32474','UNREVIEWED_EXPLICIT_RESPONSE');p=parsed[1]
        check(amount(p.get('NFG'))>0 and 'FID' not in p and 'CFG' not in p
              and not any(k.startswith(('FS_','NFR_')) for k in p),'UNREVIEWED_EXPLICIT_RESPONSE')
        candidate=reviewed_pick_request(plan,1,0)
        options=[{'pickIndex':i+1,'position':i} for i in range(15)]
    return {'schema':'sg-explicit-prefix-review-v1','gameId':plan['gameId'],'frames':len(steps),
            'diagnosticOnly':True,'sourceAllowance':0,'settlementApproved':False,
            'candidateRequest':candidate,'maxPicks':maximum,'options':options}
