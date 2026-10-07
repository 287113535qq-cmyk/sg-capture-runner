"""Independent offline terminal verifier; never changes production policy."""
import json,pathlib,sys,xml.etree.ElementTree as ET
H=pathlib.Path(__file__).resolve().parent
from automatic_free_fields import prefix as old_prefix,binding as old_binding
from round_fields import amount,params,check,types,VERSION
from store import digest
CONTRACT='nextgen-own-terminal-evidence-v3'
POLICY=json.loads((H.parent/'config/ag-rolling-own-terminal-contracts.json').read_bytes())
POLICIES=POLICY['sources']
def gsd(value):
    pairs=[v.split('~') for v in value.split('#')]
    check(all(len(p)==2 for p in pairs) and len({p[0] for p in pairs})==len(pairs),'TERMINAL_GSD')
    return dict(pairs)

GEOMETRY='nextgen-own-terminal-geometry-v4'
GEOMETRY_POLICY=json.loads((H.parent/'config/ag-rolling-terminal-geometry-contract.json').read_bytes())
def geometry_previous(plan):
 p=GEOMETRY_POLICY;previous={**plan,'ownTerminalContract':CONTRACT,'ownTerminalContractHash':digest(POLICIES['32708'])}
 check(plan['gameId']==32708 and plan['sourceKey']==p['sourceKey'] and plan.get('ownTerminalContract')==GEOMETRY
  and plan.get('ownTerminalContractHash')==digest(p) and p['contract']==GEOMETRY and p['schema']=='sg-own-terminal-geometry-contract-v4'
  and p['gameId']==32708 and digest(previous)==p['previousPlanHash'] and p['gridSize']==7 and p['terminalSizes']==[2,3]
  and p['newNaturalCases']==1 and p['linuxTests']==43 and p['independentOperations']==557 and p['ordinaryRows']==200
  and p['sourceRequests']==p['mongoWrites']==p['failedRoundsCredited']==0,'OWN_GEOMETRY_PLAN_BINDING')
 previous_plan(previous);return previous
def reviewed_geometry(value):
 import re
 if not isinstance(value,str) or not re.fullmatch(r'[0-6];[0-6]\|[23]',value):return False
 pos,size=value.split('|');x,y=map(int,pos.split(';'));n=int(size)
 return x+n<=7 and y+n<=7

def verify_terminal(plan,raw,geometry=False):
    policy=POLICIES.get(str(plan.get('gameId')))
    check(policy is not None and digest(plan)==policy['planHash'] and raw.get('sourceKey')==policy['sourceKey'],'TERMINAL_PLAN')
    old_binding(plan);steps=raw['steps'];check(1<len(steps)<=plan['maxSteps'],'TERMINAL_STEPS')
    before=old_prefix({**raw,'steps':steps[:-1]});check(before['remaining']==1,'TERMINAL_PREVIOUS_PENDING')
    final=steps[-1];v=params(final['responsePayload']);prior=params(steps[-2]['responsePayload'])
    check(sorted(v)==policy['responseKeys'] and final['methodName']=='processGameMessage' and final['msgId']=='FREE_GAME' and not final.get('sourceRejected'),'TERMINAL_FRAME')
    check(v['MSGID']=='FREE_GAME' and v['IFG']=='1' and v['NFG']=='0' and v['FID']==policy['terminalFid'] and prior['FID']==policy['previousFid']
          and v['TFG']==str(policy['terminalTotal']) and v['CFGG']==v['TFG'] and prior['TFG']==v['TFG']
          and amount(prior['CFGG'])+1==amount(v['CFGG']) and 'FGT' not in v,'TERMINAL_COUNTER')
    sid=pid=None;win=0
    for step in steps:
        q=params(step['requestPayload']);a=params(step['responsePayload'])
        check({k:v for k,v in q.items() if k!='PID'}=={**plan['requestParams'],'MSGID':step['msgId']}
              and isinstance(q.get('PID'),str) and q['PID'].startswith('gdmgcm') and len(q['PID'])<512 and (pid is None or pid==q['PID']),'TERMINAL_REQUEST');pid=q['PID']
        check(isinstance(a.get('SID'),str) and len(a['SID'])>0 and (sid is None or sid==a['SID']),'TERMINAL_SESSION');sid=a['SID']
        check(a['FRBAL']=='0' and a['BPR']==plan['requestParams']['BPR'] and a['MUL']=='1','TERMINAL_MODE')
        current=amount(a['TW']);check(current>=win and amount(a['CW'])==current-win,'TERMINAL_WIN_DELTA');win=current
        text=step['responseXml'];check('<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper(),'TERMINAL_XML')
        root=ET.fromstring(text)
        check(root.tag.upper()=='GDMRESPONSE' and not root.attrib and [c.tag for c in root]==['OGS_RC','SUCCESS','PAYLOAD'] and all(not list(c) and not c.attrib for c in root)
              and root.findtext('OGS_RC')=='0' and str(root.findtext('SUCCESS')).lower()=='true' and root.findtext('PAYLOAD')==step['responsePayload'],'TERMINAL_XML')
        check(amount(step['elapsedMs'])<=300000,'TERMINAL_TIME')
    total=amount(v['TW']);balance=amount(v['B']);stake=before['stake']
    check(total>=before['win'] and balance==before['start']-stake+total and amount(v['AB'])==balance and amount(final['responseBalance'])==balance,'TERMINAL_BALANCE')
    if plan['gameId']==32708:
        check(amount(v['FGTW'])==amount(prior['FGTW'])+amount(v['CW']),'TERMINAL_FREE_TOTAL')
        g=gsd(v['GSD']);check(g['CPDO']=='-1' and g['AGS']=='7' and (reviewed_geometry(g['MZ']) if geometry else g['MZ'].endswith('|2')) and not any(k in g for k in ['SNFG','STFG','SCFGG']),'TERMINAL_NESTED_PENDING')
    else:
        a=gsd(prior['GSD']);b=gsd(v['GSD'])
        direct=len(steps)==2 and prior['MSGID']=='BET'
        check(b['CFNFG']=='0' and b['WHEELSPIN']=='1' and b['WHSLICE']=='MINI|' and b['WHSTOP'] in ['0|','7|'] and b['CFTFG']=='1' and b['CFCFGG']=='1','TERMINAL_WHEEL_STATE')
        check((prior['FGT']=='1' and prior['CFGG']=='0' and prior['FGTW']=='0' and all(k not in a for k in ['CFNFG','FMS','FEAT_WIN']) and 'FMS' not in b)
              if direct else (a['CFNFG']=='0' and a['FMS']=='3' and b['FMS']=='3' and a['FEAT_WIN']==f"FG;{before['win']}|"),'TERMINAL_WHEEL_ENTRY')
        expected=('' if direct else f"FG;{before['win']}|")+f"WHEEL;{amount(v['CW'])}|"
        check(b['FEAT_WIN']==expected
              and amount(v['FGTW'])==amount(v['CW']) and amount(b['WHJPM'])*stake==amount(v['CW']),'TERMINAL_WHEEL_AWARD')
    return dict(startBalanceRaw=before['start'],endBalanceRaw=balance,totalWinRaw=total,betRaw=stake,bonus=1,primaryBonusKind='freeGame')

def previous_plan(plan):
 if plan.get('ownTerminalContract')==GEOMETRY:return previous_plan(geometry_previous(plan))
 p=POLICIES.get(str(plan.get('gameId')));prior={k:v for k,v in plan.items() if k not in ['ownTerminalContract','ownTerminalContractHash']}
 check(p is not None and plan['gameId'] in [32708,32715] and plan.get('ownTerminalContract')==CONTRACT
  and plan.get('ownTerminalContractHash')==digest(p) and POLICY.get('schema')=='sg-ag-own-terminal-contract-v3'
  and POLICY.get('contract')==CONTRACT and POLICY.get('sourceRequests')==POLICY.get('mongoWrites')==POLICY.get('failedRoundsCredited')==0
  and digest(prior)==p['planHash'] and p['gameId']==plan['gameId'] and p['sourceKey']==plan['sourceKey']
  and p['closedNaturalRounds']==(4 if plan['gameId']==32708 else 5)
  and len(p['closedRawHashes'])==len(set(p['closedRawHashes']))==p['closedNaturalRounds'],'OWN_TERMINAL_PLAN_BINDING')
 return prior

def binding(plan,raw):
 prior=previous_plan(plan)
 check(raw.get('ownTerminalContract')==plan.get('ownTerminalContract') and raw.get('automaticFreeContract')==prior['automaticFreeContract']
  and raw.get('sourceKey')==plan['sourceKey'] and raw.get('fixtureOnly') is False and raw.get('protocol')=='nextgen'
  and raw.get('roundFieldsVersion')==VERSION and 'balanceContract' not in raw,'OWN_TERMINAL_RAW_BINDING')
 return prior

def prefix(plan,raw):
 if plan.get('ownTerminalContract')==GEOMETRY and raw.get('ownTerminalContract')!=GEOMETRY:return prefix(geometry_previous(plan),raw)
 previous=binding(plan,raw);steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=previous['maxSteps'],'OWN_TERMINAL_STEPS')
 last=steps[-1] if steps else {};v=params(last['responsePayload']) if steps else {}
 if last.get('msgId')=='FREE_GAME' and v.get('NFG')=='0' and v.get('FID')==POLICIES[str(plan['gameId'])]['terminalFid']:
  m=verify_terminal(previous,raw,plan.get('ownTerminalContract')==GEOMETRY);return dict(count=len(steps),remaining=0,start=m['startBalanceRaw'],stake=m['betRaw'],win=m['totalWinRaw'],balance=m['endBalanceRaw'])
 return old_prefix(raw)

def next_request(raw,plan):
 s=prefix(plan,raw);return {'MSGID':'BET'} if not s['count'] else {'MSGID':'FREE_GAME'} if s['remaining'] else None

def settled(raw,plan):
 s=prefix(plan,raw);check(s['count']>0 and s['remaining']==0,'INCOMPLETE_ROUND');kind='freeGame' if s['count']>1 else 'none'
 buy,bonus,mapping=types(raw,kind);check(buy==0 and bonus==int(s['count']>1),'OWN_TERMINAL_MAPPING')
 return dict(roundFieldsVersion=VERSION,protocol='nextgen',sourceKey=raw['sourceKey'],bet=s['stake']/100,mul=s['win']/s['stake'],buy=buy,bonus=bonus,primaryBonusKind=kind,typeMappingHash=mapping,
  money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=s['stake']))

def validate_proof(plan,proof):
 if plan.get('ownTerminalContract')==GEOMETRY:
  previous=geometry_previous(plan);p=GEOMETRY_POLICY;e=proof.get('geometryEvidence',{})
  old={**{k:v for k,v in proof.items() if k not in ['planHash','geometryEvidence']},'planHash':digest(previous)}
  check(proof.get('planHash')==digest(plan) and digest(old)==p['previousProofHash']
   and e.get('schema')=='sg-own-terminal-geometry-proof-v4' and e.get('previousPlanHash')==digest(previous) and e.get('previousProofHash')==digest(old)
   and e.get('contractHash')==digest(p) and e.get('naturalEvidenceSha256')==p['naturalEvidenceSha256'] and e.get('clientSha256')==p['clientSha256']
   and e.get('offlineLinuxProofSha256')==p['offlineLinuxProofSha256'] and e.get('sourceRequests')==e.get('mongoWrites')==e.get('failedRoundsCredited')==0,'OWN_GEOMETRY_PROOF')
  import re
  c=e.get('codecEvidence',{});rows=c.get('results',[])
  check(c.get('schema')=='sg-own-geometry-codec-evidence-v4' and c.get('evidenceHash')==digest({k:v for k,v in c.items() if k!='evidenceHash'})
   and c.get('actualCodecPythonRecordVerify') is True and c.get('strictOldMarkerRetained') is True and c.get('sourceRequests')==c.get('databaseWrites')==0
   and len(rows)==2 and all(r.get('gameId')==['32708','32715'][i] and r.get('records')==[101,100][i] and r.get('ordinaryOldRecords')==100
    and r.get('routes')==[209,134][i] and re.fullmatch('[a-f0-9]{64}',r.get('recordsHash','')) for i,r in enumerate(rows)),'OWN_GEOMETRY_CODEC_PROOF')
  validate_proof(previous,old);return previous,old

 import re
 previous=previous_plan(plan);p=POLICIES[str(plan['gameId'])];e=proof.get('ownTerminalEvidence',{});w=e.get('wiringEvidence',{})
 old={**{k:v for k,v in proof.items() if k not in ['planHash','ownTerminalEvidence']},'planHash':digest(previous)}
 check(proof.get('planHash')==digest(plan) and digest(old)==p['previousProofHash']
  and e.get('schema')=='sg-ag-own-terminal-repair-evidence-v3' and e.get('previousPlanHash')==p['planHash'] and e.get('previousProofHash')==p['previousProofHash']
  and e.get('contractHash')==digest(p) and e.get('ownClosedNaturalRounds')==p['closedNaturalRounds'] and e.get('nativeEvidenceHash')==digest(p['closedRawHashes'])
  and e.get('ordinaryHistoryFileSha256')==old['historyFileSha256'] and e.get('ordinaryRows')==100 and e.get('independentJsPython') is True
  and e.get('sourceRequests')==e.get('mongoWrites')==e.get('failedRoundsCredited')==0
  and w.get('schema')=='sg-own-terminal-codec-game-v3' and w.get('evidenceHash')==digest({k:v for k,v in w.items() if k!='evidenceHash'})
  and w.get('gameId')==str(plan['gameId']) and w.get('actualCodecPythonRecordAndVerify') is True and w.get('ownClosedNaturalRounds')==p['closedNaturalRounds']
  and w.get('ordinaryRows')==100 and w.get('actualOwnAndOrdinaryCodecRequests')==(254 if plan['gameId']==32708 else 151)
  and w.get('totalNewMarkedRecords')==100+p['closedNaturalRounds'] and w.get('oldMarkerTerminalRejected')==p['closedNaturalRounds']
  and w.get('oldRawHashesUnchanged') is True and w.get('historyFileSha256')==old['historyFileSha256']
  and re.fullmatch('[a-f0-9]{64}',w.get('fullRecordsHash','')) is not None and w.get('sourceRequests')==w.get('mongoWrites')==w.get('failedRoundsCredited')==0,
  'OWN_TERMINAL_PROOF')
 return previous,old
