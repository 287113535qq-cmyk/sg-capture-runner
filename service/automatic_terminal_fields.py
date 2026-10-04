"""Independent Money Raid Wapiti terminal contract; old v1 markers stay unchanged."""
import json
from pathlib import Path
from functools import lru_cache
import xml.etree.ElementTree as ET
from round_fields import check,amount,params,types,VERSION
from store import digest
from automatic_free_fields import CONTRACT as PREVIOUS_CONTRACT,policy as previous_policy,prefix as previous_prefix
CONTRACT='nextgen-moneyraid-terminal-evidence-v2'
@lru_cache(maxsize=1)
def policy():return json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-automatic-terminal-contracts.json').read_bytes())
def binding(plan,raw):
 p=policy();b=p['sourceBinding'];prior={k:v for k,v in plan.items() if k not in ('automaticTerminalContract','automaticTerminalContractHash')}
 check(plan.get('automaticTerminalContract')==CONTRACT and plan.get('automaticTerminalContractHash')==digest(p)
  and p.get('schema')=='sg-ag-moneyraid-terminal-evidence-v2' and p.get('contract')==CONTRACT
  and digest(prior)==b['previousPlanHash'] and plan.get('gameId')==32595 and plan.get('runtimeGameId')==33066
  and plan.get('runtimeSlug')=='moneyraidwapiti96' and plan.get('sourceKey')==b['sourceKey']
  and plan.get('betRaw')==200 and plan.get('maxSteps')==100 and plan.get('requestParams')==b['requestParams']
  and plan.get('automaticFreeContract')==PREVIOUS_CONTRACT and plan.get('automaticFreeContractHash')==b['previousContractHash']
  and digest(previous_policy()['sources'][plan['sourceKey']])==b['previousContractHash']
  and p.get('ownClosedNaturalRounds')==104 and p.get('terminalFidCounts')=={'2|':91,'3|':13}
  and p.get('initialRemaining')=={'2|':[7],'3|':[9,10,11,12]}
  and p.get('sourceRequests')==p.get('mongoWrites')==p.get('failedRoundsCredited')==0,'AUTOMATIC_TERMINAL_BINDING')
 check(raw.get('automaticTerminalContract')==CONTRACT and raw.get('automaticFreeContract')==PREVIOUS_CONTRACT
  and raw.get('sourceKey')==plan['sourceKey'] and raw.get('fixtureOnly') is False and raw.get('protocol')=='nextgen'
  and raw.get('roundFieldsVersion')==VERSION and 'balanceContract' not in raw,'AUTOMATIC_TERMINAL_PROFILE')
 return p
def prefix(raw,plan=None):
 if plan is None:
  book=json.loads((Path(__file__).resolve().parents[1]/'config/ag-rolling-plans.json').read_bytes());plan=book['plans']['32595']
 p=binding(plan,raw);steps=raw.get('steps');check(isinstance(steps,list) and len(steps)<=100,'INVALID_ROUND_STEPS')
 if not steps or params(steps[0]['responsePayload']).get('FID') not in ('2|','3|'):return previous_prefix(raw)
 start=amount(raw.get('startBalanceRaw'));stake=200;held=start-stake;check(held>=0,'INVALID_WAGER_BASIS')
 remaining=total=win=base=0;balance=pid=sid=fid=None
 for i,st in enumerate(steps):
  msg='FREE_GAME' if i else 'BET';q=params(st.get('requestPayload'));v=params(st.get('responsePayload'))
  check(st.get('msgId')==msg and st.get('methodName')=='processGameMessage' and not st.get('sourceRejected'),'AUTOMATIC_TERMINAL_FRAME')
  check({k:x for k,x in q.items() if k!='PID'}=={**plan['requestParams'],'MSGID':msg}
   and isinstance(q.get('PID'),str) and q['PID'].startswith('gdmgcm') and 6<len(q['PID'])<512
   and (pid is None or pid==q['PID']),'AUTOMATIC_TERMINAL_REQUEST');pid=q['PID']
  check(sorted(v) in p['responseKeySets'][msg],'AUTOMATIC_TERMINAL_SHAPE')
  check(v.get('MSGID')==msg and v.get('IFG')==str(int(i>0)) and v.get('BPR')=='10' and v.get('MUL')=='1'
   and v.get('FRBAL')=='0' and isinstance(v.get('SID'),str) and 0<len(v['SID'])<512
   and (sid is None or sid==v['SID']),'AUTOMATIC_TERMINAL_STATE');sid=v['SID']
  left=amount(v.get('NFG'))
  if not i:
   fid=v.get('FID');total=left;base=amount(v.get('TW'))
   check(total in p['initialRemaining'].get(fid,[]) and v.get('FGT')==str(total),'AUTOMATIC_TERMINAL_COUNTER')
  check(v.get('FID')==fid and v.get('TFG')==str(total) and v.get('CFGG')==str(i)
   and (i==0 or remaining>0 and left==remaining-1 and 'FGT' not in v),'AUTOMATIC_TERMINAL_COUNTER')
  check(not any(k.startswith(('FS_','NFR_')) for k in v) and not set(v)&{'CFG','ABPM'}
   and '#lives~' not in v.get('GSD',''),'UNKNOWN_TRIAL_FEATURE')
  current,b,ab=(amount(v.get(k)) for k in ('TW','B','AB'));terminal=i==len(steps)-1 and left==0
  check(current>=win and amount(v.get('CW'))==current-win and amount(v.get('FGTW'))==current-base
   and b==held+current and (ab==held or terminal and ab==b) and amount(st.get('responseBalance'))==ab,'AUTOMATIC_TERMINAL_MONEY')
  xml=st.get('responseXml');check(isinstance(xml,str) and len(xml)<262144 and '<!DOCTYPE' not in xml.upper() and '<!ENTITY' not in xml.upper(),'INVALID_TRIAL_XML')
  try:root=ET.fromstring(xml)
  except ET.ParseError:check(False,'INVALID_TRIAL_XML')
  check(root.tag.upper()=='GDMRESPONSE' and not root.attrib and [c.tag for c in root]==['OGS_RC','SUCCESS','PAYLOAD']
   and all(not c.attrib and not len(c) for c in root) and root.findtext('OGS_RC')=='0'
   and str(root.findtext('SUCCESS')).lower()=='true'
   and root.findtext('PAYLOAD')==st['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
  check(amount(st.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING');remaining=left;win=current;balance=b
 return dict(count=len(steps),remaining=remaining,start=start,stake=stake,win=win,balance=balance)
def next_request(raw,plan=None):
 s=prefix(raw,plan);return {'MSGID':'BET'} if not s['count'] else {'MSGID':'FREE_GAME'} if s['remaining'] else None
def settled(raw,plan=None):
 s=prefix(raw,plan);check(s['count']>0 and s['remaining']==0,'INCOMPLETE_ROUND')
 kind='freeGame' if s['count']>1 else 'none';buy,bonus,mapping=types(raw,kind)
 check(buy==0 and bonus==int(s['count']>1),'AUTOMATIC_TERMINAL_MAPPING')
 return dict(roundFieldsVersion=VERSION,protocol='nextgen',sourceKey=raw['sourceKey'],bet=s['stake']/100,
  mul=s['win']/s['stake'],buy=buy,bonus=bonus,primaryBonusKind=kind,typeMappingHash=mapping,
  money=dict(startBalanceRaw=s['start'],endBalanceRaw=s['balance'],totalWinRaw=s['win'],betRaw=s['stake']))
