"""Evidence-pinned rolling NextGen deferred award balance contract.

B contains the cumulative round award; AB is the unchanged deducted balance.
Both remain mandatory and every frame must prove B=AB+TW and AB=start-stake.
Unmarked historical records keep their original settlement and mapping hashes.
"""
import json
from functools import lru_cache
from pathlib import Path
import xml.etree.ElementTree as ET
from round_fields import check, amount, params, types, VERSION
from store import digest

CONTRACT='nextgen-held-award-balance-v1'


@lru_cache(maxsize=1)
def policy():
    result=json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-balance-contracts.json').read_text(encoding='utf-8'))
    check(result.get('schema')=='sg-ag-rolling-balance-contracts-v1' and result.get('sourceAllowance')==0,
          'HELD_BALANCE_POLICY_REQUIRED')
    return result


def binding(plan):
    entry=policy()['sources'].get(plan.get('sourceKey'))
    check(entry is not None and plan.get('rollingPlan')=='sg-ag-rolling-plan-v1'
          and plan.get('balanceContract')==CONTRACT and plan.get('balanceContractHash')==digest(entry)
          and all(plan.get(k)==entry[k] for k in ('gameId','runtimeGameId','sourceKey','betRaw','requestParams')),
          'HELD_BALANCE_PLAN_BINDING')
    return entry


def settled(raw):
    check(raw.get('balanceContract')==CONTRACT and raw.get('fixtureOnly') is False
          and raw.get('protocol')=='nextgen' and raw.get('roundFieldsVersion')==VERSION, 'HELD_BALANCE_PROFILE_REQUIRED')
    entry=policy()['sources'].get(raw.get('sourceKey'))
    check(entry is not None,'HELD_BALANCE_SOURCE_NOT_REVIEWED')
    start=amount(raw.get('startBalanceRaw'));stake=amount(entry['betRaw'])
    check(start>=stake and stake>0,'INVALID_WAGER_BASIS')
    held=start-stake;steps=raw.get('steps')
    check(isinstance(steps,list) and 0<len(steps)<=100,'INVALID_ROUND_STEPS')
    remaining=0;previous_win=0;player=None;final_balance=None
    for i,step in enumerate(steps):
        msg='BET' if i==0 else 'FREE_GAME'
        check(step.get('msgId')==msg and step.get('methodName')=='processGameMessage'
              and not step.get('sourceRejected'),'HELD_BALANCE_FRAME_SCOPE')
        check(i==0 or remaining>0,'UNEXPECTED_FREE_CONTINUATION')
        q=params(step.get('requestPayload'))
        check({k:v for k,v in q.items() if k!='PID'}=={**entry['requestParams'],'MSGID':msg},'FIRST_ROUND_REQUEST_MODE')
        pid=q.get('PID');check(isinstance(pid,str) and pid.startswith('gdmgcm') and 6<len(pid)<512
                             and (player is None or player==pid),'SESSION_CHANGED_MID_ROUND');player=pid
        p=params(step.get('responsePayload'))
        check(p.get('MSGID')==msg and p.get('IFG')==('0' if i==0 else '1'),'INVALID_NEXTGEN_STATE')
        check(p.get('FID','0|') in ('0','0|','') and not any(k.startswith(('FS_','NFR_')) for k in p)
              and 'CFG' not in p and 'ABPM' not in p,'UNKNOWN_TRIAL_FEATURE')
        remaining=amount(p.get('NFG','0'));check(remaining<=100 and (i==0 or 'NFG' in p),'TRIAL_FREE_LIMIT')
        check('#lives~' not in p.get('GSD',''),'UNKNOWN_TRIAL_FEATURE')
        b,ab,win=(amount(p.get(k)) for k in ('B','AB','TW'))
        check(ab==held and b-ab==win and win>=previous_win,'HELD_BALANCE_RELATION_MISMATCH')
        check(amount(step.get('responseBalance'))==ab,'HELD_BALANCE_OBSERVER_MISMATCH')
        text=step.get('responseXml')
        check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper()
              and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
        try:root=ET.fromstring(text)
        except ET.ParseError:check(False,'INVALID_TRIAL_XML')
        check(root.tag.upper()=='GDMRESPONSE' and str(root.findtext('SUCCESS')).lower()=='true'
              and root.findtext('PAYLOAD')==step['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(step.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING')
        previous_win=win;final_balance=b
    check(remaining==0,'INCOMPLETE_ROUND')
    kind='freeGame' if len(steps)>1 else 'none'
    buy,bonus,mapping_hash=types(raw,kind)
    check(buy==0 and bonus==(1 if len(steps)>1 else 0),'HELD_BALANCE_MAPPING_MISMATCH')
    return {'roundFieldsVersion':VERSION,'protocol':'nextgen','sourceKey':raw['sourceKey'],
            'bet':stake/100,'mul':previous_win/stake,'buy':buy,'bonus':bonus,
            'primaryBonusKind':kind,'typeMappingHash':mapping_hash,
            'money':{'startBalanceRaw':start,'endBalanceRaw':final_balance,'totalWinRaw':previous_win,'betRaw':stake}}
