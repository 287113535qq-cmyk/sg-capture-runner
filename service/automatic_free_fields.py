"""Evidence-bound automatic NFG continuation; no feature-choice requests."""
import json
from functools import lru_cache
from pathlib import Path
import xml.etree.ElementTree as ET
from round_fields import check,amount,params,types,VERSION
from store import digest

CONTRACT='nextgen-automatic-nfg-free-v1'

@lru_cache(maxsize=1)
def policy():
    p=json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-automatic-free-contracts.json').read_text(encoding='utf-8'))
    check(p.get('schema')=='sg-ag-rolling-automatic-free-contracts-v1' and p.get('sourceAllowance')==0,
          'AUTOMATIC_FREE_POLICY_REQUIRED')
    return p

def binding(plan):
    e=policy()['sources'].get(plan.get('sourceKey'))
    check(e is not None and plan.get('rollingPlan')=='sg-ag-rolling-plan-v1'
          and plan.get('automaticFreeContract')==CONTRACT and plan.get('automaticFreeContractHash')==digest(e)
          and all(plan.get(k)==e[k] for k in ('gameId','runtimeGameId','sourceKey','betRaw','requestParams'))
          and plan.get('balanceContract')==e.get('balanceContract'),'AUTOMATIC_FREE_PLAN_BINDING')
    return e

def prefix(raw):
    e=policy()['sources'].get(raw.get('sourceKey'))
    check(e is not None and raw.get('automaticFreeContract')==CONTRACT and raw.get('fixtureOnly') is False
          and raw.get('protocol')=='nextgen' and raw.get('roundFieldsVersion')==VERSION
          and raw.get('balanceContract')==e.get('balanceContract'),'AUTOMATIC_FREE_PROFILE_REQUIRED')
    start=amount(raw.get('startBalanceRaw'));stake=amount(e['betRaw']);check(start>=stake>0,'INVALID_WAGER_BASIS')
    steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=100,'INVALID_ROUND_STEPS')
    held=start-stake;remaining=0;win=0;balance=None;player=None
    for i,step in enumerate(steps):
        msg='BET' if i==0 else 'FREE_GAME'
        check(isinstance(step,dict) and step.get('msgId')==msg and step.get('methodName')=='processGameMessage'
              and not step.get('sourceRejected'),'AUTOMATIC_FREE_FRAME_SCOPE')
        check(i==0 or remaining>0,'UNEXPECTED_FREE_CONTINUATION')
        q=params(step.get('requestPayload'));pid=q.get('PID')
        check({k:v for k,v in q.items() if k!='PID'}=={**e['requestParams'],'MSGID':msg},'FIRST_ROUND_REQUEST_MODE')
        check(isinstance(pid,str) and pid.startswith('gdmgcm') and 6<len(pid)<512
              and (player is None or player==pid),'SESSION_CHANGED_MID_ROUND');player=pid
        p=params(step.get('responsePayload'))
        check(p.get('MSGID')==msg and p.get('IFG')==str(int(i>0)),'INVALID_NEXTGEN_STATE')
        remaining=amount(p.get('NFG','0'));check(remaining<=100 and (i==0 or 'NFG' in p),'TRIAL_FREE_LIMIT')
        fid=p.get('FID','0|');ordinary=fid in ('','0','0|')
        check(ordinary or fid in e['allowedFids'].get(msg,[]) and (remaining>0 or i>0 and e['allowTerminalFeatureId']),
              'UNKNOWN_TRIAL_FEATURE')
        check(not any(k.startswith(('FS_','NFR_')) for k in p) and 'CFG' not in p and 'ABPM' not in p
              and '#lives~' not in p.get('GSD',''),'UNKNOWN_TRIAL_FEATURE')
        b,ab,current=(amount(p.get(k)) for k in ('B','AB','TW'))
        terminal=i==len(steps)-1 and remaining==0
        check(b==held+current and (ab==held or terminal and ab==b) and current>=win,'AUTOMATIC_FREE_MONEY_MISMATCH')
        check(amount(step.get('responseBalance'))==ab,'AUTOMATIC_FREE_OBSERVER_MISMATCH')
        text=step.get('responseXml')
        check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper()
              and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
        try:root=ET.fromstring(text)
        except ET.ParseError:check(False,'INVALID_TRIAL_XML')
        check(root.tag.upper()=='GDMRESPONSE' and str(root.findtext('SUCCESS')).lower()=='true'
              and root.findtext('PAYLOAD')==step['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(step.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING');win=current;balance=b
    return {'count':len(steps),'remaining':remaining,'start':start,'stake':stake,'win':win,'balance':balance}

def settled(raw):
    state=prefix(raw);check(state['count']>0 and state['remaining']==0,'INCOMPLETE_ROUND')
    kind='freeGame' if state['count']>1 else 'none';buy,bonus,mapping=types(raw,kind)
    check(buy==0 and bonus==int(state['count']>1),'AUTOMATIC_FREE_MAPPING_MISMATCH')
    return {'roundFieldsVersion':VERSION,'protocol':'nextgen','sourceKey':raw['sourceKey'],
            'bet':state['stake']/100,'mul':state['win']/state['stake'],'buy':buy,'bonus':bonus,
            'primaryBonusKind':kind,'typeMappingHash':mapping,
            'money':{'startBalanceRaw':state['start'],'endBalanceRaw':state['balance'],
                     'totalWinRaw':state['win'],'betRaw':state['stake']}}

def next_request(raw):
    state=prefix(raw)
    return {'MSGID':'BET'} if not state['count'] else {'MSGID':'FREE_GAME'} if state['remaining'] else None
